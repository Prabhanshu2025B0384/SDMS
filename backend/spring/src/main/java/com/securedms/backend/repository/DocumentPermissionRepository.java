package com.securedms.backend.repository;

import com.securedms.backend.model.DocumentPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentPermissionRepository extends JpaRepository<DocumentPermission, UUID> {
    List<DocumentPermission> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<DocumentPermission> findByDocumentId(UUID documentId);
    Optional<DocumentPermission> findByDocumentIdAndUserId(UUID documentId, UUID userId);
}
