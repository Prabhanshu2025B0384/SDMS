package com.securedms.backend.controller;

import com.securedms.backend.model.Document;
import com.securedms.backend.repository.DocumentRepository;
import com.securedms.backend.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
public class SearchController {

    private final DocumentRepository documentRepository;

    @GetMapping("/documents")
    public ResponseEntity<?> searchDocuments(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Integer classification_level,
            @RequestParam(required = false) String document_type,
            @RequestParam(required = false) String case_reference,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        List<Document> documents = documentRepository.findAuthorizedDocuments(userDetails.getClearanceLevel());
        
        if (classification_level != null) {
            documents = documents.stream().filter(d -> d.getClassificationLevel().equals(classification_level)).collect(Collectors.toList());
        }
        if (document_type != null && !document_type.equalsIgnoreCase("all types")) {
            documents = documents.stream().filter(d -> d.getDocumentType().equalsIgnoreCase(document_type)).collect(Collectors.toList());
        }
        if (case_reference != null && !case_reference.trim().isEmpty()) {
            documents = documents.stream().filter(d -> d.getCaseObj().getCaseNumber().toLowerCase().contains(case_reference.toLowerCase())).collect(Collectors.toList());
        }
        if (query != null && !query.trim().isEmpty()) {
            String lowerQuery = query.toLowerCase();
            documents = documents.stream().filter(d -> {
                boolean matchTitle = d.getTitle().toLowerCase().contains(lowerQuery);
                boolean matchSearchVector = d.getSearchVector() != null && d.getSearchVector().toLowerCase().contains(lowerQuery);
                return matchTitle || matchSearchVector;
            }).collect(Collectors.toList());
        }
        
        var result = documents.stream().map(d -> Map.of(
                "id", d.getId(),
                "title", d.getTitle(),
                "document_type", d.getDocumentType(),
                "classification_level", d.getClassificationLevel(),
                "status", d.getStatus(),
                "case_id", d.getCaseObj().getCaseNumber(),
                "created_at", d.getCreatedAt(),
                "snippet", d.getTitle() // Simplified snippet
        )).toList();
        
        return ResponseEntity.ok(result);
    }
}
