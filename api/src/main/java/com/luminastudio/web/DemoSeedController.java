package com.luminastudio.web;

import com.luminastudio.security.Auth;
import com.luminastudio.util.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * POST /api/demo/seed — loads realistic SAMPLE DATA into the CALLING account's
 * own (isolated) workspace, so they can explore every feature.
 *
 * Only runs when the account has no clients and no projects yet (prevents
 * duplicates). Everything is created with created_by = the caller, so it stays
 * in their workspace and never touches the shared demo workspace.
 */
@RestController
@RequestMapping("/api/demo")
public class DemoSeedController {

    private final NamedParameterJdbcTemplate jdbc;

    public DemoSeedController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private String daysAgo(int n) { return LocalDate.now().minusDays(n).toString(); }
    private String daysAhead(int n) { return LocalDate.now().plusDays(n).toString(); }

    @PostMapping("/seed")
    public Map<String, Object> seed(HttpServletRequest req) {
        Map<String, Object> me = Auth.user(req);
        int uid = Auth.id(req);

        Number clients = jdbc.queryForObject("SELECT COUNT(*) FROM clients WHERE created_by = :me", Map.of("me", uid), Number.class);
        Number projects = jdbc.queryForObject("SELECT COUNT(*) FROM projects WHERE created_by = :me", Map.of("me", uid), Number.class);
        if ((clients != null && clients.longValue() > 0) || (projects != null && projects.longValue() > 0)) {
            throw new ApiException(400, "Your workspace already has data — sample data was not loaded.");
        }

        // ---------- CLIENTS ----------
        Object[][] clientsSeed = {
            {"Rohan & Sneha Wedding", "Wedding", "Wedding, 2-day full coverage + album.", 210},
            {"Sharma Family — Anniversary", "Anniversary", "25th anniversary celebration, full day.", 30},
            {"Agarwal Events — Corporate", "Corporate", "Annual conference + office event photography.", 260},
        };
        int[] clientIds = new int[clientsSeed.length];
        for (int i = 0; i < clientsSeed.length; i++) {
            Object[] c = clientsSeed[i];
            clientIds[i] = Db.insert(jdbc, """
                INSERT INTO clients (name, industry, notes, hue, created_by)
                VALUES (:name, :industry, :notes, :hue, :me)
                """, new MapSqlParameterSource()
                    .addValue("name", c[0]).addValue("industry", c[1]).addValue("notes", c[2])
                    .addValue("hue", c[3]).addValue("me", uid));
        }

        // ---------- PROJECTS (across the pipeline) ----------
        Object[][] projectsSeed = {
            {"Rohan & Sneha — Wedding Coverage", 0, "wedding", "lightroom", "high", 280000, 145000, daysAgo(12), daysAgo(8), daysAhead(14), 40, "3-day wedding coverage — RAW files in Lightroom."},
            {"Rohan & Sneha — Engagement Shoot", 0, "pre_wedding", "album", "medium", 120000, 88000, daysAgo(20), daysAgo(15), daysAhead(6), 72, "Engagement + styled pre-wedding shoot. Album layout in progress."},
            {"Sharma 25th Anniversary", 1, "event", "video", "medium", 90000, 52000, daysAgo(10), daysAgo(7), daysAhead(9), 55, "Full-day celebration — highlight film being edited."},
            {"TechNova Annual Conference", 2, "corporate", "data_copy", "low", 75000, 18000, daysAgo(5), daysAgo(3), daysAhead(16), 18, "Two-day corporate event. RAW files ingesting."},
            {"Nisha's Bridal Portraits", 0, "portfolio", "booked", "medium", 60000, 5000, daysAgo(2), daysAhead(3), daysAhead(20), 5, "Bridal portrait session — booked."},
            {"Rohan & Sneha — Highlight Film", 0, "video", "final_review", "high", 95000, 86000, daysAgo(18), daysAgo(6), daysAhead(2), 90, "6-minute wedding film in final review."},
            {"Sharma Album — Story Book", 1, "album", "delivered", "medium", 65000, 65000, daysAgo(35), daysAgo(22), daysAgo(5), 100, "Delivered story book album."},
        };
        int[] projectIds = new int[projectsSeed.length];
        for (int i = 0; i < projectsSeed.length; i++) {
            Object[] p = projectsSeed[i];
            projectIds[i] = Db.insert(jdbc, """
                INSERT INTO projects (name, client_id, type, status, priority, budget, spent, start_date, shoot_date, deadline, manager_id, description, progress, created_by)
                VALUES (:name, :client, :type, :status, :priority, :budget, :spent, :start, :shoot, :deadline, :me, :desc, :progress, :me)
                """, new MapSqlParameterSource()
                    .addValue("name", p[0]).addValue("client", clientIds[(Integer) p[1]])
                    .addValue("type", p[2]).addValue("status", p[3]).addValue("priority", p[4])
                    .addValue("budget", p[5]).addValue("spent", p[6])
                    .addValue("start", p[7]).addValue("shoot", p[8]).addValue("deadline", p[9])
                    .addValue("me", uid).addValue("desc", p[11]).addValue("progress", p[10]));
        }

        // ---------- TASKS ----------
        Object[][] tasksSeed = {
            {"Lightroom grade — ceremony set", "Colour grade all ceremony frames.", 0, "in_progress", "high", daysAhead(5), 20},
            {"Retouch key portraits", "40 portrait retouches.", 0, "todo", "medium", daysAhead(9), 14},
            {"Album layout v2", "Reorder spreads per client feedback.", 1, "in_progress", "medium", daysAhead(4), 16},
            {"Highlight film — assembly cut", "First assembly of the 5-min film.", 3, "in_progress", "high", daysAhead(7), 12},
            {"Ceremony sequence pass", "Structure the ceremony timeline.", 3, "todo", "medium", daysAhead(8), 10},
            {"Ingest & backup conference cards", "Verify checksums, dual backup.", 3, "done", "high", daysAgo(2), 6},
            {"Final review — film QC", "Colour, audio and delivery checks.", 5, "in_progress", "high", daysAhead(2), 5},
            {"Client gallery setup", "Online gallery + delivery links.", 6, "done", "medium", daysAgo(8), 3},
            {"Bridal shoot — shot list & plan", "Plan the portrait session.", 4, "todo", "medium", daysAhead(4), 4},
            {"Teaser reels for social", "15s vertical cutdowns.", 5, "todo", "medium", daysAhead(3), 6},
        };
        for (Object[] t : tasksSeed) {
            jdbc.update("""
                INSERT INTO tasks (title, description, project_id, assignee_id, status, priority, due_date, estimated_hours, created_by)
                VALUES (:title, :desc, :pid, :me, :status, :priority, :due, :hours, :me)
                """, new MapSqlParameterSource()
                    .addValue("title", t[0]).addValue("desc", t[1]).addValue("pid", projectIds[(Integer) t[2]])
                    .addValue("me", uid).addValue("status", t[3]).addValue("priority", t[4])
                    .addValue("due", t[5]).addValue("hours", t[6]));
        }

        // ---------- PHOTOS (gallery & album approval) ----------
        String[] cat = {"Ceremony", "Portraits", "Reception", "Pre-Wedding", "Family"};
        String[] statuses = {"uploaded", "uploaded", "selected", "selected", "approved"};
        for (int i = 1; i <= 10; i++) {
            jdbc.update("""
                INSERT INTO photos (project_id, name, url, category, size_mb, captured_on, status, uploaded_by, created_by)
                VALUES (:pid, :name, :url, :cat, :size, :cap, :status, :me, :me)
                """, new MapSqlParameterSource()
                    .addValue("pid", projectIds[i % 3])
                    .addValue("name", String.format("Sample_%03d.jpg", i))
                    .addValue("url", "/media/gallery/sample-" + i + ".jpg")
                    .addValue("cat", cat[i % cat.length]).addValue("size", 8 + (i % 5))
                    .addValue("cap", daysAgo(10 - (i % 8)))
                    .addValue("status", statuses[i % statuses.length]).addValue("me", uid));
        }

        // ---------- MEDIA ASSETS ----------
        Object[][] assetsSeed = {
            {"Sample_Highlight_Film.mp4", "video", 5, 4800, "final, film"},
            {"Sample_Graded_Gallery.zip", "document", 0, 1200, "gallery, graded"},
            {"Sample_Album_Design.pdf", "design", 1, 88, "album, layout"},
            {"Sample_Music_Bed.wav", "audio", 3, 310, "music, audio"},
        };
        for (Object[] a : assetsSeed) {
            jdbc.update("""
                INSERT INTO assets (name, type, project_id, uploaded_by, size_mb, hue, tags, description, url, created_by)
                VALUES (:name, :type, :pid, :me, :size, :hue, :tags, 'Sample asset for exploring the library.', :url, :me)
                """, new MapSqlParameterSource()
                    .addValue("name", a[0]).addValue("type", a[1]).addValue("pid", projectIds[(Integer) a[2]])
                    .addValue("me", uid).addValue("size", a[3]).addValue("hue", 200 + (int) (Math.random() * 140))
                    .addValue("tags", a[4]).addValue("url", ("/media/" + String.valueOf(a[0])).toLowerCase()));
        }

        // ---------- INVENTORY (if the account has none) ----------
        Number invCount = jdbc.queryForObject("SELECT COUNT(*) FROM inventory WHERE created_by = :me", Map.of("me", uid), Number.class);
        if (invCount == null || invCount.longValue() == 0) {
            Object[][] invSeed = {
                {"Sony A7 IV Mirrorless Camera", "camera", "Sony", 2, 1500, "Full-frame body."},
                {"Canon EOS R6 Mark II", "camera", "Canon", 1, 1500, "Backup body."},
                {"2TB Portable SSD", "hard_disk", "Samsung", 3, 300, "Card backup."},
                {"4TB External HDD", "hard_disk", "Seagate", 2, 400, "Archive copy."},
                {"Manfrotto Tripod", "stand", "Manfrotto", 3, 200, "Aluminium."},
                {"LED Light Kit", "equipment", "Godox", 2, 800, "With softboxes."},
            };
            for (Object[] iv : invSeed) {
                jdbc.update("""
                    INSERT INTO inventory (name, category, brand, quantity, rent_per_event, notes, created_by)
                    VALUES (:name, :cat, :brand, :qty, :rent, :notes, :me)
                    """, new MapSqlParameterSource()
                        .addValue("name", iv[0]).addValue("cat", iv[1]).addValue("brand", iv[2])
                        .addValue("qty", iv[3]).addValue("rent", iv[4]).addValue("notes", iv[5]).addValue("me", uid));
            }
        }

        // ---------- TIMESHEETS ----------
        for (int i = 1; i <= 5; i++) {
            jdbc.update("""
                INSERT INTO timesheets (user_id, project_id, date, hours, description, status, created_by)
                VALUES (:me, :pid, :date, :hours, 'Production work — see project board.', :status, :me)
                """, new MapSqlParameterSource()
                    .addValue("me", uid).addValue("pid", projectIds[i % 3])
                    .addValue("date", daysAgo(i))
                    .addValue("hours", 6 + (i % 3) * 2)
                    .addValue("status", i >= 3 ? "approved" : "pending"));
        }

        // ---------- INVOICES (GST) ----------
        Object[][] invSeed = {
            {0, 0, 280000, 100000, "partial", "Wedding package invoice — advance received."},
            {5, 0, 95000, 95000, "paid", "Highlight film — paid in full."},
        };
        for (Object[] inv : invSeed) {
            double base = (Integer) inv[2];
            double gst = Math.round(base * 18 / 100.0 * 100.0) / 100.0;
            double total = base + gst;
            double advance = (Integer) inv[3];
            double balance = Math.round((total - advance) * 100.0) / 100.0;
            String no = "INV-" + LocalDate.now().getYear() + "-" + String.format("%04d", 100 + (int) (Math.random() * 900));
            int iid = Db.insert(jdbc, """
                INSERT INTO invoices (project_id, client_id, invoice_no, issued_on, due_on, base_amount, gst_rate,
                                      gst_amount, total_amount, advance_paid, balance, status, notes, created_by)
                VALUES (:pid, :cid, :no, :issued, :due, :base, 18, :gst, :total, :adv, :bal, :status, :notes, :me)
                """, new MapSqlParameterSource()
                    .addValue("pid", projectIds[(Integer) inv[0]]).addValue("cid", clientIds[(Integer) inv[1]])
                    .addValue("no", no).addValue("issued", daysAgo(15)).addValue("due", daysAhead(15))
                    .addValue("base", base).addValue("gst", gst).addValue("total", total)
                    .addValue("adv", advance).addValue("bal", balance).addValue("status", inv[4])
                    .addValue("notes", inv[5]).addValue("me", uid));
            if (advance > 0) {
                jdbc.update("""
                    INSERT INTO payments (invoice_id, amount, paid_on, method, reference, notes, recorded_by)
                    VALUES (:iid, :amt, :date, 'bank', 'NEFT/UPI', 'Advance at booking', :me)
                    """, new MapSqlParameterSource()
                        .addValue("iid", iid).addValue("amt", advance).addValue("date", daysAgo(12)).addValue("me", uid));
            }
        }

        // ---------- ESTIMATES ----------
        Object[][] estSeed = {
            {"Rohan & Sneha Wedding — Full Coverage", 0, "Wedding", daysAhead(20), 3, 4, 1500, 2500, "Drone aerial shots", 2500, "sent"},
            {"Sharma Anniversary — Celebration", 1, "Anniversary", daysAhead(10), 1, 2, 1500, 2500, "Extra retouching", 1000, "draft"},
        };
        for (Object[] es : estSeed) {
            int days = (Integer) es[4];
            int cameras = (Integer) es[5];
            double cameraRate = (Integer) es[6];
            double employeeRate = (Integer) es[7];
            double extras = (Integer) es[9];
            double cameraCost = cameras * cameraRate * days;
            double employeeCost = employeeRate * days; // team = 1 (the caller)
            double subtotal = Math.round((cameraCost + employeeCost + extras) * 100.0) / 100.0;
            double gst = Math.round(subtotal * 18 / 100.0 * 100.0) / 100.0;
            double total = Math.round((subtotal + gst) * 100.0) / 100.0;
            String no = "EST-" + LocalDate.now().getYear() + "-" + String.format("%04d", 100 + (int) (Math.random() * 900));
            int eid = Db.insert(jdbc, """
                INSERT INTO estimates (estimate_no, client_id, event_name, event_type, event_date, days,
                                       cameras, camera_rate, employee_rate, extras_label, extras_cost,
                                       equipment_cost, subtotal, gst_rate, gst_amount, total, status,
                                       notes, company_name, company_license, created_by)
                VALUES (:no, :cid, :event, :type, :date, :days, :cam, :camRate, :empRate, :extrasLabel, :extras,
                        :eqCost, :sub, 18, :gst, :total, :status, '50% advance confirms the booking.',
                        'Lumina Studios', 'LUM/STD/2026/001', :me)
                """, new MapSqlParameterSource()
                    .addValue("no", no).addValue("cid", clientIds[(Integer) es[1]])
                    .addValue("event", es[0]).addValue("type", es[2]).addValue("date", es[3])
                    .addValue("days", days).addValue("cam", cameras).addValue("camRate", cameraRate)
                    .addValue("empRate", employeeRate).addValue("extrasLabel", es[8]).addValue("extras", extras)
                    .addValue("eqCost", 0).addValue("sub", subtotal).addValue("gst", gst)
                    .addValue("total", total).addValue("status", es[10]).addValue("me", uid));
            jdbc.update("INSERT INTO estimate_employees (estimate_id, user_id) VALUES (:eid, :me)",
                    Map.of("eid", eid, "me", uid));
        }

        // ---------- ACTIVITY ----------
        String[] acts = {"created sample workspace", "advanced a project in the pipeline", "uploaded gallery photos"};
        for (int i = 0; i < acts.length; i++) {
            jdbc.update("INSERT INTO activity (user_id, action, target_type, details) VALUES (:me, 'seeded', 'demo', :d)",
                    Map.of("me", uid, "d", acts[i]));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("loaded", true);
        out.put("clients", clientsSeed.length);
        out.put("projects", projectsSeed.length);
        out.put("tasks", tasksSeed.length);
        out.put("photos", 10);
        out.put("invoices", invSeed.length);
        out.put("estimates", estSeed.length);
        return out;
    }
}
