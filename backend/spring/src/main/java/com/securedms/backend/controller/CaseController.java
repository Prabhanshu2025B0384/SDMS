package com.securedms.backend.controller;

import com.securedms.backend.model.Case;
import com.securedms.backend.model.User;
import com.securedms.backend.repository.CaseRepository;
import com.securedms.backend.repository.UserRepository;
import com.securedms.backend.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/cases")
@RequiredArgsConstructor
public class CaseController {

    private final CaseRepository caseRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getCases(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<Case> cases = caseRepository.findAll();
        
        var result = cases.stream().map(c -> Map.of(
                "id", c.getId(),
                "case_number", c.getCaseNumber(),
                "status", c.getStatus(),
                "jurisdiction", c.getJurisdiction(),
                "owning_officer_id", c.getOwningOfficer().getId(),
                "created_at", c.getCreatedAt()
        )).toList();
        
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createCase(
            @RequestParam(required = false, defaultValue = "UNKNOWN") String station_code,
            @RequestParam(required = false, defaultValue = "2024") Integer filing_year,
            @RequestParam String case_number,
            @RequestParam String jurisdiction,
            @RequestParam(defaultValue = "CREATED") String status,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        if (caseRepository.findByStationCodeAndFilingYearAndCaseNumber(station_code, filing_year, case_number).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Case with this station, year, and number already exists"));
        }

        User owner = userRepository.findById(userDetails.getId()).orElseThrow();

        Case newCase = Case.builder()
                .stationCode(station_code)
                .filingYear(filing_year)
                .caseNumber(case_number)
                .jurisdiction(jurisdiction)
                .status(status)
                .owningOfficer(owner)
                .build();
                
        caseRepository.save(newCase);

        return ResponseEntity.ok(Map.of(
                "id", newCase.getId(),
                "case_number", newCase.getCaseNumber(),
                "status", newCase.getStatus(),
                "jurisdiction", newCase.getJurisdiction(),
                "owning_officer_id", newCase.getOwningOfficer().getId()
        ));
    }

    @PatchMapping("/{id}/reassign")
    public ResponseEntity<?> reassignCase(@PathVariable UUID id, @RequestBody Map<String, String> payload, @AuthenticationPrincipal UserDetailsImpl userDetails) {
        if (!"Admin".equals(userDetails.getRole())) return ResponseEntity.status(403).build();
        Case caseObj = caseRepository.findById(id).orElseThrow();
        User newOfficer = userRepository.findById(UUID.fromString(payload.get("officer_id"))).orElseThrow();
        caseObj.setOwningOfficer(newOfficer);
        caseRepository.save(caseObj);
        return ResponseEntity.ok(Map.of("message", "Case reassigned"));
    }
}
