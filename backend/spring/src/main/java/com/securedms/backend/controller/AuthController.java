package com.securedms.backend.controller;

import com.securedms.backend.model.User;
import com.securedms.backend.repository.UserRepository;
import com.securedms.backend.security.JwtUtils;
import com.securedms.backend.security.UserDetailsImpl;
import com.securedms.backend.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.Optional;
import java.util.List;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtils jwtUtils;
    private final AuditService auditService;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestParam String username, @RequestParam String password) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtils.generateJwtToken(authentication);
        
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        auditService.logEvent("LOGIN_SUCCESS", user, null, null, "SUCCESS", 
                Map.of("email", user.getEmail(), "role", user.getRole()));

        return ResponseEntity.ok(Map.of(
                "access_token", jwt,
                "token_type", "bearer"
        ));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@RequestParam String email, 
                                          @RequestParam String password,
                                          @RequestParam String full_name,
                                          @RequestParam(defaultValue = "Investigating Officer") String role,
                                          @RequestParam(defaultValue = "General") String department,
                                          @RequestParam(defaultValue = "1") int clearance_level) {
        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Email already registered"));
        }

        User user = User.builder()
                .publicId("USR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .email(email)
                .passwordHash(encoder.encode(password))
                .role(role)
                .department(department)
                .clearanceLevel(role.equals("Admin") ? 5 : clearance_level)
                .isActive(true)
                .isDeleted(false)
                .build();

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "User created successfully",
                "id", user.getId(),
                "email", user.getEmail(),
                "clearance_level", user.getClearanceLevel()
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(Map.of(
                "id", userDetails.getId(),
                "email", userDetails.getEmail(),
                "role", userDetails.getRole(),
                "department", userDetails.getDepartment(),
                "clearance_level", userDetails.getClearanceLevel(),
                "is_active", userDetails.getIsActive()
        ));
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(@RequestParam String q) {
        if (q == null || q.length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        
        List<User> users = userRepository.findByIsActiveTrueAndIsDeletedFalseAndEmailContainingIgnoreCaseOrDepartmentContainingIgnoreCaseOrRoleContainingIgnoreCase(q, q, q);
        
        var result = users.stream().limit(20).map(u -> Map.of(
                "id", u.getId(),
                "email", u.getEmail(),
                "role", u.getRole(),
                "department", u.getDepartment(),
                "clearance_level", u.getClearanceLevel()
        )).toList();
        
        return ResponseEntity.ok(result);
    }
}
