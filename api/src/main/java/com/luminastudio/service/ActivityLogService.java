package com.luminastudio.service;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/** Writes rows to the activity table (same columns/behaviour as the old API). */
@Service
public class ActivityLogService {

    private final NamedParameterJdbcTemplate jdbc;

    public ActivityLogService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void log(Integer userId, String action, String targetType, Object targetId, String details) {
        jdbc.update(
                "INSERT INTO activity (user_id, action, target_type, target_id, details) VALUES (:uid, :action, :type, :tid, :details)",
                Map.of("uid", userId, "action", action, "type", targetType, "tid", targetId, "details", details));
    }
}
