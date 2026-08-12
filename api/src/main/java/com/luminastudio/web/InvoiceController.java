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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GST invoicing & payment tracking.
 *
 * Invoice status flow: draft → sent → partial (advance/instalment received)
 * → paid. Overdue is derived when a sent/partial invoice passes its due date.
 *
 * Only roles with invoices.manage create/update invoices and record payments
 * (Owner, System Admin, Finance). invoices.view is read-only for Manager/Sales.
 */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private static final double[] GST_RATES = {0, 5, 12, 18, 28};

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public InvoiceController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static final String SELECT = """
        SELECT i.*, p.name AS project_name, c.name AS client_name
        FROM invoices i
        LEFT JOIN projects p ON p.id = i.project_id
        LEFT JOIN clients c ON c.id = i.client_id
        """;

    /** Derives the display status, marking overdue when past due and unpaid. */
    private Map<String, Object> decorate(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        String status = String.valueOf(row.get("status"));
        double balance = Db.dbl(row.get("balance"), 0);
        if (!"paid".equals(status)) {
            String due = row.get("due_on") == null ? null : String.valueOf(row.get("due_on"));
            if (due != null && due.compareTo(LocalDate.now().toString()) < 0) {
                out.put("status", "overdue");
                return out;
            }
        }
        out.put("status", balance <= 0 ? "paid" : status);
        return out;
    }

    private void requireProjectAccess(int projectId, HttpServletRequest req) {
        Map<String, Object> proj = jdbc.queryForMap("SELECT * FROM projects WHERE id = :id", Map.of("id", projectId));
        Auth.requireOwnership(req, proj, "project");
    }

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(required = false) String project_id) {
        Auth.require(req, "invoices.view");
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (!Auth.isDemo(req)) {
            where.append("i.created_by = :me");
            p.addValue("me", Auth.id(req));
        }
        if (status != null && !status.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("i.status = :status");
            p.addValue("status", status);
        }
        if (project_id != null && !project_id.isBlank()) {
            if (!where.isEmpty()) where.append(" AND ");
            where.append("i.project_id = :project_id");
            p.addValue("project_id", Integer.parseInt(project_id));
        }
        String sql = SELECT + (where.isEmpty() ? "" : " WHERE " + where) + " ORDER BY i.created_at DESC";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, p);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) out.add(decorate(r));
        return out;
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable int id, HttpServletRequest req) {
        Auth.require(req, "invoices.view");
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE i.id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "invoice");
        Map<String, Object> out = decorate(row);
        out.put("payments", jdbc.queryForList(
                "SELECT p.*, u.name AS recorded_by_name FROM payments p LEFT JOIN users u ON u.id = p.recorded_by WHERE p.invoice_id = :id ORDER BY p.paid_on DESC, p.id DESC",
                Map.of("id", id)));
        return out;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "invoices.manage");
        int projectId = Db.num(body == null ? null : body.get("project_id"), 0);
        if (projectId <= 0) throw new ApiException(400, "A project is required");
        requireProjectAccess(projectId, req);

        double base = Math.max(Db.dbl(body.get("base_amount"), 0), 0);
        double gstRate = pickGst(Db.dbl(body.get("gst_rate"), 18));
        double gst = Math.round(base * gstRate / 100.0 * 100.0) / 100.0;
        double total = base + gst;
        double advance = Math.min(Math.max(Db.dbl(body.get("advance_paid"), 0), 0), total);

        Map<String, Object> proj = jdbc.queryForMap("SELECT client_id FROM projects WHERE id = :id", Map.of("id", projectId));
        String year = String.valueOf(LocalDate.now().getYear());
        Number n = jdbc.queryForObject("SELECT COUNT(*) FROM invoices WHERE invoice_no LIKE :like", Map.of("like", "INV-" + year + "-%"), Number.class);
        int seq = (n == null ? 0 : n.intValue()) + 1;
        String invoiceNo = String.format("INV-%s-%04d", year, seq);

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("project_id", projectId)
                .addValue("client_id", proj.get("client_id"))
                .addValue("invoice_no", invoiceNo)
                .addValue("issued_on", Db.nz(body.get("issued_on")))
                .addValue("due_on", Db.nz(body.get("due_on")))
                .addValue("base_amount", base)
                .addValue("gst_rate", gstRate)
                .addValue("gst_amount", gst)
                .addValue("total_amount", total)
                .addValue("advance_paid", advance)
                .addValue("balance", Math.round((total - advance) * 100.0) / 100.0)
                .addValue("status", advance > 0 ? "partial" : "draft")
                .addValue("notes", Db.nz(body.get("notes")))
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO invoices (project_id, client_id, invoice_no, issued_on, due_on, base_amount,
                                  gst_rate, gst_amount, total_amount, advance_paid, balance, status, notes, created_by)
            VALUES (:project_id, :client_id, :invoice_no, :issued_on, :due_on, :base_amount,
                    :gst_rate, :gst_amount, :total_amount, :advance_paid, :balance, :status, :notes, :created_by)
            """, p);

        if (advance > 0) {
            jdbc.update("""
                INSERT INTO payments (invoice_id, amount, paid_on, method, notes, recorded_by)
                VALUES (:iid, :amt, :date, 'cash', 'Advance payment', :uid)
                """, new MapSqlParameterSource()
                    .addValue("iid", newId).addValue("amt", advance)
                    .addValue("date", Db.nz(body.get("issued_on")) == null ? LocalDate.now().toString() : Db.nz(body.get("issued_on")))
                    .addValue("uid", me.get("id")));
        }

        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE i.id = :id", Map.of("id", newId));
        activity.log((Integer) me.get("id"), "created", "invoice", newId,
                "Created invoice " + invoiceNo + " for " + row.get("project_name") + " (₹" + Math.round(total) + ")");
        return decorate(row);
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "invoices.manage");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM invoices WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "invoice");
        String status = Db.str(body.get("status"));
        if (!status.isBlank() && !List.of("draft", "sent", "paid", "cancelled").contains(status)) {
            throw new ApiException(400, "Invalid invoice status");
        }
        if ("paid".equals(status) && Db.dbl(existing.get("balance"), 0) > 0) {
            throw new ApiException(400, "Outstanding balance must be settled with a payment first");
        }
        if (!status.isBlank()) {
            jdbc.update("UPDATE invoices SET status = :status WHERE id = :id", Map.of("status", status, "id", id));
        }
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE i.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "updated", "invoice", id,
                "Invoice " + row.get("invoice_no") + (status.isBlank() ? " updated" : " → " + status));
        return decorate(row);
    }

    /** POST /api/invoices/{id}/payments — record a payment and recompute advance/balance/status. */
    @PostMapping("/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> pay(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                   HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "invoices.manage");
        Map<String, Object> inv = jdbc.queryForMap("SELECT * FROM invoices WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, inv, "invoice");

        double amount = Math.max(Db.dbl(body == null ? null : body.get("amount"), 0), 0);
        if (amount <= 0) throw new ApiException(400, "Payment amount must be greater than zero");
        double remaining = Db.dbl(inv.get("balance"), 0);
        if (amount > remaining) throw new ApiException(400, "Payment exceeds the outstanding balance (₹" + Math.round(remaining) + ")");

        String paidOn = Db.nz(body.get("paid_on"));
        if (paidOn == null) paidOn = LocalDate.now().toString();
        jdbc.update("""
            INSERT INTO payments (invoice_id, amount, paid_on, method, reference, notes, recorded_by)
            VALUES (:iid, :amount, :paid_on, :method, :reference, :notes, :uid)
            """, new MapSqlParameterSource()
                .addValue("iid", id).addValue("amount", amount).addValue("paid_on", paidOn)
                .addValue("method", Db.str(body.get("method")).isBlank() ? "cash" : Db.str(body.get("method")))
                .addValue("reference", Db.nz(body.get("reference")))
                .addValue("notes", Db.nz(body.get("notes")))
                .addValue("uid", me.get("id")));

        double newAdvance = Math.round((Db.dbl(inv.get("advance_paid"), 0) + amount) * 100.0) / 100.0;
        double newBalance = Math.round((Db.dbl(inv.get("total_amount"), 0) - newAdvance) * 100.0) / 100.0;
        String newStatus = newBalance <= 0 ? "paid" : "partial";
        jdbc.update("UPDATE invoices SET advance_paid = :adv, balance = :bal, status = :status WHERE id = :id",
                Map.of("adv", newAdvance, "bal", newBalance, "status", newStatus, "id", id));

        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE i.id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "received", "payment", id,
                "Received ₹" + Math.round(amount) + " on " + row.get("invoice_no"));
        return decorate(row);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "invoices.manage");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM invoices WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "invoice");
        if (!"draft".equals(row.get("status"))) {
            throw new ApiException(400, "Only draft invoices can be deleted");
        }
        jdbc.update("DELETE FROM invoices WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "invoice", id, "Removed invoice " + row.get("invoice_no"));
        return Map.of("ok", true);
    }

    private static double pickGst(double requested) {
        for (double r : GST_RATES) if (Math.abs(r - requested) < 0.01) return r;
        return 18;
    }
}
