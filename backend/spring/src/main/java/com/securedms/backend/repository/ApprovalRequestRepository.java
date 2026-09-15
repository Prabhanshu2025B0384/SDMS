package com.securedms.backend.repository;

import com.securedms.backend.model.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, UUID> {
    List<ApprovalRequest> findByReviewerIdAndStatusOrderByCreatedAtDesc(UUID reviewerId, String status);
    Optional<ApprovalRequest> findByDocumentIdAndStatus(UUID documentId, String status);
}
