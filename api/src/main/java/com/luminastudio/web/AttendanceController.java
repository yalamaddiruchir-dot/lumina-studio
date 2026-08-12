package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.security.Permissions;
import com.luminastudio.service.ActivityLogService;
import com.luminastudio.util.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * /api/attendance — check-in / check-out + history.
 * Staff see their own; HR/admin/owner see everyone.
 */
@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public AttendanceController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT a.*, u.name AS user_name, u.avatar_hue AS user_hue, u.department
        FROM attendance a LEFT JOIN users u ON u.id = a.user_id
        """;

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(required = false) String from,
                                          @RequestParam(required = false) String to,
                                          @RequestParam(required = false) String user_id) {
        Auth.require(req, "projects.view");
        boolean privileged = Permissions.has(Auth.role(req), "attendance.view_all");
        StringBuilder where = new StringBuilder();
        org.springframework.jdbc.core.namedparam.MapSqlParameterSource p = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource();
        if (!Auth.isDemo(req)) {
            where.append("(a.user_id = :me OR a.created_by = :me)");
            p.addValue("me", Auth.id(req));
        } else if (!privileged) {
            where.append("a.user_id = :uid");
            p.addValue("uid", Auth.id(req));
        }
        if (user_id != null && !user_id.isBlank() && privileged) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("a.user_id = :user_id");
            p.addValue("user_id", Integer.parseInt(user_id));
        }
        if (from != null && !from.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("a.date >= :from");
            p.addValue("from", from);
        }
        if (to != null && !to.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("a.date <= :to");
            p.addValue("to", to);
        }
        String sql = SELECT + (where.isEmpty() ? "" : " WHERE " + where) + " ORDER BY a.date DESC, u.name";
        return jdbc.queryForList(sql, p);
    }

    @PostMapping("/check")
    public Map<String, Object> check(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "attendance.checkin");
        String action = Db.str(body.get("action"));
        String today = LocalDate.now().toString();
        String now = String.format("%02d:%02d", LocalTime.now().getHour(), LocalTime.now().getMinute());
        Map<String, Object> existing = jdbc.queryForList(
                "SELECT * FROM attendance WHERE user_id = :uid AND date = :date", Map.of("uid", me.get("id"), "date", today))
                .stream().findFirst().orElse(null);

        if ("in".equals(action)) {
            if (existing != null && existing.get("check_in") != null) throw new ApiException(400, "Already checked in today");
            if (existing != null) {
                jdbc.update("UPDATE attendance SET check_in = :ci WHERE id = :id", Map.of("ci", now, "id", existing.get("id")));
                return jdbc.queryForMap("SELECT * FROM attendance WHERE id = :id", Map.of("id", existing.get("id")));
            }
            String status = now.compareTo("10:00") > 0 ? "late" : "present";
            int newId = com.luminastudio.util.Db.insert(jdbc, """
                INSERT INTO attendance (user_id, date, check_in, status, created_by) VALUES (:uid, :date, :ci, :status, :uid)
                """, new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                    .addValue("uid", me.get("id")).addValue("date", today).addValue("ci", now).addValue("status", status));
            activity.log((Integer) me.get("id"), "checked in", "attendance", newId, me.get("name") + " checked in at " + now);
            return jdbc.queryForMap("SELECT * FROM attendance WHERE id = :id", Map.of("id", newId));
        }
        if ("out".equals(action)) {
            if (existing == null || existing.get("check_in") == null) throw new ApiException(400, "Check in before checking out");
            if (existing.get("check_out") != null) throw new ApiException(400, "Already checked out today");
            jdbc.update("UPDATE attendance SET check_out = :co WHERE id = :id", Map.of("co", now, "id", existing.get("id")));
            activity.log((Integer) me.get("id"), "checked out", "attendance", existing.get("id"), me.get("name") + " checked out at " + now);
            return jdbc.queryForMap("SELECT * FROM attendance WHERE id = :id", Map.of("id", existing.get("id")));
        }
        throw new ApiException(400, "Action must be \"in\" or \"out\"");
    }
}
