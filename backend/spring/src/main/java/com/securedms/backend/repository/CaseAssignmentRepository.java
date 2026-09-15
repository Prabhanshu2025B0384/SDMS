package com.securedms.backend.repository;

import com.securedms.backend.model.CaseAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CaseAssignmentRepository extends JpaRepository<CaseAssignment, UUID> {
    List<CaseAssignment> findByUserId(UUID userId);
    List<CaseAssignment> findByCaseObjId(UUID caseId);
    boolean existsByCaseObjIdAndUserId(UUID caseId, UUID userId);
}
