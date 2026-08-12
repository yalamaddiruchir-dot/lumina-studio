package com.luminastudio.web;

import com.luminastudio.security.Auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * GET /api/activity?limit= — newest activity entries with actor info.
 */
@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    private final NamedParameterJdbcTemplate jdbc;

    public ActivityController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(defaultValue = "50") int limit) {
        Auth.require(req, "activity.view");
        int capped = Math.min(Math.max(limit, 1), 200);
        return jdbc.queryForList("""
            SELECT a.*, u.name AS user_name, u.avatar_hue, u.role
            FROM activity a LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT :limit
            """, Map.of("limit", capped));
    }
}
