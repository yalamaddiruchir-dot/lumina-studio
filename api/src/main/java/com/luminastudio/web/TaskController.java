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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * /api/tasks — CRUD with role scoping. Staff can move their own tasks;
 * managers/above manage all tasks.
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public TaskController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT t.*, u.name AS assignee_name, u.avatar_hue AS assignee_hue, u.role AS assignee_role,
          p.name AS project_name, p.type AS project_type, p.status AS project_status
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        LEFT JOIN projects p ON p.id = t.project_id
        """;

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(required = false) String project_id,
                                          @RequestParam(required = false) String assignee_id,
                                          @RequestParam(required = false) String q) {
        Auth.require(req, "projects.view");
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (!Auth.isDemo(req)) {
            // Real accounts: their own tasks only — assigned to them or created by them.
            where.append("(t.assignee_id = :me OR t.created_by = :me)");
            p.addValue("me", Auth.id(req));
        } else if (isScoped(Auth.role(req))) {
            where.append("t.assignee_id = :uid");
            p.addValue("uid", Auth.id(req));
        }
        if (status != null && !status.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("t.status = :status");
            p.addValue("status", status);
        }
        if (project_id != null && !project_id.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("t.project_id = :project_id");
            p.addValue("project_id", Integer.parseInt(project_id));
        }
        if (assignee_id != null && !assignee_id.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("t.assignee_id = :assignee_id");
            p.addValue("assignee_id", Integer.parseInt(assignee_id));
        }
        if (q != null && !q.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("(t.title LIKE :q OR t.description LIKE :q)");
            p.addValue("q", "%" + q + "%");
        }
        String sql = SELECT + (where.isEmpty() ? "" : " WHERE " + where) + """
             ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
             t.due_date IS NULL, t.due_date, t.created_at DESC
            """;
        return jdbc.queryForList(sql, p);
    }

    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
@PostMapping
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "tasks.manage");
        String title = Db.str(body.get("title"));
        if (title.isBlank()) throw new ApiException(400, "Task title is required");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("title", title)
                .addValue("description", Db.nz(body.get("description")))
                .addValue("project_id", body.get("project_id") != null && !Db.str(body.get("project_id")).isBlank() ? Db.num(body.get("project_id"), 0) : null)
                .addValue("assignee_id", body.get("assignee_id") != null && !Db.str(body.get("assignee_id")).isBlank() ? Db.num(body.get("assignee_id"), 0) : null)
                .addValue("status", Db.str(body.get("status")).isBlank() ? "todo" : Db.str(body.get("status")))
                .addValue("priority", Db.str(body.get("priority")).isBlank() ? "medium" : Db.str(body.get("priority")))
                .addValue("due_date", Db.nz(body.get("due_date")))
                .addValue("hours", Db.dbl(body.get("estimated_hours"), 0))
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO tasks (title, description, project_id, assignee_id, status, priority, due_date, estimated_hours, created_by)
            VALUES (:title, :description, :project_id, :assignee_id, :status, :priority, :due_date, :hours, :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE t.id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "created", "task", newId, "Created task '" + row.get("title") + "'");
        return row;
    }

    /** Quick status move — supports optimistic UI updates. */
    @PatchMapping("/{id}/status")
    public Map<String, Object> move(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                    HttpServletRequest req) {
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE t.id = :id", Map.of("id", id));
        String status = Db.str(body.get("status"));
        if (!List.of("todo", "in_progress", "review", "done").contains(status)) {
            throw new ApiException(400, "Invalid status");
        }
        boolean isOwn = row.get("assignee_id") != null && ((Number) row.get("assignee_id")).intValue() == Auth.id(req);
        boolean isMine = row.get("created_by") != null && ((Number) row.get("created_by")).intValue() == Auth.id(req);
        if (!Auth.isDemo(req) && !isOwn && !isMine) {
            throw new ApiException(403, "You can only move your own tasks");
        }
        if (!isOwn && !isMine && !Permissions.has(Auth.role(req), "tasks.manage")) {
            throw new ApiException(403, "Only managers can move other people's tasks");
        }
        jdbc.update("UPDATE tasks SET status = :status, completed_at = CASE WHEN :status = 'done' THEN NOW() ELSE NULL END WHERE id = :id",
                Map.of("status", status, "id", id));
        Map<String, Object> updated = jdbc.queryForMap(SELECT + " WHERE t.id = :id", Map.of("id", id));
        activity.log(Auth.id(req), "done".equals(status) ? "completed" : "moved", "task", id,
                "done".equals(status) ? "Completed '" + row.get("title") + "'"
                        : "Moved '" + row.get("title") + "' to " + status.replace('_', ' '));
        return updated;
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "tasks.manage");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM tasks WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "task");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("title", body.get("title") != null ? Db.str(body.get("title")) : existing.get("title"))
                .addValue("description", body.get("description") != null ? Db.nz(body.get("description")) : existing.get("description"))
                .addValue("project_id", body.get("project_id") != null ? (Db.str(body.get("project_id")).isBlank() ? null : Db.num(body.get("project_id"), 0)) : existing.get("project_id"))
                .addValue("assignee_id", body.get("assignee_id") != null ? (Db.str(body.get("assignee_id")).isBlank() ? null : Db.num(body.get("assignee_id"), 0)) : existing.get("assignee_id"))
                .addValue("status", body.get("status") != null ? Db.str(body.get("status")) : existing.get("status"))
                .addValue("priority", body.get("priority") != null ? Db.str(body.get("priority")) : existing.get("priority"))
                .addValue("due_date", body.get("due_date") != null ? Db.nz(body.get("due_date")) : existing.get("due_date"))
                .addValue("hours", body.get("estimated_hours") != null ? Db.dbl(body.get("estimated_hours"), 0) : existing.get("estimated_hours"));
        jdbc.update("""
            UPDATE tasks SET title=:title, description=:description, project_id=:project_id, assignee_id=:assignee_id,
              status=:status, priority=:priority, due_date=:due_date, estimated_hours=:hours
            WHERE id=:id
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE t.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "task", id, "Updated task '" + row.get("title") + "'");
        return row;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "tasks.manage");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM tasks WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "task");
        jdbc.update("DELETE FROM tasks WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "task", id, "Removed task '" + row.get("title") + "'");
        return Map.of("ok", true);
    }

    /** Production-floor roles only see their own records. */
    private static boolean isScoped(String role) {
        return "production".equals(role) || "quality".equals(role) || "sales".equals(role);
    }

}
