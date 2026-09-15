package com.securedms.backend.controller;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<?> handleOptimisticLockingFailure(ObjectOptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "detail", "The document or case was modified by another user. Please refresh and try again.",
                "error", "optimistic_lock_failed"
        ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        // Specifically look for our case unique constraint
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (msg.contains("station_code") || msg.contains("case_number") || msg.contains("unique constraint")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "detail", "A case with this number, station code, and filing year already exists.",
                    "error", "unique_constraint_violation"
            ));
        }
        
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "detail", "Database integrity violation.",
                "error", "data_integrity_violation"
        ));
    }
}
