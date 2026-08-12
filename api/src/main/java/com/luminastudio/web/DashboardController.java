package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.security.Permissions;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/dashboard — single aggregate endpoint, role-aware.
 * Demo accounts see the whole seeded workspace; real (signed-up) accounts see
 * only their own workspace (never the mock data).
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final NamedParameterJdbcTemplate jdbc;

    public DashboardController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Map<String, Object> index(HttpServletRequest req) {
        Map<String, Object> me = Auth.user(req);
        String role = String.valueOf(me.get("role"));
        int uid = ((Number) me.get("id")).intValue();
        boolean demo = Auth.isDemo(req);
        boolean isStaff = isScoped(role);
        String today = LocalDate.now().toString();
        String from14 = LocalDate.now().minusDays(14).toString();
        String from7 = LocalDate.now().minusDays(7).toString();

        // Real accounts: everything scoped to records they created/own.
        String taskScope = !demo ? "AND (assignee_id = :uid OR created_by = :uid)"
                : (isStaff ? "AND (assignee_id = :uid OR assignee_id IS NULL)" : "");
        String projScope = !demo ? "AND p.created_by = :uid"
                : (isStaff ? "AND (p.manager_id = :uid OR p.id IN (SELECT DISTINCT project_id FROM tasks WHERE assignee_id = :uid))" : "");
        String tsScope = !demo ? "AND (user_id = :uid OR created_by = :uid)" : "";
        Map<String, Object> p = (isStaff || !demo) ? Map.of("uid", uid) : Map.of();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("active_projects", count("SELECT COUNT(*) FROM projects p WHERE p.status != 'completed' " + projScope, p));
        stats.put("open_tasks", count("SELECT COUNT(*) FROM tasks t WHERE t.status != 'done' " + taskScope, p));
        stats.put("my_due_tasks", count("SELECT COUNT(*) FROM tasks t WHERE t.status != 'done' AND t.assignee_id = :uid AND t.due_date <= :today",
                Map.of("uid", uid, "today", today)));
        stats.put("pending_timesheets",
                demo && Permissions.has(role, "timesheets.approve")
                        ? count("SELECT COUNT(*) FROM timesheets WHERE status = 'pending'", Map.of())
                        : count("SELECT COUNT(*) FROM timesheets WHERE status = 'pending' " + tsScope, p));
        stats.put("headcount", demo
                ? count("SELECT COUNT(*) FROM users WHERE status = 'active'", Map.of())
                : count("SELECT COUNT(*) FROM users WHERE id = :uid", Map.of("uid", uid)));
        stats.put("active_clients", demo
                ? count("SELECT COUNT(*) FROM clients WHERE status = 'active'", Map.of())
                : count("SELECT COUNT(*) FROM clients WHERE status = 'active' AND created_by = :uid", Map.of("uid", uid)));
        stats.put("projects_completed", count("SELECT COUNT(*) FROM projects p WHERE p.status = 'completed' " + projScope, p));

        List<Map<String, Object>> statusDist = jdbc.queryForList(
                "SELECT status, COUNT(*) c FROM projects p WHERE 1=1 " + projScope + " GROUP BY status", p);

        List<Map<String, Object>> budgetVsSpent = jdbc.queryForList(
                "SELECT name, budget, spent FROM projects p WHERE 1=1 " + projScope + " ORDER BY budget DESC LIMIT 7", p);

        // Tasks completed per day, last 14 days
        Map<String, Object> completedParams = new LinkedHashMap<>();
        completedParams.put("from", from14);
        if (!taskScope.isEmpty()) completedParams.put("uid", uid);
        List<Map<String, Object>> completed = jdbc.queryForList(
                "SELECT DATE(completed_at) d, COUNT(*) c FROM tasks WHERE completed_at IS NOT NULL AND DATE(completed_at) >= :from " + taskScope + " GROUP BY d",
                completedParams);
        Map<String, Long> dayMap = new LinkedHashMap<>();
        for (int i = 13; i >= 0; i--) dayMap.put(LocalDate.now().minusDays(i).toString(), 0L);
        for (Map<String, Object> r : completed) {
            String d = String.valueOf(r.get("d"));
            if (dayMap.containsKey(d)) dayMap.put(d, ((Number) r.get("c")).longValue());
        }
        List<Map<String, Object>> tasks14d = new ArrayList<>();
        for (Map.Entry<String, Long> e : dayMap.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey().substring(5));
            m.put("count", e.getValue());
            tasks14d.add(m);
        }

        List<Map<String, Object>> upcoming = jdbc.queryForList("""
            SELECT p.id, p.name, p.deadline, p.priority, p.progress, c.name AS client_name
            FROM projects p LEFT JOIN clients c ON c.id = p.client_id
            WHERE p.status != 'completed' AND p.deadline IS NOT NULL
            """ + projScope + " ORDER BY p.deadline ASC LIMIT 6", p);

        List<Map<String, Object>> activity = demo
                ? jdbc.queryForList("""
                    SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.avatar_hue
                    FROM activity a LEFT JOIN users u ON u.id = a.user_id
                    ORDER BY a.created_at DESC LIMIT 9
                    """, Map.of())
                : jdbc.queryForList("""
                    SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.avatar_hue
                    FROM activity a LEFT JOIN users u ON u.id = a.user_id
                    WHERE a.user_id = :uid
                    ORDER BY a.created_at DESC LIMIT 9
                    """, Map.of("uid", uid));

        List<Map<String, Object>> workload = demo
                ? jdbc.queryForList("""
                    SELECT u.id, u.name, u.avatar_hue, u.department, COUNT(t.id) AS open
                    FROM users u JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
                    GROUP BY u.id ORDER BY open DESC LIMIT 6
                    """, Map.of())
                : jdbc.queryForList("""
                    SELECT u.id, u.name, u.avatar_hue, u.department, COUNT(t.id) AS open
                    FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
                    WHERE u.id = :uid GROUP BY u.id
                    """, Map.of("uid", uid));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stats", stats);
        out.put("status_dist", statusDist);
        out.put("budget_vs_spent", budgetVsSpent);
        out.put("tasks_14d", tasks14d);
        out.put("upcoming", upcoming);
        out.put("activity", activity);
        out.put("workload", workload);
        out.put("myHoursThisWeek", count(
                "SELECT COALESCE(SUM(hours),0) FROM timesheets WHERE user_id = :uid AND date >= :from",
                Map.of("uid", uid, "from", from7)));
        out.put("myPending", count("SELECT COUNT(*) FROM timesheets WHERE user_id = :uid AND status = 'pending'",
                Map.of("uid", uid)));
        return out;
    }

    private long count(String sql, Map<String, Object> params) {
        Number n = jdbc.queryForObject(sql, params, Number.class);
        return n == null ? 0 : n.longValue();
    }

    /** Production-floor roles only see their own records. */
    private static boolean isScoped(String role) {
        return "production".equals(role) || "quality".equals(role) || "sales".equals(role);
    }

}
