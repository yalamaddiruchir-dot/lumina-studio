package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.service.ActivityLogService;
import com.luminastudio.util.Db;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cost estimations for events (Owner / Manager).
 *
 * Estimation = cameras × camera_rate × days
 *            + team_members × employee_rate × days
 *            + equipment (inventory rent × qty × days)
 *            + extras
 *            + GST (18% default) → total.
 *
 * A printable PDF (company name, license, breakdown, terms) is generated with OpenPDF.
 */
@RestController
@RequestMapping("/api/estimates")
public class EstimateController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ActivityLogService activity;

    public EstimateController(NamedParameterJdbcTemplate jdbc, ActivityLogService activity) {
        this.jdbc = jdbc;
        this.activity = activity;
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : v;
    }

    private static final String SELECT = """
        SELECT e.*, c.name AS client_name, c.phone AS client_phone,
          (SELECT COUNT(*) FROM estimate_employees ee WHERE ee.estimate_id = e.id) AS team_count,
          (SELECT COUNT(*) FROM estimate_equipment eq WHERE eq.estimate_id = e.id) AS equipment_count
        FROM estimates e
        LEFT JOIN clients c ON c.id = e.client_id
        """;

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req) {
        Auth.require(req, "estimates.view");
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = "";
        if (!Auth.isDemo(req)) {
            where = " WHERE e.created_by = :me";
            p.addValue("me", Auth.id(req));
        }
        return jdbc.queryForList(SELECT + where + " ORDER BY e.created_at DESC", p);
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable int id, HttpServletRequest req) {
        Auth.require(req, "estimates.view");
        Map<String, Object> row = jdbc.queryForMap(SELECT + " WHERE e.id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "estimate");
        row.put("team", jdbc.queryForList("""
            SELECT u.id, u.name, u.role, u.department, u.position, u.avatar_hue
            FROM estimate_employees ee JOIN users u ON u.id = ee.user_id
            WHERE ee.estimate_id = :id ORDER BY u.name
            """, Map.of("id", id)));
        row.put("equipment", jdbc.queryForList("""
            SELECT eq.inventory_id, eq.name, eq.qty, eq.rent
            FROM estimate_equipment eq WHERE eq.estimate_id = :id ORDER BY eq.name
            """, Map.of("id", id)));
        return row;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "estimates.manage");
        String eventName = Db.str(body == null ? null : body.get("event_name"));
        if (eventName.isBlank()) throw new ApiException(400, "Event name is required");
        Integer clientId = body.get("client_id") == null ? null : Db.num(body.get("client_id"), 0);

        int days = Math.max(Db.num(body.get("days"), 1), 1);
        int cameras = Math.max(Db.num(body.get("cameras"), 0), 0);
        double cameraRate = Math.max(Db.dbl(body.get("camera_rate"), 0), 0);
        double employeeRate = Math.max(Db.dbl(body.get("employee_rate"), 0), 0);
        double extrasCost = Math.max(Db.dbl(body.get("extras_cost"), 0), 0);
        String extrasLabel = Db.nz(body.get("extras_label"));
        double gstRate = Math.max(Db.dbl(body.get("gst_rate"), 18), 0);

        // Selected employees
        List<Integer> employeeIds = new ArrayList<>();
        Object emps = body == null ? null : body.get("employee_ids");
        if (emps instanceof List<?> el) {
            for (Object o : el) {
                try { employeeIds.add(Integer.parseInt(String.valueOf(o))); } catch (Exception ignored) {}
            }
        }
        // Equipment (inventory) selections
        List<Map<String, Object>> equipment = new ArrayList<>();
        Object eqs = body == null ? null : body.get("equipment");
        if (eqs instanceof List<?> el) {
            for (Object o : el) {
                if (o instanceof Map<?, ?> m) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("inventory_id", Db.num(m.get("id"), 0));
                    item.put("qty", Math.max(Db.num(m.get("qty"), 1), 1));
                    equipment.add(item);
                }
            }
        }

        // Validate employees are actually available on the event date
        String eventDate = Db.nz(body.get("event_date"));
        if (eventDate != null && !employeeIds.isEmpty()) {
            Map<String, Object> avail = availability(eventDate);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> availList = (List<Map<String, Object>>) avail.get("available");
            java.util.Set<Integer> ok = new java.util.HashSet<>();
            for (Map<String, Object> a : availList) ok.add(((Number) a.get("id")).intValue());
            List<Integer> unavailable = employeeIds.stream().filter(id -> !ok.contains(id)).toList();
            if (!unavailable.isEmpty()) {
                throw new ApiException(400, "Selected team member(s) are already booked on " + eventDate + " — pick from the available list.");
            }
        }

        // Costing
        double cameraCost = cameras * cameraRate * days;
        double employeeCost = employeeIds.size() * employeeRate * days;
        double equipmentCost = 0;
        for (Map<String, Object> item : equipment) {
            Map<String, Object> inv = jdbc.queryForMap(
                    "SELECT name, rent_per_event FROM inventory WHERE id = :id", Map.of("id", item.get("inventory_id")));
            double rent = Db.dbl(inv.get("rent_per_event"), 0);
            int qty = (Integer) item.get("qty");
            equipmentCost += rent * qty * days;
            item.put("name", inv.get("name"));
            item.put("rent", rent);
        }
        double subtotal = Math.round((cameraCost + employeeCost + equipmentCost + extrasCost) * 100.0) / 100.0;
        double gstAmount = Math.round(subtotal * gstRate / 100.0 * 100.0) / 100.0;
        double total = Math.round((subtotal + gstAmount) * 100.0) / 100.0;

        String year = String.valueOf(LocalDate.now().getYear());
        Number n = jdbc.queryForObject("SELECT COUNT(*) FROM estimates WHERE estimate_no LIKE :like",
                Map.of("like", "EST-" + year + "-%"), Number.class);
        String estimateNo = String.format("EST-%s-%04d", year, (n == null ? 0 : n.intValue()) + 1);

        String companyName = env("COMPANY_NAME", "Lumina Studios");
        String companyLicense = env("COMPANY_LICENSE", "LUM/STD/2026/001");

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("estimate_no", estimateNo)
                .addValue("client_id", clientId)
                .addValue("event_name", eventName)
                .addValue("event_type", Db.nz(body.get("event_type")))
                .addValue("event_date", eventDate)
                .addValue("days", days)
                .addValue("cameras", cameras)
                .addValue("camera_rate", cameraRate)
                .addValue("employee_rate", employeeRate)
                .addValue("extras_label", extrasLabel)
                .addValue("extras_cost", extrasCost)
                .addValue("equipment_cost", equipmentCost)
                .addValue("subtotal", subtotal)
                .addValue("gst_rate", gstRate)
                .addValue("gst_amount", gstAmount)
                .addValue("total", total)
                .addValue("status", Db.str(body.get("status")).isBlank() ? "draft" : Db.str(body.get("status")))
                .addValue("notes", Db.nz(body.get("notes")))
                .addValue("company_name", companyName)
                .addValue("company_license", companyLicense)
                .addValue("created_by", me.get("id"));
        int newId = Db.insert(jdbc, """
            INSERT INTO estimates (estimate_no, client_id, event_name, event_type, event_date, days,
                                   cameras, camera_rate, employee_rate, extras_label, extras_cost,
                                   equipment_cost, subtotal, gst_rate, gst_amount, total, status,
                                   notes, company_name, company_license, created_by)
            VALUES (:estimate_no, :client_id, :event_name, :event_type, :event_date, :days,
                    :cameras, :camera_rate, :employee_rate, :extras_label, :extras_cost,
                    :equipment_cost, :subtotal, :gst_rate, :gst_amount, :total, :status,
                    :notes, :company_name, :company_license, :created_by)
            """, p);

        for (Integer uid : employeeIds) {
            jdbc.update("INSERT INTO estimate_employees (estimate_id, user_id) VALUES (:eid, :uid)",
                    Map.of("eid", newId, "uid", uid));
        }
        for (Map<String, Object> item : equipment) {
            jdbc.update("""
                INSERT INTO estimate_equipment (estimate_id, inventory_id, name, qty, rent)
                VALUES (:eid, :iid, :name, :qty, :rent)
                """, new MapSqlParameterSource()
                    .addValue("eid", newId).addValue("iid", item.get("inventory_id"))
                    .addValue("name", item.get("name")).addValue("qty", item.get("qty")).addValue("rent", item.get("rent")));
        }

        activity.log((Integer) me.get("id"), "created", "estimate", newId,
                "Created estimate " + estimateNo + " for " + eventName + " (₹" + Math.round(total) + ")");
        return one(newId, req);
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body,
                                      HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "estimates.manage");
        Map<String, Object> existing = jdbc.queryForMap("SELECT * FROM estimates WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, existing, "estimate");
        String status = Db.str(body == null ? null : body.get("status"));
        if (!status.isBlank() && !List.of("draft", "sent", "accepted", "rejected", "cancelled").contains(status)) {
            throw new ApiException(400, "Invalid estimate status");
        }
        if (!status.isBlank()) {
            jdbc.update("UPDATE estimates SET status = :status WHERE id = :id", Map.of("status", status, "id", id));
        }
        activity.log((Integer) me.get("id"), "updated", "estimate", id,
                "Estimate " + existing.get("estimate_no") + (status.isBlank() ? " updated" : " → " + status));
        return one(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest req) {
        Map<String, Object> me = Auth.require(req, "estimates.manage");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM estimates WHERE id = :id", Map.of("id", id));
        Auth.requireOwnership(req, row, "estimate");
        if (!"draft".equals(row.get("status"))) throw new ApiException(400, "Only draft estimates can be deleted");
        jdbc.update("DELETE FROM estimates WHERE id = :id", Map.of("id", id));
        activity.log((Integer) me.get("id"), "removed", "estimate", id, "Removed estimate " + row.get("estimate_no"));
        return Map.of("ok", true);
    }

    /** GET /api/estimates/{id}/pdf — downloadable PDF quotation. */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable int id, HttpServletRequest req) {
        Auth.require(req, "estimates.view");
        Map<String, Object> e = one(id, req);
        byte[] bytes = buildPdf(e);
        String filename = e.get("estimate_no") + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(bytes);
    }

    /** Employee availability for a date (used by the estimation form). */
    @GetMapping("/available")
    public Map<String, Object> available(@org.springframework.web.bind.annotation.RequestParam String date,
                                         HttpServletRequest req) {
        Auth.require(req, "estimates.manage");
        return availability(date);
    }

    private Map<String, Object> availability(String date) {
        Map<String, Object> params = Map.of("date", date);
        List<Map<String, Object>> available = jdbc.queryForList("""
            SELECT u.id, u.name, u.role, u.department, u.position, u.avatar_hue
            FROM users u
            WHERE u.status = 'active'
              AND u.id NOT IN (SELECT DISTINCT t.assignee_id FROM tasks t
                               JOIN projects p ON p.id = t.project_id
                               WHERE p.shoot_date = :date AND t.assignee_id IS NOT NULL)
              AND u.id NOT IN (SELECT user_id FROM attendance WHERE date = :date AND status = 'leave')
            ORDER BY u.name
            """, params);
        List<Map<String, Object>> busy = jdbc.queryForList("""
            SELECT DISTINCT u.id, u.name, u.role, u.department, u.position, u.avatar_hue
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            JOIN users u ON u.id = t.assignee_id
            WHERE p.shoot_date = :date AND t.assignee_id IS NOT NULL
            ORDER BY u.name
            """, params);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", date);
        out.put("available", available);
        out.put("busy", busy);
        return out;
    }

    // ---------------- PDF ----------------
    @SuppressWarnings("unchecked")
    private byte[] buildPdf(Map<String, Object> e) {
        Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20);
        Font sub = FontFactory.getFont(FontFactory.HELVETICA, 10);
        Font h = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
        Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
        Font normal = FontFactory.getFont(FontFactory.HELVETICA, 10);

        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document doc = new Document(PageSize.A4, 36, 36, 42, 42);
            PdfWriter.getInstance(doc, out);
            doc.open();

            // Company header
            Paragraph company = new Paragraph(String.valueOf(e.get("company_name")), title);
            company.setAlignment(Element.ALIGN_CENTER);
            doc.add(company);
            Paragraph license = new Paragraph("Studio License: " + e.get("company_license") +
                    (System.getenv("COMPANY_ADDRESS") == null ? "" : "   |   " + System.getenv("COMPANY_ADDRESS")), sub);
            license.setAlignment(Element.ALIGN_CENTER);
            doc.add(license);
            Paragraph quote = new Paragraph("E S T I M A T I O N   /   Q U O T A T I O N", h);
            quote.setAlignment(Element.ALIGN_CENTER);
            doc.add(quote);
            doc.add(new Paragraph(" "));

            // Meta
            PdfPTable meta = new PdfPTable(2);
            meta.setWidthPercentage(100);
            meta.setSpacingAfter(10);
            meta.getDefaultCell().setBorder(0);
            cell(meta, "Estimate No:", bold, 0);
            cell(meta, String.valueOf(e.get("estimate_no")), normal, 0);
            cell(meta, "Date:", bold, 0);
            cell(meta, String.valueOf(e.get("created_at")), normal, 0);
            cell(meta, "Client:", bold, 0);
            cell(meta, String.valueOf(e.get("client_name") == null ? "—" : e.get("client_name")), normal, 0);
            cell(meta, "Event:", bold, 0);
            cell(meta, e.get("event_name") + (e.get("event_type") == null ? "" : "  (" + e.get("event_type") + ")"), normal, 0);
            cell(meta, "Event date:", bold, 0);
            cell(meta, String.valueOf(e.get("event_date") == null ? "—" : e.get("event_date")) + "   ·   " + e.get("days") + " day(s)", normal, 0);
            doc.add(meta);

            // Cost breakdown
            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{3f, 1f, 1.2f, 1.4f});
            table.setSpacingAfter(8);
            head(table, "Item");
            head(table, "Qty");
            head(table, "Rate / day");
            head(table, "Amount");
            row(table, "Camera" + (cameras(e) > 1 ? "s" : ""), String.valueOf(cameras(e)),
                    "₹" + fmt(dbl(e.get("camera_rate"))), "₹" + fmt(cameras(e) * dbl(e.get("camera_rate")) * days(e)), normal);
            int team = ((Number) e.get("team_count")).intValue();
            row(table, "Studio team member" + (team != 1 ? "s" : ""), String.valueOf(team),
                    "₹" + fmt(dbl(e.get("employee_rate"))), "₹" + fmt(team * dbl(e.get("employee_rate")) * days(e)), normal);
            List<Map<String, Object>> equipment = (List<Map<String, Object>>) e.get("equipment");
            for (Map<String, Object> item : equipment) {
                int qty = ((Number) item.get("qty")).intValue();
                row(table, String.valueOf(item.get("name")), String.valueOf(qty),
                        "₹" + fmt(dbl(item.get("rent"))), "₹" + fmt(qty * dbl(item.get("rent")) * days(e)), normal);
            }
            if (dbl(e.get("extras_cost")) > 0) {
                row(table, String.valueOf(e.get("extras_label") == null ? "Extras" : e.get("extras_label")),
                        "1", "—", "₹" + fmt(dbl(e.get("extras_cost"))), normal);
            }
            // Totals
            row(table, "Subtotal", "", "", "₹" + fmt(dbl(e.get("subtotal"))), bold);
            row(table, "GST (" + fmt(dbl(e.get("gst_rate"))) + "%)", "", "", "₹" + fmt(dbl(e.get("gst_amount"))), normal);
            row(table, "TOTAL (incl. GST)", "", "", "₹" + fmt(dbl(e.get("total"))), bold);
            doc.add(table);

            // Team
            doc.add(new Paragraph("Team for this event", h));
            doc.add(new Paragraph(" "));
            StringBuilder teamNames = new StringBuilder();
            List<Map<String, Object>> teamList = (List<Map<String, Object>>) e.get("team");
            for (int i = 0; i < teamList.size(); i++) {
                if (i > 0) teamNames.append(", ");
                teamNames.append(teamList.get(i).get("name")).append(" (").append(teamList.get(i).get("position") == null ? "" : teamList.get(i).get("position")).append(")");
            }
            doc.add(new Paragraph(teamNames.length() == 0 ? "—" : teamNames.toString(), normal));
            doc.add(new Paragraph(" "));

            if (e.get("notes") != null && !String.valueOf(e.get("notes")).isBlank()) {
                doc.add(new Paragraph("Notes / Terms", h));
                doc.add(new Paragraph(String.valueOf(e.get("notes")), normal));
                doc.add(new Paragraph(" "));
            }
            doc.add(new Paragraph("This is a computer-generated estimate. Prices are indicative per event and "
                    + "subject to the final shoot plan. 50% advance confirms the booking.", sub));
            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ApiException(500, "Could not generate the PDF: " + ex.getMessage());
        }
    }

    private static int cameras(Map<String, Object> e) { return ((Number) e.get("cameras")).intValue(); }
    private static int days(Map<String, Object> e) { return Math.max(((Number) e.get("days")).intValue(), 1); }
    private static double dbl(Object o) { try { return Double.parseDouble(String.valueOf(o)); } catch (Exception e) { return 0; } }
    private static String fmt(double v) { return String.format("%,.0f", v); }

    private static void cell(PdfPTable t, String text, Font f, int align) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBorder(0);
        c.setPaddingBottom(3);
        if (align != 0) c.setHorizontalAlignment(align);
        t.addCell(c);
    }
    private static void head(PdfPTable t, String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)));
        c.setBackgroundColor(new java.awt.Color(238, 240, 254));
        c.setPadding(5);
        t.addCell(c);
    }
    private static void row(PdfPTable t, String item, String qty, String rate, String amt, Font f) {
        cell(t, item, f, 0);
        cell(t, qty, f, Element.ALIGN_CENTER);
        cell(t, rate, f, Element.ALIGN_RIGHT);
        cell(t, amt, f, Element.ALIGN_RIGHT);
    }
}
