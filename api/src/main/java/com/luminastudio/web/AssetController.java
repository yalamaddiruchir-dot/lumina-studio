package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.service.ActivityLogService;
import com.luminastudio.util.Db;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * /api/assets — media library (metadata CRUD).
 */
@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public AssetController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT a.*, u.name AS uploader_name, p.name AS project_name
        FROM assets a
        LEFT JOIN users u ON u.id = a.uploaded_by
        LEFT JOIN projects p ON p.id = a.project_id
        """;

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(required = false) String type,
                                          @RequestParam(required = false) String project_id,
                                          @RequestParam(required = false) String q) {
        Auth.require(req, "assets.view");
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (!Auth.isDemo(req)) {
            where.append("a.created_by = :me");
            p.addValue("me", Auth.id(req));
        } else if (isScoped(Auth.role(req))) {
            where.append("(p.manager_id = :uid OR a.project_id IN (SELECT DISTINCT project_id FROM tasks WHERE assignee_id = :uid))");
            p.addValue("uid", Auth.id(req));
        }
        if (type != null && !type.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("a.type = :type");
            p.addValue("type", type);
        }
        if (project_id != null && !project_id.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("a.project_id = :project_id");
            p.addValue("project_id", Integer.parseInt(project_id));
        }
        if (q != null && !q.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("a.name LIKE :q");
            p.addValue("q", "%" + q + "%");
        }
        String sql = SELECT + (where.isEmpty() ? "" : " WHERE " + where) + " ORDER BY a.uploaded_at DESC";
        return jdbc.queryForList(sql, p);
    }

    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
@PostMapping
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "assets.upload");
        String name = Db.str(body.get("name"));
        if (name.isBlank()) throw new ApiException(400, "Asset name is required");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("name", name)
                .addValue("type", Db.str(body.get("type")).isBlank() ? "document" : Db.str(body.get("type")))
                .addValue("project_id", body.get("project_id") != null && !Db.str(body.get("project_id")).isBlank() ? Db.num(body.get("project_id"), 0) : null)
                .addValue("uploaded_by", me.get("id"))
                .addValue("size_mb", Db.dbl(body.get("size_mb"), 0))
                .addValue("hue", ThreadLocalRandom.current().nextInt(360))
                .addValue("tags", Db.nz(body.get("tags")))
                .addValue("description", Db.nz(body.get("description")))
                .addValue("url", Db.nz(body.get("url")))
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO assets (name, type, project_id, uploaded_by, size_mb, hue, tags, description, url, created_by)
            VALUES (:name, :type, :project_id, :uploaded_by, :size_mb, :hue, :tags, :description, :url, :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE a.id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "uploaded", "asset", newId, "Uploaded " + row.get("name"));
        return row;
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "assets.upload");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM assets WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "asset");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", body.get("name") != null ? Db.str(body.get("name")) : existing.get("name"))
                .addValue("type", body.get("type") != null ? Db.str(body.get("type")) : existing.get("type"))
                .addValue("project_id", body.get("project_id") != null ? (Db.str(body.get("project_id")).isBlank() ? null : Db.num(body.get("project_id"), 0)) : existing.get("project_id"))
                .addValue("size_mb", body.get("size_mb") != null ? Db.dbl(body.get("size_mb"), 0) : existing.get("size_mb"))
                .addValue("tags", body.get("tags") != null ? Db.nz(body.get("tags")) : existing.get("tags"))
                .addValue("description", body.get("description") != null ? Db.nz(body.get("description")) : existing.get("description"))
                .addValue("url", body.get("url") != null ? Db.nz(body.get("url")) : existing.get("url"));
        jdbc.update("""
            UPDATE assets SET name=:name, type=:type, project_id=:project_id, size_mb=:size_mb,
              tags=:tags, description=:description, url=:url
            WHERE id=:id
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE a.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "asset", id, "Updated asset " + row.get("name"));
        return row;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "assets.delete");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM assets WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "asset");
        jdbc.update("DELETE FROM assets WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "asset", id, "Removed asset " + row.get("name"));
        return Map.of("ok", true);
    }

    /** Production-floor roles only see their own records. */
    private static boolean isScoped(String role) {
        return "production".equals(role) || "quality".equals(role) || "sales".equals(role);
    }

}
