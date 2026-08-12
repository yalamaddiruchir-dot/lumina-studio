package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.security.Permissions;
import com.luminastudio.service.ActivityLogService;
import com.luminastudio.util.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * /api/timesheets — staff submit, managers/HR/finance approve.
 */
@RestController
@RequestMapping("/api/timesheets")
public class TimesheetController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public TimesheetController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT ts.*, u.name AS user_name, u.avatar_hue AS user_hue, u.department, p.name AS project_name
        FROM timesheets ts
        LEFT JOIN users u ON u.id = ts.user_id
        LEFT JOIN projects p ON p.id = ts.project_id
        """;

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(required = false) String user_id,
                                          @RequestParam(required = false) String from,
                                          @RequestParam(required = false) String to) {
        Auth.require(req, "projects.view");
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (!Auth.isDemo(req)) {
            where.append("(ts.user_id = :me OR ts.created_by = :me)");
            p.addValue("me", Auth.id(req));
        } else if (isScoped(Auth.role(req))) {
            where.append("ts.user_id = :uid");
            p.addValue("uid", Auth.id(req));
        }
        if (status != null && !status.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("ts.status = :status");
            p.addValue("status", status);
        }
        if (user_id != null && !user_id.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("ts.user_id = :user_id");
            p.addValue("user_id", Integer.parseInt(user_id));
        }
        if (from != null && !from.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("ts.date >= :from");
            p.addValue("from", from);
        }
        if (to != null && !to.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("ts.date <= :to");
            p.addValue("to", to);
        }
        String sql = SELECT + (where.isEmpty() ? "" : " WHERE " + where) + " ORDER BY ts.date DESC, ts.id DESC";
        return jdbc.queryForList(sql, p);
    }

    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
@PostMapping
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "timesheets.submit");
        String date = Db.str(body.get("date"));
        double hours = Db.dbl(body.get("hours"), 0);
        if (date.isBlank()) throw new ApiException(400, "Date is required");
        if (hours <= 0 || hours > 24) throw new ApiException(400, "Hours must be between 0 and 24");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("user_id", me.get("id"))
                .addValue("project_id", body.get("project_id") != null && !Db.str(body.get("project_id")).isBlank() ? Db.num(body.get("project_id"), 0) : null)
                .addValue("date", date)
                .addValue("hours", hours)
                .addValue("description", Db.nz(body.get("description")))
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO timesheets (user_id, project_id, date, hours, description, status, created_by)
            VALUES (:user_id, :project_id, :date, :hours, :description, 'pending', :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE ts.id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "submitted", "timesheet", newId,
                "Submitted " + hours + "h timesheet for " + date);
        return row;
    }

    @PatchMapping("/{id}/status")
    public Map<String, Object> move(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                    HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "timesheets.approve");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM timesheets WHERE id = :id", Map.of("id", id));
        String status = Db.str(body.get("status"));
        if (!List.of("approved", "rejected", "pending").contains(status)) throw new ApiException(400, "Invalid status");
        jdbc.update("UPDATE timesheets SET status = :status WHERE id = :id", Map.of("status", status, "id", id));
        activity.log((Integer) me.get("id"), status, "timesheet", id,
                status.substring(0, 1).toUpperCase() + status.substring(1) + " a timesheet for " + row.get("date"));
        return jdbc.queryForMap(SELECT + " WHERE ts.id = :id", Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.user(req);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM timesheets WHERE id = :id", Map.of("id", id));
        boolean own = row.get("user_id") != null && ((Number) row.get("user_id")).intValue() == ((Number) me.get("id")).intValue();
        boolean mine = row.get("created_by") != null && ((Number) row.get("created_by")).intValue() == ((Number) me.get("id")).intValue();
        if (!Auth.isDemo(req) && !own && !mine) {
            throw new ApiException(403, "You can only delete your own timesheets");
        }
        if (!own && !Permissions.has(Auth.role(req), "timesheets.approve")) {
            throw new ApiException(403, "You can only delete your own timesheets");
        }
        jdbc.update("DELETE FROM timesheets WHERE id = :id", Map.of("id", id));
        return Map.of("ok", true);
    }

    /** Production-floor roles only see their own records. */
    private static boolean isScoped(String role) {
        return "production".equals(role) || "quality".equals(role) || "sales".equals(role);
    }

}
