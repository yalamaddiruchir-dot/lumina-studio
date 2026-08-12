package com.luminastudio.web;

import com.luminastudio.config.AppProperties;
import com.luminastudio.security.Auth;
import com.luminastudio.security.JwtService;
import com.luminastudio.security.LoginRateLimiter;
import com.luminastudio.service.ActivityLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * POST /api/auth/login        → { token, user }
 * GET  /api/auth/me           → user
 * POST /api/auth/change-password → { ok: true }
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final NamedParameterJdbcTemplate jdbc;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final ActivityLogService activity;
    private final LoginRateLimiter limiter;
    private final AppProperties props;

    public AuthController(NamedParameterJdbcTemplate jdbc, JwtService jwtService,
                          PasswordEncoder passwordEncoder, ActivityLogService activity,
                          LoginRateLimiter limiter, AppProperties props) {
        this.jdbc = jdbc;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.activity = activity;
        this.limiter = limiter;
        this.props = props;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, String> body, HttpServletRequest req) {
        if (props.prod()) limiter.check(clientIp(req));
        String email = body == null ? null : str(body.get("email"));
        String password = body == null ? null : body.get("password");
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ApiException(400, "Email and password are required");
        }
        Map<String, Object> user = jdbc.query(
                "SELECT * FROM users WHERE email = :email", Map.of("email", email.trim().toLowerCase()),
                rs -> rs.next() ? mapRow(rs) : null);
        if (user == null || !passwordEncoder.matches(password, (String) user.get("password_hash"))) {
            throw new ApiException(401, "Invalid email or password");
        }
        if ("inactive".equals(user.get("status"))) {
            throw new ApiException(403, "This account has been deactivated");
        }
        String token = jwtService.generate(((Number) user.get("id")).intValue(), (String) user.get("role"), (String) user.get("email"));
        activity.log(((Number) user.get("id")).intValue(), "signed in", "user", user.get("id"),
                user.get("name") + " signed in");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("user", Auth.serializeUser(user, (String) user.get("role")));
        return out;
    }

    /**
     * Signup is disabled — accounts are created by the studio (Owner / Manager / HR)
     * from the Employees page. Returning 403 keeps the public endpoint from being used.
     */
    @PostMapping("/signup")
    public Map<String, Object> signup() {
        throw new ApiException(403, "Account creation is managed by the studio — ask your Owner, Manager or HR to create your login.");
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest req) {
        Map<String, Object> u = Auth.user(req);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", u.get("id")));
        return Auth.serializeUser(row, String.valueOf(u.get("role")));
    }

    @PostMapping("/change-password")
    public Map<String, Object> changePassword(@RequestBody(required = false) Map<String, String> body, HttpServletRequest req) {
        Map<String, Object> u = Auth.user(req);
        String current = body == null ? null : body.get("current");
        String next = body == null ? null : body.get("next");
        if (current == null || next == null || next.length() < 6) {
            throw new ApiException(400, "Password must be at least 6 characters");
        }
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", u.get("id")));
        if (!passwordEncoder.matches(current, (String) row.get("password_hash"))) {
            throw new ApiException(400, "Current password is incorrect");
        }
        jdbc.update("UPDATE users SET password_hash = :hash WHERE id = :id",
                Map.of("hash", passwordEncoder.encode(next), "id", u.get("id")));
        activity.log(((Number) u.get("id")).intValue(), "changed", "password", u.get("id"),
                u.get("name") + " changed their password");
        return Map.of("ok", true);
    }

    private static String str(String s) { return s == null ? "" : s; }

    private static String clientIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    /** Small manual row mapper (NamedParameterJdbcTemplate can't map rows by name without a mapper). */
    private static Map<String, Object> mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        java.sql.ResultSetMetaData md = rs.getMetaData();
        for (int i = 1; i <= md.getColumnCount(); i++) m.put(md.getColumnLabel(i), rs.getObject(i));
        return m;
    }
}
