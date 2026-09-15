package com.securedms.backend.repository;

import com.securedms.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPublicId(String publicId);
    List<User> findByIsDeletedFalseOrderByClearanceLevelDesc();
    
    List<User> findByIsActiveTrueAndIsDeletedFalseAndEmailContainingIgnoreCaseOrDepartmentContainingIgnoreCaseOrRoleContainingIgnoreCase(
            String email, String department, String role);
}
