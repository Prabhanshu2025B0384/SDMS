package com.securedms.backend.repository;

import com.securedms.backend.model.Case;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CaseRepository extends JpaRepository<Case, UUID> {
    Optional<Case> findByCaseNumber(String caseNumber);
    Optional<Case> findByStationCodeAndFilingYearAndCaseNumber(String stationCode, Integer filingYear, String caseNumber);
}
