package com.securedms.backend.repository;

import com.securedms.backend.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {
    
    // We will use native queries for full-text search later
    @Query(value = "SELECT d.* FROM documents d JOIN cases c ON d.case_id = c.id WHERE d.classification_level <= :clearanceLevel ORDER BY d.created_at DESC", nativeQuery = true)
    List<Document> findAuthorizedDocuments(@Param("clearanceLevel") Integer clearanceLevel);
}
