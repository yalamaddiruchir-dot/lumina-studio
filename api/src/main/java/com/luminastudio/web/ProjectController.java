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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * /api/projects — CRUD with role scoping.
 * Staff see projects they manage or have tasks on; everyone else sees all.
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public ProjectController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT p.*, c.name AS client_name, c.company AS client_company, c.hue AS client_hue,
          m.name AS manager_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks,
          (SELECT COUNT(*) FROM assets a WHERE a.project_id = p.id) AS asset_count,
          (SELECT COUNT(*) FROM photos ph WHERE ph.project_id = p.id) AS photo_count,
          (SELECT COUNT(*) FROM photos ph WHERE ph.project_id = p.id AND ph.status = 'selected') AS selected_photos
        FROM projects p
        LEFT JOIN clients c ON c.id = p.client_id
        LEFT JOIN users m ON m.id = p.manager_id
        """;

    private static final String STAFF_WHERE = "WHERE p.manager_id = :uid OR p.id IN (SELECT DISTINCT project_id FROM tasks WHERE assignee_id = :uid)";

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req) {
        Auth.require(req, "projects.view");
        if (!Auth.isDemo(req)) {
            // Real accounts: only the projects they created — never the demo pipeline.
            return jdbc.queryForList(SELECT + " WHERE p.created_by = :me ORDER BY p.created_at DESC", Map.of("me", Auth.id(req)));
        }
        if (isScoped(Auth.role(req))) {
            return jdbc.queryForList(SELECT + " " + STAFF_WHERE +
                    " ORDER BY p.deadline IS NULL, p.deadline", Map.of("uid", Auth.id(req)));
        }
        return jdbc.queryForList(SELECT + " ORDER BY p.created_at DESC", Map.of());
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable int id, HttpServletRequest req) {
        Auth.require(req, "projects.view");
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE p.id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "project");
        if (isScoped(Auth.role(req))) {
            boolean isManager = row.get("manager_id") != null && ((Number) row.get("manager_id")).intValue() == Auth.id(req);
            List<Map<String, Object>> onTeam = jdbc.queryForList(
                    "SELECT 1 FROM tasks WHERE project_id = :pid AND assignee_id = :uid", Map.of("pid", id, "uid", Auth.id(req)));
            if (!isManager && onTeam.isEmpty()) throw new ApiException(403, "You are not on this project team");
        }
        List<Map<String, Object>> tasks = jdbc.queryForList("""
            SELECT t.*, u.name AS assignee_name FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.project_id = :pid
            ORDER BY CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END,
              t.due_date IS NULL, t.due_date
            """, Map.of("pid", id));
        List<Map<String, Object>> assets = jdbc.queryForList("""
            SELECT a.*, u.name AS uploader_name FROM assets a
            LEFT JOIN users u ON u.id = a.uploaded_by
            WHERE a.project_id = :pid
            ORDER BY a.uploaded_at DESC
            """, Map.of("pid", id));
        List<Map<String, Object>> team = jdbc.queryForList("""
            SELECT DISTINCT u.id, u.name, u.role, u.department, u.position, u.avatar_hue
            FROM users u JOIN tasks t ON t.assignee_id = u.id
            WHERE t.project_id = :pid
            """, Map.of("pid", id));
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("tasks", tasks);
        out.put("assets", assets);
        out.put("team", team);
        return out;
    }

    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
@PostMapping
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "projects.manage");
        String name = Db.str(body.get("name"));
        if (name.isBlank()) throw new ApiException(400, "Project name is required");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("name", name)
                .addValue("client_id", body.get("client_id") != null && !Db.str(body.get("client_id")).isBlank() ? Db.num(body.get("client_id"), 0) : null)
                .addValue("type", Db.str(body.get("type")).isBlank() ? "video" : Db.str(body.get("type")))
                .addValue("status", Db.str(body.get("status")).isBlank() ? "planning" : Db.str(body.get("status")))
                .addValue("priority", Db.str(body.get("priority")).isBlank() ? "medium" : Db.str(body.get("priority")))
                .addValue("budget", Db.dbl(body.get("budget"), 0))
                .addValue("spent", Db.dbl(body.get("spent"), 0))
                .addValue("start_date", Db.nz(body.get("start_date")))
                .addValue("shoot_date", Db.nz(body.get("shoot_date")))
                .addValue("deadline", Db.nz(body.get("deadline")))
                .addValue("manager_id", body.get("manager_id") != null && !Db.str(body.get("manager_id")).isBlank() ? Db.num(body.get("manager_id"), 0) : null)
                .addValue("description", Db.nz(body.get("description")))
                .addValue("progress", Db.num(body.get("progress"), 0))
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO projects (name, client_id, type, status, priority, budget, spent,
                                  start_date, shoot_date, deadline, manager_id, description, progress, created_by)
            VALUES (:name, :client_id, :type, :status, :priority, :budget, :spent,
                    :start_date, :shoot_date, :deadline, :manager_id, :description, :progress, :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE p.id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "created", "project", newId, "Created project '" + row.get("name") + "'");
        return row;
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "projects.manage");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM projects WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "project");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", body.get("name") != null ? Db.str(body.get("name")) : existing.get("name"))
                .addValue("client_id", body.get("client_id") != null ? (Db.str(body.get("client_id")).isBlank() ? null : Db.num(body.get("client_id"), 0)) : existing.get("client_id"))
                .addValue("type", body.get("type") != null ? Db.str(body.get("type")) : existing.get("type"))
                .addValue("status", body.get("status") != null ? Db.str(body.get("status")) : existing.get("status"))
                .addValue("priority", body.get("priority") != null ? Db.str(body.get("priority")) : existing.get("priority"))
                .addValue("budget", body.get("budget") != null ? Db.dbl(body.get("budget"), 0) : existing.get("budget"))
                .addValue("spent", body.get("spent") != null ? Db.dbl(body.get("spent"), 0) : existing.get("spent"))
                .addValue("start_date", body.get("start_date") != null ? Db.nz(body.get("start_date")) : existing.get("start_date"))
                .addValue("shoot_date", body.get("shoot_date") != null ? Db.nz(body.get("shoot_date")) : existing.get("shoot_date"))
                .addValue("deadline", body.get("deadline") != null ? Db.nz(body.get("deadline")) : existing.get("deadline"))
                .addValue("manager_id", body.get("manager_id") != null ? (Db.str(body.get("manager_id")).isBlank() ? null : Db.num(body.get("manager_id"), 0)) : existing.get("manager_id"))
                .addValue("description", body.get("description") != null ? Db.nz(body.get("description")) : existing.get("description"))
                .addValue("progress", body.get("progress") != null ? Db.num(body.get("progress"), 0) : existing.get("progress"));
        jdbc.update("""
            UPDATE projects SET name=:name, client_id=:client_id, type=:type, status=:status, priority=:priority,
              budget=:budget, spent=:spent, start_date=:start_date, shoot_date=:shoot_date, deadline=:deadline,
              manager_id=:manager_id, description=:description, progress=:progress
            WHERE id=:id
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE p.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "project", id, "Updated project '" + row.get("name") + "'");
        return row;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "projects.delete");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM projects WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "project");
        jdbc.update("DELETE FROM projects WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "project", id, "Removed project '" + row.get("name") + "'");
        return Map.of("ok", true);
    }

    /**
     * PATCH /api/projects/{id}/stage — advance the project along the production
     * pipeline: booked → data_copy → lightroom → video → album → final_review → delivered.
     * Only the next stage is allowed; only roles with pipeline.advance may move it
     * (Owner, System Admin, Manager, Quality Controller). "cancelled" is allowed
     * from any stage for owner/admin/manager.
     */
    @PatchMapping("/{id}/stage")
    public Map<String, Object> advanceStage(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                            HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "pipeline.advance");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM projects WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "project");
        String current = String.valueOf(row.get("status"));
        String requested = Db.str(body == null ? null : body.get("status"));
        if (requested.isBlank()) throw new ApiException(400, "Status is required");

        boolean canCancel = Permissions.has(String.valueOf(me.get("role")), "projects.manage");
        if ("cancelled".equals(requested)) {
            if (!canCancel || "delivered".equals(current)) throw new ApiException(400, "Project cannot be cancelled now");
        } else {
            String next = Permissions.nextStage(current);
            if (next == null) throw new ApiException(400, "Project is already " + current + " — no further stage");
            if (!requested.equals(next)) {
                throw new ApiException(400, "Invalid stage move: " + current + " → " + requested +
                        ". The next stage is '" + next + "' (pipeline is sequential).");
            }
        }
        int progress = progressFor(requested);
        jdbc.update("UPDATE projects SET status = :status, progress = :progress WHERE id = :id",
                Map.of("status", requested, "progress", progress, "id", id));
        Map<String, Object> updated = jdbc.queryForMap(SELECT + " WHERE p.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "moved", "project", id,
                "Advanced '" + updated.get("name") + "' to " + requested.replace('_', ' '));
        return updated;
    }

    /** Production-floor roles only see projects they manage or have tasks on. */
    private static boolean isScoped(String role) {
        return "production".equals(role) || "quality".equals(role) || "sales".equals(role);
    }

    private static int progressFor(String stage) {
        int i = Permissions.PIPELINE.indexOf(stage);
        if (i < 0) return 0;
        return Math.round((i / (float) (Permissions.PIPELINE.size() - 1)) * 100);
    }
}
