package com.securedms.backend.controller;

import com.securedms.backend.model.Case;
import com.securedms.backend.model.Document;
import com.securedms.backend.model.DocumentVersion;
import com.securedms.backend.model.User;
import com.securedms.backend.repository.CaseRepository;
import com.securedms.backend.repository.DocumentRepository;
import com.securedms.backend.repository.DocumentVersionRepository;
import com.securedms.backend.repository.UserRepository;
import com.securedms.backend.security.UserDetailsImpl;
import com.securedms.backend.service.AuditService;
import com.securedms.backend.service.RedisService;
import com.securedms.backend.service.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final RedisService redisService;
    private final AuditService auditService;

    @Value("${webhook.secret}")
    private String webhookSecret;

    @GetMapping
    public ResponseEntity<?> getDocuments(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<Document> documents = documentRepository.findAuthorizedDocuments(userDetails.getClearanceLevel());
        var result = documents.stream().map(d -> Map.of(
                "id", d.getId(),
                "title", d.getTitle(),
                "document_type", d.getDocumentType(),
                "classification_level", d.getClassificationLevel(),
                "status", d.getStatus(),
                "case_id", d.getCaseObj().getId(),
                "created_at", d.getCreatedAt()
        )).toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/upload")
    @Transactional
    public ResponseEntity<?> uploadDocument(
            @RequestParam("case_id") UUID caseId,
            @RequestParam("title") String title,
            @RequestParam("document_type") String documentType,
            @RequestParam(value = "classification_level", defaultValue = "1") int classificationLevel,
            @RequestParam(value = "reviewer_id", required = false) UUID reviewerId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        if (file.isEmpty() || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Only PDF files are supported"));
        }

        if (classificationLevel > userDetails.getClearanceLevel()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Cannot upload a document with a classification higher than your clearance."));
        }

        Case caseObj = caseRepository.findById(caseId).orElseThrow(() -> new RuntimeException("Case not found"));
        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        // 1. Create Document
        Document doc = Document.builder()
                .caseObj(caseObj)
                .title(title)
                .documentType(documentType)
                .classificationLevel(classificationLevel)
                .status("PROCESSING")
                .build();
        documentRepository.save(doc);

        // 2. Save File
        String versionNumber = "1.0";
        String storagePath = caseId + "/" + doc.getId() + "/" + versionNumber + ".pdf";
        
        try {
            storageService.saveStorageFile(storagePath, file.getBytes());
        } catch (Exception e) {
            throw new RuntimeException("Failed to store file", e);
        }

        // 3. Create Version
        DocumentVersion version = DocumentVersion.builder()
                .document(doc)
                .versionNumber(versionNumber)
                .storagePath(storagePath)
                .fileHash("PENDING-HASH-CALCULATION") // Should calc SHA-256
                .createdBy(user)
                .build();
        versionRepository.save(version);
        
        doc.setCurrentVersionId(version.getId());
        documentRepository.save(doc);

        // 4. Audit Log
        auditService.logEvent("DOCUMENT_UPLOADED", user, doc, caseObj, "SUCCESS", Map.of("title", title));

        // 5. Enqueue Celery Task
        redisService.enqueueDocumentProcessingTask(doc.getId(), version.getId(), user.getId(), documentType, storagePath);

        return ResponseEntity.ok(Map.of(
                "message", "Upload started successfully",
                "document_id", doc.getId(),
                "status", "PROCESSING"
        ));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadDocument(@PathVariable UUID id, @AuthenticationPrincipal UserDetailsImpl userDetails) {
        Document doc = documentRepository.findById(id).orElseThrow(() -> new RuntimeException("Document not found"));
        
        if (doc.getClassificationLevel() > userDetails.getClearanceLevel()) {
             return ResponseEntity.status(403).body(Map.of("detail", "Clearance level too low to download this document"));
        }

        DocumentVersion version = versionRepository.findById(doc.getCurrentVersionId())
            .orElseThrow(() -> new RuntimeException("Version not found"));

        byte[] fileData = storageService.getStorageFile(version.getStoragePath());

        auditService.logEvent("DOCUMENT_DOWNLOADED", userRepository.findById(userDetails.getId()).get(), doc, doc.getCaseObj(), "SUCCESS", Map.of("version", version.getVersionNumber()));

        String filename = doc.getTitle().replace(" ", "_") + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(fileData);
    }

    @PostMapping("/{id}/webhook/processed")
    @Transactional
    public ResponseEntity<?> documentProcessedWebhook(
            @PathVariable UUID id, 
            @RequestHeader(value = "X-Webhook-Secret", required = false) String providedSecret,
            @RequestBody Map<String, Object> payload) {
        
        if (providedSecret == null || !providedSecret.equals(webhookSecret)) {
            return ResponseEntity.status(401).body(Map.of("detail", "Unauthorized webhook call"));
        }

        Document doc = documentRepository.findById(id).orElseThrow(() -> new RuntimeException("Document not found"));
        DocumentVersion version = versionRepository.findById(doc.getCurrentVersionId()).orElseThrow();
        
        String status = (String) payload.get("status");
        if ("PROCESSING_FAILED".equals(status)) {
            doc.setStatus("PROCESSING_FAILED");
            doc.setFailureReason((String) payload.get("failure_reason"));
        } else {
            doc.setStatus("READY");
            version.setRawOcrText((String) payload.get("raw_ocr_text"));
            version.setStructuredData((Map<String, Object>) payload.get("structured_data"));
            
            // Generate search vector (dummy representation here, handled by native SQL usually)
            String metaText = version.getStructuredData() != null ? version.getStructuredData().values().toString() : "";
            // doc.setSearchVector(doc.getTitle() + " " + doc.getDocumentType() + " " + metaText); // Handled by DB Trigger or Native Query
        }
        
        documentRepository.save(doc);
        versionRepository.save(version);
        
        return ResponseEntity.ok(Map.of("message", "Document updated via webhook"));
    }
}
