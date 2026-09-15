package com.securedms.backend.security;

import com.securedms.backend.service.RateLimitingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class RateLimitingInterceptor implements HandlerInterceptor {

    private final RateLimitingService rateLimitingService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();
        
        if (uri.startsWith("/auth/login")) {
            String clientIp = getClientIp(request);
            // 5 login attempts per minute per IP
            if (!rateLimitingService.allowRequest("login:" + clientIp, 5, Duration.ofMinutes(1))) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.getWriter().write("Too many login attempts. Please try again later.");
                return false;
            }
        }
        
        if (uri.startsWith("/documents/upload")) {
            String clientIp = getClientIp(request);
            String userId = request.getUserPrincipal() != null ? request.getUserPrincipal().getName() : clientIp;
            
            // 10 uploads per hour per user/IP
            if (!rateLimitingService.allowRequest("upload:" + userId, 10, Duration.ofHours(1))) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.getWriter().write("Upload limit exceeded. Please try again later.");
                return false;
            }
        }
        
        return true;
    }
    
    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
}
