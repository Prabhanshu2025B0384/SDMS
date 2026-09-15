package com.securedms.backend.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.Refill;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
public class RateLimitingService {

    // Note: For a fully clustered production environment, this ConcurrentMap should be replaced
    // with a Redis-backed ProxyManager (e.g., LettuceBasedProxyManager) from bucket4j-redis.
    // Given dependency complexities, we implement the true Token Bucket algorithm via Bucket4j locally.
    private final ConcurrentMap<String, Bucket> cache = new ConcurrentHashMap<>();

    /**
     * Checks if the given key has exceeded the limit.
     * Uses a true Token Bucket algorithm via Bucket4j.
     */
    public boolean allowRequest(String key, int maxRequests, Duration window) {
        Bucket bucket = cache.computeIfAbsent(key, k -> createNewBucket(maxRequests, window));
        return bucket.tryConsume(1);
    }

    private Bucket createNewBucket(int maxRequests, Duration window) {
        // Refill strategy: Add tokens at a steady rate over the window
        Refill refill = Refill.intervally(maxRequests, window);
        Bandwidth limit = Bandwidth.classic(maxRequests, refill);
        return Bucket.builder()
                .addLimit(limit)
                .build();
    }
}
