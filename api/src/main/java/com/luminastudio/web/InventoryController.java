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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

/**
 * Equipment inventory (cameras, hard disks, stands…) with rent per event.
 * Owner manages; Manager can view (to add equipment into estimations).
 */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public InventoryController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final List<String> CATEGORIES = List.of("camera", "hard_disk", "stand", "equipment");

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req) {
        Auth.require(req, "inventory.view");
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = "";
        if (!Auth.isDemo(req)) {
            where = " WHERE i.created_by = :me";
            p.addValue("me", Auth.id(req));
        }
        return jdbc.queryForList("""
            SELECT i.*, u.name AS created_by_name
            FROM inventory i LEFT JOIN users u ON u.id = i.created_by
            """ + where + " ORDER BY i.category, i.name", p);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "inventory.manage");
        String name = Db.str(body == null ? null : body.get("name"));
        if (name.isBlank()) throw new ApiException(400, "Item name is required");
        String category = Db.str(body.get("category"));
        if (!CATEGORIES.contains(category)) category = "equipment";
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("name", name)
                .addValue("category", category)
                .addValue("brand", Db.nz(body.get("brand")))
                .addValue("quantity", Math.max(Db.num(body.get("quantity"), 1), 1))
                .addValue("rent", Math.max(Db.dbl(body.get("rent_per_event"), 0), 0))
                .addValue("notes", Db.nz(body.get("notes")))
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO inventory (name, category, brand, quantity, rent_per_event, notes, created_by)
            VALUES (:name, :category, :brand, :quantity, :rent, :notes, :created_by)
            """, p);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM inventory WHERE id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "added", "inventory", newId, "Added inventory: " + name);
        return row;
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "inventory.manage");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM inventory WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "inventory item");
        String category = Db.str(body.get("category"));
        if (!CATEGORIES.contains(category)) category = String.valueOf(existing.get("category"));
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", body.get("name") != null ? Db.str(body.get("name")) : existing.get("name"))
                .addValue("category", category)
                .addValue("brand", body.get("brand") != null ? Db.nz(body.get("brand")) : existing.get("brand"))
                .addValue("quantity", body.get("quantity") != null ? Math.max(Db.num(body.get("quantity"), 1), 1) : existing.get("quantity"))
                .addValue("rent", body.get("rent_per_event") != null ? Math.max(Db.dbl(body.get("rent_per_event"), 0), 0) : existing.get("rent_per_event"))
                .addValue("notes", body.get("notes") != null ? Db.nz(body.get("notes")) : existing.get("notes"));
        jdbc.update("""
            UPDATE inventory SET name=:name, category=:category, brand=:brand, quantity=:quantity,
              rent_per_event=:rent, notes=:notes WHERE id=:id
            """, p);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM inventory WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "inventory", id, "Updated inventory: " + row.get("name"));
        return row;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "inventory.manage");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM inventory WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "inventory item");
        jdbc.update("DELETE FROM inventory WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "inventory", id, "Removed inventory: " + row.get("name"));
        return Map.of("ok", true);
    }
}
