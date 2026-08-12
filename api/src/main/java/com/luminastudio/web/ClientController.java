package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.service.ActivityLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
import java.util.concurrent.ThreadLocalRandom;

/**
 * /api/clients — CRUD.
 */
@RestController
@RequestMapping("/api/clients")
public class ClientController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public ClientController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String LIST_SQL = """
        SELECT c.*,
          (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count,
          (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id AND p.status != 'completed') AS active_projects,
          (SELECT COALESCE(SUM(p.budget), 0) FROM projects p WHERE p.client_id = c.id) AS total_budget
        FROM clients c
        """;

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req) {
        Auth.require(req, "clients.view");
        if (Auth.isDemo(req)) {
            return jdbc.queryForList(LIST_SQL + " ORDER BY c.created_at DESC", Map.of());
        }
        // Real accounts see only the clients they created — never the demo clients.
        return jdbc.queryForList(LIST_SQL + " WHERE c.created_by = :me ORDER BY c.created_at DESC", Map.of("me", Auth.id(req)));
    }

    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
@PostMapping
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "clients.manage");
        String name = str(body.get("name"));
        if (name.isBlank()) throw new ApiException(400, "Client name is required");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("name", name)
                .addValue("company", nz(body.get("company")))
                .addValue("email", nz(body.get("email")))
                .addValue("phone", nz(body.get("phone")))
                .addValue("industry", nz(body.get("industry")))
                .addValue("status", str(body.get("status")).isBlank() ? "active" : str(body.get("status")))
                .addValue("notes", nz(body.get("notes")))
                .addValue("hue", ThreadLocalRandom.current().nextInt(360))
                .addValue("created_by", me.get("id"));
        int newId = com.luminastudio.util.Db.insert(jdbc, """
            INSERT INTO clients (name, company, email, phone, industry, status, notes, hue, created_by)
            VALUES (:name, :company, :email, :phone, :industry, :status, :notes, :hue, :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM clients WHERE id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "created", "client", row.get("id"), "Added client " + row.get("name"));
        return row;
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "clients.manage");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM clients WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "client");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", body.get("name") != null ? str(body.get("name")) : existing.get("name"))
                .addValue("company", body.get("company") != null ? nz(body.get("company")) : existing.get("company"))
                .addValue("email", body.get("email") != null ? nz(body.get("email")) : existing.get("email"))
                .addValue("phone", body.get("phone") != null ? nz(body.get("phone")) : existing.get("phone"))
                .addValue("industry", body.get("industry") != null ? nz(body.get("industry")) : existing.get("industry"))
                .addValue("status", body.get("status") != null ? str(body.get("status")) : existing.get("status"))
                .addValue("notes", body.get("notes") != null ? nz(body.get("notes")) : existing.get("notes"));
        jdbc.update("""
            UPDATE clients SET name=:name, company=:company, email=:email, phone=:phone,
              industry=:industry, status=:status, notes=:notes
            WHERE id=:id
            """, p);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM clients WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "client", id, "Updated client " + row.get("name"));
        return row;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "clients.manage");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM clients WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "client");
        jdbc.update("DELETE FROM clients WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "client", id, "Removed client " + row.get("name"));
        return Map.of("ok", true);
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }
    private static String nz(Object o) { return o == null ? null : String.valueOf(o); }
}