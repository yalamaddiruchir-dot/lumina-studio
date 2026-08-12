package com.luminastudio.web;

import com.luminastudio.security.Auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * GET /api/calendar?month=YYYY-MM — events for the month grid:
 *   shoots (project.shoot_date), deliveries (project.deadline),
 *   task due dates, invoice due dates.
 * Demo accounts see the whole workspace; real accounts only their own records.
 */
@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final NamedParameterJdbcTemplate jdbc;

    public CalendarController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Map<String, Object> month(HttpServletRequest req, @RequestParam(required = false) String month) {
        Auth.require(req, "projects.view");
        YearMonth ym = month != null && month.matches("\\d{4}-\\d{2}")
                ? YearMonth.parse(month) : YearMonth.now();
        String start = ym.atDay(1).toString();
        String end = ym.atEndOfMonth().toString();

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("start", start).addValue("end", end);
        boolean demo = Auth.isDemo(req);
        if (!demo) {
            p.addValue("me", Auth.id(req));
        }

        List<Map<String, Object>> shoots = jdbc.queryForList("""
            SELECT id, name, shoot_date, status FROM projects
            WHERE shoot_date IS NOT NULL AND shoot_date BETWEEN :start AND :end
            """ + (!demo ? " AND created_by = :me" : "") + " ORDER BY shoot_date", p);

        List<Map<String, Object>> deliveries = jdbc.queryForList("""
            SELECT id, name, deadline, status FROM projects
            WHERE deadline IS NOT NULL AND deadline BETWEEN :start AND :end AND status != 'delivered'
            """ + (!demo ? " AND created_by = :me" : "") + " ORDER BY deadline", p);

        List<Map<String, Object>> tasks = jdbc.queryForList("""
            SELECT t.id, t.title, t.due_date, t.status, p.name AS project_name
            FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
            WHERE t.due_date IS NOT NULL AND t.due_date BETWEEN :start AND :end AND t.status != 'done'
            """ + (!demo ? " AND (t.assignee_id = :me OR t.created_by = :me)" : "") + " ORDER BY t.due_date", p);

        List<Map<String, Object>> invoices = jdbc.queryForList("""
            SELECT i.id, i.invoice_no, i.due_on, i.total_amount, i.balance, i.status, c.name AS client_name
            FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
            WHERE i.due_on IS NOT NULL AND i.due_on BETWEEN :start AND :end AND i.status != 'paid'
            """ + (!demo ? " AND i.created_by = :me" : "") + " ORDER BY i.due_on", p);

        List<Map<String, Object>> events = new ArrayList<>();
        for (Map<String, Object> r : shoots) events.add(event("shoot", r.get("shoot_date"), r.get("name"), "project", r.get("id"), r));
        for (Map<String, Object> r : deliveries) events.add(event("delivery", r.get("deadline"), r.get("name"), "project", r.get("id"), r));
        for (Map<String, Object> r : tasks) events.add(event("task", r.get("due_date"), r.get("title"), "task", r.get("id"), r));
        for (Map<String, Object> r : invoices) events.add(event("invoice", r.get("due_on"), "Invoice " + r.get("invoice_no") + " — " + r.get("client_name"), "invoice", r.get("id"), r));

        return Map.of(
                "month", ym.toString(),
                "start", start,
                "end", end,
                "events", events,
                "counts", Map.of(
                        "shoots", shoots.size(),
                        "deliveries", deliveries.size(),
                        "tasks", tasks.size(),
                        "invoices", invoices.size()));
    }

    private static Map<String, Object> event(String type, Object date, Object title, String linkType, Object linkId, Map<String, Object> row) {
        return Map.of(
                "type", type,
                "date", String.valueOf(date),
                "title", String.valueOf(title),
                "link_type", linkType,
                "link_id", linkId,
                "detail", row);
    }
}
