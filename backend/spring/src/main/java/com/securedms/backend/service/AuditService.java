package com.securedms.backend.service;

import com.securedms.backend.model.AuditLog;
import com.securedms.backend.model.Case;
import com.securedms.backend.model.Document;
import com.securedms.backend.model.User;
import com.securedms.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog logEvent(String action, User user, Document document, Case caseObj, String result, Map<String, Object> details) {
        AuditLog auditLog = AuditLog.builder()
                .action(action)
                .user(user)
                .document(document)
                .caseObj(caseObj)
                .result(result)
                .details(details)
                .build();
                
        // Hash chaining logic can be implemented here if required
        // For simplicity, we just set a dummy hash or placeholder
        auditLog.setCurrentHash("pending-hash"); 
        
        return auditLogRepository.save(auditLog);
    }
}
