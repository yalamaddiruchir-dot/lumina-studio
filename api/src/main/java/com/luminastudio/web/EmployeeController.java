package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.security.JwtService;
import com.luminastudio.security.Permissions;
import com.luminastudio.service.ActivityLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * /api/employees — CRUD with role-gated salary visibility.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final NamedParameterJdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final ActivityLogService activity;

    public EmployeeController(NamedParameterJdbcTemplate jdbc, PasswordEncoder passwordEncoder,
                              ActivityLogService activity) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.activity = activity;
    }

    private static final String LIST_SQL = """
        SELECT u.*,
          (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status != 'done') AS open_tasks,
          (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id) AS total_tasks,
          (SELECT COUNT(*) FROM projects p WHERE p.manager_id = u.id) AS managed_projects
        FROM users u
        ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2
                  WHEN 'hr' THEN 3 WHEN 'finance' THEN 4 ELSE 5 END, u.name
        """;

    /** Access-control matrix for the "Access Control" page. */
    @GetMapping("/meta/roles")
    public Map<String, Object> roles(HttpServletRequest req) {
        Auth.require(req, "access.view");
        return Permissions.meta();
    }

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req) {
        Auth.require(req, "employees.view");
        String viewer = Auth.role(req);
        // Real accounts get an isolated workspace: they only see their own profile
        // (the org chart roster is part of the demo workspace).
        if (!Auth.isDemo(req)) {
            Map<String, Object> me = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", Auth.id(req)));
            return List.of(Auth.serializeUser(me, viewer));
        }
        List<Map<String, Object>> rows = jdbc.queryForList(LIST_SQL, Map.of());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> u = Auth.serializeUser(r, viewer);
            u.put("open_tasks", r.get("open_tasks"));
            u.put("total_tasks", r.get("total_tasks"));
            u.put("managed_projects", r.get("managed_projects"));
            out.add(u);
        }
        return out;
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable int id, HttpServletRequest req) {
        Auth.require(req, "employees.view");
        if (!Auth.isDemo(req) && id != Auth.id(req)) {
            throw new ApiException(403, "You can only view your own profile");
        }
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", id));
        return Auth.serializeUser(row, Auth.role(req));
    }

    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
@PostMapping
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Auth.require(req, "employees.manage");
        Map<String, Object> me = Auth.user(req);
        String name = str(body.get("name"));
        String email = str(body.get("email")).toLowerCase();
        if (name.isBlank() || email.isBlank()) throw new ApiException(400, "Name and email are required");
        List<Map<String, Object>> dup = jdbc.queryForList("SELECT id FROM users WHERE email = :email", Map.of("email", email));
        if (!dup.isEmpty()) throw new ApiException(400, "An account with this email already exists");

        String password = body.get("password") == null ? "demo123" : String.valueOf(body.get("password"));
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("name", name)
                .addValue("email", email)
                .addValue("hash", passwordEncoder.encode(password))
                .addValue("role", str(body.get("role")).isBlank() ? "production" : str(body.get("role")))
                .addValue("department", nz(body.get("department")))
                .addValue("position", nz(body.get("position")))
                .addValue("phone", nz(body.get("phone")))
                .addValue("location", nz(body.get("location")))
                .addValue("bio", nz(body.get("bio")))
                .addValue("skills", nz(body.get("skills")))
                .addValue("salary", body.get("salary") == null ? 0 : Math.round(Double.parseDouble(String.valueOf(body.get("salary")))))
                .addValue("hire_date", nz(body.get("hire_date")))
                .addValue("status", str(body.get("status")).isBlank() ? "active" : str(body.get("status")))
                .addValue("hue", ThreadLocalRandom.current().nextInt(360));
        jdbc.update("""
            INSERT INTO users (name, email, password_hash, role, department, position, phone, location,
                               bio, skills, salary, hire_date, status, avatar_hue)
            VALUES (:name, :email, :hash, :role, :department, :position, :phone, :location,
                    :bio, :skills, :salary, :hire_date, :status, :hue)
            """, p);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM users WHERE email = :email", Map.of("email", email));
        activity.log((Integer) me.get("id"), "added", "employee", row.get("id"),
                "Added " + row.get("name") + " as " + (row.get("position") == null ? row.get("role") : row.get("position")));
        return Auth.serializeUser(row, Auth.role(req));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Auth.require(req, "employees.manage");
        Map<String, Object> me = Auth.user(req);
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", id));
        String email = body.get("email") != null ? str(body.get("email")).toLowerCase() : str(existing.get("email"));
        List<Map<String, Object>> dup = jdbc.queryForList("SELECT id FROM users WHERE email = :email AND id != :id",
                Map.of("email", email, "id", id));
        if (!dup.isEmpty()) throw new ApiException(400, "Another account already uses this email");

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", body.get("name") != null ? str(body.get("name")) : existing.get("name"))
                .addValue("email", email)
                .addValue("role", body.get("role") != null ? str(body.get("role")) : existing.get("role"))
                .addValue("department", body.get("department") != null ? nz(body.get("department")) : existing.get("department"))
                .addValue("position", body.get("position") != null ? nz(body.get("position")) : existing.get("position"))
                .addValue("phone", body.get("phone") != null ? nz(body.get("phone")) : existing.get("phone"))
                .addValue("location", body.get("location") != null ? nz(body.get("location")) : existing.get("location"))
                .addValue("bio", body.get("bio") != null ? nz(body.get("bio")) : existing.get("bio"))
                .addValue("skills", body.get("skills") != null ? nz(body.get("skills")) : existing.get("skills"))
                .addValue("salary", body.get("salary") != null ? Math.round(Double.parseDouble(String.valueOf(body.get("salary")))) : existing.get("salary"))
                .addValue("hire_date", body.get("hire_date") != null ? nz(body.get("hire_date")) : existing.get("hire_date"))
                .addValue("status", body.get("status") != null ? str(body.get("status")) : existing.get("status"));
        jdbc.update("""
            UPDATE users SET name=:name, email=:email, role=:role, department=:department, position=:position,
              phone=:phone, location=:location, bio=:bio, skills=:skills, salary=:salary,
              hire_date=:hire_date, status=:status
            WHERE id=:id
            """, p);
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "employee", id, "Updated " + row.get("name"));
        return Auth.serializeUser(row, Auth.role(req));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "employees.delete");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM users WHERE id = :id", Map.of("id", id));
        if ("owner".equals(row.get("role"))) throw new ApiException(400, "The owner account cannot be removed");
        if (id == ((Number) me.get("id")).intValue()) throw new ApiException(400, "You cannot remove your own account");
        jdbc.update("DELETE FROM users WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "employee", id, "Removed " + row.get("name"));
        return Map.of("ok", true);
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }
    private static String nz(Object o) { return o == null ? null : String.valueOf(o); }
}
