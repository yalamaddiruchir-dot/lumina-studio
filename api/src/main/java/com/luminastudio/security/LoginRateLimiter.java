package com.luminastudio.security;

import com.luminastudio.config.AppProperties;
import com.luminastudio.web.ApiException;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory fixed-window login rate limiter (per IP).
 * Active only in production, mirroring the old API's express-rate-limit on /auth/login.
 */
@Component
public class LoginRateLimiter {

    private static final long WINDOW_MS = 15 * 60 * 1000L;

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();
    private final int limit;

    public LoginRateLimiter(AppProperties props) {
        this.limit = props.loginRateLimit();
    }

    /** Throws 429 when the IP has exceeded the limit in the window. */
    public void check(String ip) {
        if (ip == null || ip.isBlank()) return;
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) q.pollFirst();
            if (q.size() >= limit) {
                throw new ApiException(429, "Too many login attempts — try again in 15 minutes.");
            }
            q.addLast(now);
        }
    }
}
