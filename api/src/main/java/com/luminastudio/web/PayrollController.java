package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.service.ActivityLogService;
import com.luminastudio.util.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * /api/payroll — finance/owner manage, admin views.
 */
@RestController
@RequestMapping("/api/payroll")
public class PayrollController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public PayrollController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT py.*, u.name AS user_name, u.role, u.department, u.avatar_hue
        FROM payroll py JOIN users u ON u.id = py.user_id
        """;

    @GetMapping
    public Map<String, Object> list(HttpServletRequest req, @RequestParam(required = false) String month) {
        Auth.require(req, "payroll.view");
        boolean demo = Auth.isDemo(req);
        boolean hasMonth = month != null && !month.isBlank();
        StringBuilder sql = new StringBuilder(SELECT);
        java.util.List<Object> p = new java.util.ArrayList<>();
        if (!demo) {
            sql.append(" WHERE (py.user_id = ? OR py.created_by = ?)");
            p.add(Auth.id(req));
            p.add(Auth.id(req));
        }
        if (hasMonth) {
            sql.append(demo ? " WHERE" : " AND").append(" py.month = ?");
            p.add(month);
        }
        sql.append(" ORDER BY py.month DESC, u.name");
        List<Map<String, Object>> rows = jdbc.getJdbcTemplate().queryForList(sql.toString(), p.toArray());
        List<Map<String, Object>> months = jdbc.queryForList("SELECT DISTINCT month FROM payroll ORDER BY month DESC", Map.of());
        List<String> monthList = months.stream().map(m -> String.valueOf(m.get("month"))).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("months", monthList);
        return out;
    }

    @PatchMapping("/{id}/status")
    public Map<String, Object> move(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                    HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "payroll.manage");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM payroll WHERE id = :id", Map.of("id", id));
        String status = Db.str(body.get("status"));
        if (!List.of("draft", "paid").contains(status)) throw new ApiException(400, "Invalid status");
        jdbc.update("""
            UPDATE payroll SET status = :status,
              paid_at = CASE WHEN :status = 'paid' THEN NOW() ELSE NULL END
            WHERE id = :id
            """, Map.of("status", status, "id", id));
        Map<String, Object> updated = jdbc.queryForMap(SELECT + " WHERE py.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), status, "payroll", id,
                ("paid".equals(status) ? "Marked paid" : "Returned to draft") + ": " + updated.get("user_name") + " — " + updated.get("month"));
        return updated;
    }
}
