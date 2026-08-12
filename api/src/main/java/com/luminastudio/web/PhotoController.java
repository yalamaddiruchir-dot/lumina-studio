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
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Client photo gallery & album approval.
 *
 * Workflow per photo: uploaded → selected (client-facing role marks favourites)
 * → approved (QC/Owner/Manager signs off for the album).
 *
 * Demo accounts see photos on their whole workspace; real (signed-up) accounts
 * only see photos on orders they created.
 */
@RestController
@RequestMapping("/api")
public class PhotoController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public PhotoController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT ph.*, u.name AS uploader_name
        FROM photos ph LEFT JOIN users u ON u.id = ph.uploaded_by
        """;

    private void requireProjectAccess(int projectId, HttpServletRequest req) {
        Map<String, Object> proj = jdbc.queryForMap("SELECT * FROM projects WHERE id = :id", Map.of("id", projectId));
        Auth.requireOwnership(req, proj, "project");
    }

    @GetMapping("/projects/{id}/photos")
    public List<Map<String, Object>> list(@PathVariable int id, HttpServletRequest req,
                                          @RequestParam(required = false) String status) {
        Auth.require(req, "projects.view");
        requireProjectAccess(id, req);
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("pid", id);
        String where = " WHERE ph.project_id = :pid";
        if (status != null && !status.isBlank()) {
            where += " AND ph.status = :status";
            p.addValue("status", status);
        }
        return jdbc.queryForList(SELECT + where + " ORDER BY ph.status, ph.captured_on DESC, ph.id DESC", p);
    }

    @PostMapping("/projects/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> upload(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "assets.upload");
        requireProjectAccess(id, req);
        String name = Db.str(body.get("name"));
        if (name.isBlank()) throw new ApiException(400, "Photo name is required");
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("project_id", id)
                .addValue("name", name)
                .addValue("url", Db.nz(body.get("url")))
                .addValue("category", Db.nz(body.get("category")))
                .addValue("size_mb", Db.dbl(body.get("size_mb"), 0))
                .addValue("captured_on", Db.nz(body.get("captured_on")))
                .addValue("uploaded_by", me.get("id"))
                .addValue("created_by", me.get("id"))
                .addValue("hue", ThreadLocalRandom.current().nextInt(360));
        int newId = Db.insert(jdbc, """
            INSERT INTO photos (project_id, name, url, category, size_mb, captured_on, uploaded_by, created_by)
            VALUES (:project_id, :name, :url, :category, :size_mb, :captured_on, :uploaded_by, :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE ph.id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "uploaded", "photo", newId, "Uploaded " + row.get("name") + " to the gallery");
        return row;
    }

    /**
     * PATCH /api/photos/{id} — move a photo along the gallery workflow:
     *   uploaded → selected  (client-facing roles / uploader)
     *   selected → approved  (pipeline.advance roles: Owner, Admin, Manager, QC)
     */
    @PatchMapping("/photos/{id}")
    public Map<String, Object> move(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                    HttpServletRequest req) {
        Map<String, Object> me = Auth.user(req);
        Map<String, Object> photo = jdbc.queryForMap("SELECT * FROM photos WHERE id = :id", Map.of("id", id));
        requireProjectAccess(((Number) photo.get("project_id")).intValue(), req);
        Auth.requireOwnership(req, photo, "photo");

        String status = Db.str(body == null ? null : body.get("status"));
        String current = String.valueOf(photo.get("status"));
        boolean isUploader = photo.get("uploaded_by") != null
                && ((Number) photo.get("uploaded_by")).intValue() == ((Number) me.get("id")).intValue();

        if (status.isBlank() || status.equals(current)) {
            throw new ApiException(400, "Status is required and must change");
        }
        if (!List.of("uploaded", "selected", "approved").contains(status)) {
            throw new ApiException(400, "Invalid photo status");
        }

        if ("approved".equals(status)) {
            // Final sign-off for the album — only pipeline.advance roles.
            if (!Permissions.has(String.valueOf(me.get("role")), "pipeline.advance")) {
                throw new ApiException(403, "Only Owner, Manager or Quality Control can approve photos");
            }
            if (!"selected".equals(current)) {
                throw new ApiException(400, "Photos must be selected by the client before approval");
            }
        } else {
            // uploaded ↔ selected: uploader or a client-facing role (Sales / Manager / Admin / Owner).
            boolean canSelect = isUploader || Permissions.has(String.valueOf(me.get("role")), "clients.manage")
                    || Permissions.has(String.valueOf(me.get("role")), "pipeline.advance");
            if (!canSelect) {
                throw new ApiException(403, "You cannot change this photo's selection status");
            }
            if ("uploaded".equals(status) && !isUploader && !Permissions.has(String.valueOf(me.get("role")), "pipeline.advance")) {
                throw new ApiException(403, "Only the uploader can revert a selection");
            }
        }

        jdbc.update("UPDATE photos SET status = :status WHERE id = :id", Map.of("status", status, "id", id));
        Map<String, Object> updated = jdbc.queryForMap(SELECT + " WHERE ph.id = :id", Map.of("id", id));
        String action = "selected".equals(status) ? "selected" : "approved";
        activity.log((Integer) me.get("id"), action, "photo", id,
                (String) updated.get("name") + " marked " + status + " in the gallery");
        return updated;
    }

    @DeleteMapping("/photos/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.user(req);
        Map<String, Object> photo = jdbc.queryForMap("SELECT * FROM photos WHERE id = :id", Map.of("id", id));
        requireProjectAccess(((Number) photo.get("project_id")).intValue(), req);
        Auth.requireOwnership(req, photo, "photo");
        boolean isUploader = photo.get("uploaded_by") != null
                && ((Number) photo.get("uploaded_by")).intValue() == ((Number) me.get("id")).intValue();
        if (!isUploader && !Permissions.has(String.valueOf(me.get("role")), "assets.delete")) {
            throw new ApiException(403, "You can only delete photos you uploaded");
        }
        jdbc.update("DELETE FROM photos WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "photo", id, "Removed " + photo.get("name") + " from the gallery");
        return Map.of("ok", true);
    }
}
