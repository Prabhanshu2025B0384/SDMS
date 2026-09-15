package com.securedms.backend.controller;

import com.securedms.backend.model.Notification;
import com.securedms.backend.repository.NotificationRepository;
import com.securedms.backend.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping
    public ResponseEntity<?> getNotifications(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<Notification> notifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userDetails.getId());
        
        var result = notifications.stream().map(n -> Map.of(
                "id", n.getId(),
                "message", n.getMessage(),
                "link", n.getLink() != null ? n.getLink() : "",
                "is_read", n.getIsRead(),
                "created_at", n.getCreatedAt()
        )).toList();
        
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{id}/read")
    @Transactional
    public ResponseEntity<?> markAsRead(@PathVariable UUID id, @AuthenticationPrincipal UserDetailsImpl userDetails) {
        Notification notification = notificationRepository.findById(id).orElseThrow();
        if (!notification.getUser().getId().equals(userDetails.getId())) {
            return ResponseEntity.status(403).build();
        }
        notification.setIsRead(true);
        notificationRepository.save(notification);
        return ResponseEntity.ok(Map.of("message", "Marked as read"));
    }

    @DeleteMapping("/all")
    @Transactional
    public ResponseEntity<?> clearAll(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        notificationRepository.deleteByUserId(userDetails.getId());
        return ResponseEntity.ok(Map.of("message", "All notifications cleared"));
    }
}
