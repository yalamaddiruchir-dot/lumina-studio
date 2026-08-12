package com.luminastudio.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Random;

/**
 * Seeds realistic demo data when the database is empty AND app.seed-demo=true
 * (development default). In production (SEED_DEMO=false) nothing is seeded —
 * the initial Owner is created from ADMIN_* environment variables instead.
 *
 * Org chart: OWNER → Management / Production Team / Sales & Client Management /
 * Finance / Administration. Pipeline: booked → data_copy → lightroom → video →
 * album → final_review → delivered.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final NamedParameterJdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    public DataInitializer(NamedParameterJdbcTemplate jdbc, PasswordEncoder passwordEncoder, AppProperties props) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
    }

    @Override
    public void run(String... args) {
        Number n = jdbc.queryForObject("SELECT COUNT(*) FROM users", Map.of(), Number.class);
        if (n != null && n.longValue() > 0) return;
        if (!props.seedDemo()) {
            String adminEmail = System.getenv("ADMIN_EMAIL");
            String adminPassword = System.getenv("ADMIN_PASSWORD");
            if (adminEmail != null && !adminEmail.isBlank() && adminPassword != null && adminPassword.length() >= 8) {
                String adminName = System.getenv("ADMIN_NAME");
                String adminRole = System.getenv("ADMIN_ROLE");
                jdbc.update("""
                    INSERT INTO users (name, email, password_hash, role, department, position, status, avatar_hue)
                    VALUES (:name, :email, :hash, :role, 'Management', 'Owner', 'active', :hue)
                    """, new MapSqlParameterSource()
                        .addValue("name", adminName == null || adminName.isBlank() ? "Administrator" : adminName.trim())
                        .addValue("email", adminEmail.trim().toLowerCase())
                        .addValue("hash", passwordEncoder.encode(adminPassword))
                        .addValue("role", adminRole == null || adminRole.isBlank() ? "owner" : adminRole.trim())
                        .addValue("hue", 262));
                log.warn("Created first account {} ({}) from ADMIN_* environment variables.", adminEmail, adminRole);
                return;
            }
            log.warn("Fresh database with SEED_DEMO=false — no accounts exist yet.");
            log.warn("Set ADMIN_EMAIL / ADMIN_PASSWORD (min 8 chars) env vars to create the first account on boot.");
            return;
        }
        log.info("Seeding demo data…");
        seed();
    }

    private final Random rnd = new Random(20260810L);

    private String daysAgo(int n) { return LocalDate.now().minusDays(n).toString(); }
    private String daysAhead(int n) { return LocalDate.now().plusDays(n).toString(); }
    private String month(int offset) { return YearMonth.now().minusMonths(offset).toString(); }

    private void seed() {
        String hash = passwordEncoder.encode("demo123");

        // ---------------- EMPLOYEES (org chart) ----------------
        // role, department, position
        Object[][] users = {
            // OWNER + Management
            {"Arjun Mehta", "owner@lumina.studio", "owner", "Management", "Owner", "+91 98450 11223", "Hyderabad", "Founder of the studio. Final sign-off on every album and film.", "Photography, Business, Client Relations", 420000, "2018-04-02", 262},
            {"Rahul Sharma", "manager@lumina.studio", "manager", "Management", "Manager", "+91 90000 77812", "Hyderabad", "Runs the production floor — plans shoots, assigns stages, keeps deadlines.", "Production Planning, Scheduling, QA", 180000, "2020-01-20", 150},
            {"Sanjay Verma", "sanjay@lumina.studio", "manager", "Management", "Project Manager", "+91 98220 44512", "Hyderabad", "Owns every order end-to-end, from booking to delivery.", "Project Management, Client Coordination", 170000, "2020-06-01", 20},
            // Administration
            {"Kavya Reddy", "admin@lumina.studio", "admin", "Administration", "System Administrator", "+91 98850 44112", "Hyderabad", "Keeps systems, accounts and infrastructure running.", "Systems, IT, Security", 260000, "2019-07-15", 210},
            {"Ananya Iyer", "hr@lumina.studio", "hr", "Administration", "HR / Admin", "+91 99850 33421", "Hyderabad", "People ops, hiring, attendance and the studio culture.", "Recruiting, Onboarding, Attendance", 140000, "2021-03-08", 330},
            // Finance
            {"Vikram Nair", "finance@lumina.studio", "finance", "Finance", "Accountant", "+91 98950 55621", "Hyderabad", "Books, payroll and vendor payments.", "Accounting, Payroll, GST", 150000, "2020-11-02", 200},
            {"Meera Shah", "meera@lumina.studio", "finance", "Finance", "Billing Executive", "+91 90090 44321", "Hyderabad", "Invoices clients and chases collections.", "Billing, Invoicing, Collections", 95000, "2021-10-11", 195},
            // Sales & Client Management
            {"Aditya Rao", "aditya@lumina.studio", "sales", "Sales & Client Management", "Sales Executive", "+91 99510 99231", "Hyderabad", "Books new weddings and events — the studio's growth engine.", "Sales, Proposals, Walk-ins", 88000, "2022-05-30", 180},
            {"Ishita Gupta", "ishita@lumina.studio", "sales", "Sales & Client Management", "Client Coordinator", "+91 98100 88776", "Hyderabad", "The client's single point of contact through the whole journey.", "Client Relations, Follow-ups", 78000, "2023-09-04", 155},
            // Production Team — Data Copy
            {"Rohit Menon", "rohit@lumina.studio", "production", "Production Team", "Data Copy Operator", "+91 86080 44556", "Hyderabad", "Ingests memory cards, backs up RAW files, names folders.", "Data Management, Backup", 45000, "2023-06-19", 200},
            {"Arnav Singh", "arnav@lumina.studio", "production", "Production Team", "Data Copy Operator", "+91 99090 33421", "Hyderabad", "Second set of hands on card ingestion and archive checks.", "Data Management, Backup", 45000, "2023-02-12", 25},
            // Production Team — Lightroom
            {"Priya Patel", "priya@lumina.studio", "production", "Production Team", "Lightroom Editor", "+91 97010 88912", "Hyderabad", "Culls and colour-grades wedding photographs.", "Lightroom, Colour Grading, Culling", 65000, "2021-08-16", 280},
            {"Sneha Kulkarni", "sneha@lumina.studio", "production", "Production Team", "Lightroom Editor", "+91 96760 22134", "Hyderabad", "Retouches portraits and prepares gallery selects.", "Lightroom, Retouching", 65000, "2022-02-14", 45},
            {"Kabir Khan", "kabir@lumina.studio", "production", "Production Team", "Senior Lightroom Editor", "+91 97000 55678", "Hyderabad", "Signs off on every edited set before it moves downstream.", "Lightroom, QA, Presets", 85000, "2020-09-21", 250},
            // Production Team — Video
            {"Farhan Ali", "farhan@lumina.studio", "production", "Production Team", "Video Editor", "+91 90100 77634", "Hyderabad", "Cuts highlight films and wedding teasers.", "Premiere Pro, CapCut, Storytelling", 78000, "2021-11-22", 320},
            {"Divya Krishnan", "divya@lumina.studio", "production", "Production Team", "Video Editor", "+91 90900 11234", "Hyderabad", "Assembles ceremony films and social cutdowns.", "Premiere Pro, After Effects", 72000, "2024-01-15", 285},
            {"Meera Nambiar", "meera.nambiar@lumina.studio", "production", "Production Team", "Senior Video Editor", "+91 94470 12340", "Hyderabad", "Final video cuts, sound design and delivery masters.", "Premiere Pro, DaVinci, Audio", 96000, "2021-06-07", 340},
            // Production Team — Album
            {"Aditi Rao", "aditi@lumina.studio", "production", "Production Team", "Album Designer", "+91 98000 55612", "Hyderabad", "Designs photo album layouts with the couple's story in mind.", "Photoshop, InDesign, Album Design", 68000, "2023-04-24", 30},
            {"Aryan Kapoor", "aryan@lumina.studio", "production", "Production Team", "Senior Album Designer", "+91 97050 88321", "Hyderabad", "Premium album concepts, covers and print-ready files.", "Photoshop, InDesign, Prepress", 88000, "2022-08-01", 190},
            // Production Team — Final Review
            {"Zoya Khan", "zoya@lumina.studio", "quality", "Production Team", "Quality Controller", "+91 98900 22145", "Hyderabad", "The last pair of eyes — approves final review and releases delivery.", "QA, Colour Accuracy, Print Check", 70000, "2022-10-17", 320},
        };
        for (Object[] u : users) {
            jdbc.update("""
                INSERT INTO users (name, email, password_hash, role, department, position, phone, location, bio, skills, salary, hire_date, status, is_demo, avatar_hue)
                VALUES (:name, :email, :hash, :role, :dept, :pos, :phone, :loc, :bio, :skills, :salary, :hire, 'active', 1, :hue)
                """, new MapSqlParameterSource()
                    .addValue("name", u[0]).addValue("email", u[1]).addValue("hash", hash).addValue("role", u[2])
                    .addValue("dept", u[3]).addValue("pos", u[4]).addValue("phone", u[5]).addValue("loc", u[6])
                    .addValue("bio", u[7]).addValue("skills", u[8]).addValue("salary", u[9]).addValue("hire", u[10])
                    .addValue("hue", u[11]));
        }

        // ---------------- CLIENTS ----------------
        Object[][] clients = {
            {"Gupta Family", "Gupta Wedding — Delhi", "meera.gupta@example.in", "+91 98110 22334", "Wedding", "active", "Main wedding package + 3 days coverage. Album: 40-page premium.", 210},
            {"Kapoor Family", "Kapoor Anniversary", "kapoor.family@example.in", "+91 98220 44556", "Anniversary", "active", "25th anniversary celebration — full-day coverage.", 130},
            {"TechNova Events", "TechNova Solutions Pvt Ltd", "events@technova.in", "+91 33 4000 1122", "Corporate", "active", "Annual conference + office event photography.", 260},
            {"Sharma Family", "Rohan & Sneha Engagement", "sharma.family@example.in", "+91 98990 66778", "Engagement", "active", "Engagement function + pre-wedding shoot booked.", 30},
            {"Agarwal Family", "Agarwal Baby Shower", "agarwal@example.in", "+91 97000 88990", "Ceremony", "active", "Godh bharai function — single-day coverage.", 160},
            {"Rathi & Co", "Rathi Corporate House", "hello@rathi.in", "+91 44 4555 6677", "Corporate", "inactive", "Product & office branding shoot — on hold.", 320},
            {"Desai Wedding", "Aarav & Nisha Wedding", "desai.wedding@example.in", "+91 90040 55667", "Wedding", "active", "Destination wedding, Goa — 4 days, full package.", 275},
        };
        for (Object[] c : clients) {
            jdbc.update("""
                INSERT INTO clients (name, company, email, phone, industry, status, notes, hue)
                VALUES (:name, :company, :email, :phone, :industry, :status, :notes, :hue)
                """, new MapSqlParameterSource()
                    .addValue("name", c[0]).addValue("company", c[1]).addValue("email", c[2]).addValue("phone", c[3])
                    .addValue("industry", c[4]).addValue("status", c[5]).addValue("notes", c[6]).addValue("hue", c[7]));
        }

        // ---------------- PROJECTS (pipeline stages) ----------------
        // name, client, type, status, priority, budget, spent, startOffset, deadlineOffset(+ = daysAgo, - = daysAhead), manager, progress, description
        Object[][] projects = {
            {"Aarav & Nisha — Destination Wedding", "Desai Wedding", "wedding", "final_review", "high", 350000, 315000, 45, -3, "Sanjay Verma", 92, "4-day Goa wedding. Album + highlight film awaiting final review sign-off.", 33},
            {"Gupta Wedding — Full Coverage", "Gupta Family", "wedding", "lightroom", "high", 280000, 165000, 21, -12, "Sanjay Verma", 42, "3-day wedding coverage. 1800 RAW files in Lightroom.", 18},
            {"Rohan & Sneha — Engagement", "Sharma Family", "pre_wedding", "album", "medium", 120000, 88000, 30, -6, "Rahul Sharma", 72, "Engagement function + styled pre-wedding shoot. Album layout v2.", 27},
            {"Kapoor 25th Anniversary", "Kapoor Family", "event", "video", "medium", 90000, 52000, 14, -8, "Rahul Sharma", 55, "Full-day celebration — highlight film in progress.", 11},
            {"TechNova Annual Conference", "TechNova Events", "corporate", "data_copy", "low", 75000, 18000, 6, -15, "Rahul Sharma", 18, "Two-day corporate event. 900 RAW files ingesting.", 3},
            {"Agarwal Godh Bharai", "Agarwal Family", "event", "booked", "low", 45000, 5000, 4, -18, "Sanjay Verma", 5, "Single-day ceremony. Awaiting shoot day."},
            {"Meera's Pre-Wedding Shoot", "Sharma Family", "pre_wedding", "lightroom", "medium", 110000, 60000, 18, -9, "Sanjay Verma", 45, "Styled pre-wedding at two locations. Lightroom editing in progress.", 15},
            {"Gupta Album — 40 Page Premium", "Gupta Family", "album", "album", "high", 65000, 40000, 26, -5, "Rahul Sharma", 65, "Premium 40-page album. Design approval round 2."},
            {"Kapoor Family Video Highlights", "Kapoor Family", "video", "final_review", "medium", 50000, 46000, 35, -2, "Rahul Sharma", 90, "5-minute highlight film in final review."},
            {"Nisha's Bridal Portraits", "Desai Wedding", "portfolio", "booked", "medium", 60000, 0, 2, -25, "Sanjay Verma", 0, "Bridal portrait session — booked, shoot scheduled."},
            {"Aarav & Nisha — Highlight Film", "Desai Wedding", "video", "video", "high", 95000, 61000, 40, -4, "Sanjay Verma", 60, "6-minute destination wedding film. Assembly cut done."},
            {"Gupta Wedding — Teaser Reels", "Gupta Family", "video", "delivered", "medium", 20000, 20000, 40, 18, "Rahul Sharma", 100, "15s teasers for social — delivered to client."},
            {"Desai Album — Story Book", "Desai Wedding", "album", "data_copy", "high", 80000, 15000, 12, -10, "Sanjay Verma", 15, "120-page story book. RAW selection in progress."},
        };
        for (Object[] pr : projects) {
            int startOffset = (Integer) pr[7];
            int deadlineOffset = (Integer) pr[8];
            jdbc.update("""
                INSERT INTO projects (name, client_id, type, status, priority, budget, spent, start_date, shoot_date, deadline, manager_id, description, progress)
                VALUES (:name, (SELECT id FROM clients WHERE name = :client), :type, :status, :priority, :budget, :spent, :start, :shoot, :deadline,
                        (SELECT id FROM users WHERE name = :manager), :desc, :progress)
                """, new MapSqlParameterSource()
                    .addValue("name", pr[0]).addValue("client", pr[1]).addValue("type", pr[2]).addValue("status", pr[3])
                    .addValue("priority", pr[4]).addValue("budget", pr[5]).addValue("spent", pr[6])
                    .addValue("start", daysAgo(startOffset))
                    .addValue("shoot", pr.length > 12 && ((Integer) pr[12]) > 0 ? daysAgo((Integer) pr[12]) : null)
                    .addValue("deadline", deadlineOffset > 0 ? daysAgo(deadlineOffset) : daysAhead(-deadlineOffset))
                    .addValue("manager", pr[9]).addValue("desc", pr[11]).addValue("progress", pr[10]));
        }

        // ---------------- TASKS (per pipeline stage) ----------------
        // title, desc, project, assignee, status, priority, due(+daysAgo / -daysAhead), hours, completedDaysAgo(null if open)
        Object[][] tasks = {
            {"Ingest & backup 1800 RAW files", "Copy all memory cards, verify checksums, dual backup.", "Gupta Wedding — Full Coverage", "Rohit Menon", "done", "high", 18, 10, 16},
            {"Cull & tag selects", "Mark the best 900 frames for Lightroom.", "Gupta Wedding — Full Coverage", "Arnav Singh", "done", "high", 15, 8, 12},
            {"Lightroom colour grade — batch 1", "Base grade on all ceremony frames.", "Gupta Wedding — Full Coverage", "Priya Patel", "in_progress", "high", -5, 24, null},
            {"Retouch key portraits", "Skin and dress retouching for 40 portraits.", "Gupta Wedding — Full Coverage", "Sneha Kulkarni", "todo", "medium", -10, 20, null},
            {"Senior review — edited set", "Sign off the graded set before album.", "Gupta Wedding — Full Coverage", "Kabir Khan", "todo", "high", -7, 6, null},
            {"Copy engagement RAW to NAS", "Ingest and verify card 1–4.", "Rohan & Sneha — Engagement", "Rohit Menon", "done", "medium", 26, 6, 24},
            {"Grade engagement gallery", "Colour grade 320 selects.", "Rohan & Sneha — Engagement", "Priya Patel", "done", "medium", 22, 14, 20},
            {"Album layout v2 — story flow", "Reorder spreads per client feedback.", "Rohan & Sneha — Engagement", "Aditi Rao", "in_progress", "medium", -5, 18, null},
            {"Premium cover concept", "Leather wrap + foil concepts.", "Rohan & Sneha — Engagement", "Aryan Kapoor", "review", "medium", -3, 10, null},
            {"Ingest conference cards", "Two days of corporate coverage.", "TechNova Annual Conference", "Arnav Singh", "in_progress", "high", -4, 8, null},
            {"Backup verification", "Verify day-1 archives.", "TechNova Annual Conference", "Rohit Menon", "todo", "medium", -8, 4, null},
            {"Highlight film — assembly cut", "First assembly of the 5-min film.", "Kapoor 25th Anniversary", "Farhan Ali", "in_progress", "medium", -6, 16, null},
            {"Ceremony film — timeline pass", "Structure the ceremony sequence.", "Kapoor 25th Anniversary", "Divya Krishnan", "todo", "medium", -9, 12, null},
            {"Final review — film QC", "Colour, audio and delivery specs check.", "Kapoor Family Video Highlights", "Zoya Khan", "in_progress", "high", -2, 6, null},
            {"Deliver 5-min highlight master", "Export 4K master + social cutdowns.", "Kapoor Family Video Highlights", "Meera Nambiar", "done", "medium", 6, 8, 3},
            {"Grade pre-wedding set", "Location 1 & 2 grading.", "Meera's Pre-Wedding Shoot", "Sneha Kulkarni", "in_progress", "medium", -6, 18, null},
            {"Stylised stills retouch", "20 hero portraits.", "Meera's Pre-Wedding Shoot", "Priya Patel", "todo", "medium", -10, 12, null},
            {"Story book — spread design", "120-page layout, part 1.", "Desai Album — Story Book", "Aditi Rao", "in_progress", "high", -8, 22, null},
            {"Select 1200 frames for album", "Cull pass for the story book.", "Desai Album — Story Book", "Arnav Singh", "done", "high", 9, 8, 8},
            {"Wedding film — assembly cut", "6-minute destination film.", "Aarav & Nisha — Highlight Film", "Meera Nambiar", "in_progress", "high", -4, 20, null},
            {"Sound design & music mix", "Score + ambience mix.", "Aarav & Nisha — Highlight Film", "Farhan Ali", "todo", "medium", -8, 8, null},
            {"Final review — full album", "Print check, colour accuracy, spell-check names.", "Aarav & Nisha — Destination Wedding", "Zoya Khan", "in_progress", "high", -3, 10, null},
            {"Album print-ready files", "Export print-ready PDFs for press.", "Aarav & Nisha — Destination Wedding", "Aryan Kapoor", "review", "high", -2, 12, null},
            {"Client delivery — teasers", "Share reels via client gallery.", "Gupta Wedding — Teaser Reels", "Ishita Gupta", "done", "medium", 20, 4, 19},
            {"Anniversary teaser cutdowns", "15s verticals for family.", "Kapoor Family Video Highlights", "Divya Krishnan", "done", "medium", 8, 6, 5},
            {"Proposal deck — bridal portraits", "Package & moodboard for the session.", "Nisha's Bridal Portraits", "Aditya Rao", "done", "low", 1, 5, 1},
            {"Shoot-day plan — Godh Bharai", "Shot list and schedule.", "Agarwal Godh Bharai", "Sanjay Verma", "todo", "low", -12, 6, null},
            {"Client gallery setup", "Online gallery + contract links.", "Agarwal Godh Bharai", "Ishita Gupta", "done", "low", 3, 3, 2},
        };
        for (Object[] t : tasks) {
            int due = (Integer) t[6];
            Integer done = (Integer) t[8];
            jdbc.update("""
                INSERT INTO tasks (title, description, project_id, assignee_id, status, priority, due_date, estimated_hours, completed_at)
                VALUES (:title, :desc, (SELECT id FROM projects WHERE name = :project), (SELECT id FROM users WHERE name = :assignee),
                        :status, :priority, :due, :hours, :done)
                """, new MapSqlParameterSource()
                    .addValue("title", t[0]).addValue("desc", t[1]).addValue("project", t[2]).addValue("assignee", t[3])
                    .addValue("status", t[4]).addValue("priority", t[5])
                    .addValue("due", due > 0 ? daysAgo(due) : daysAhead(-due)).addValue("hours", t[7])
                    .addValue("done", done == null ? null : LocalDateTime.now().minusDays(done).format(DT)));
        }

        // ---------------- ASSETS ----------------
        Object[][] assets = {
            {"Gupta_Wedding_Card1_RAW.zip", "document", "Gupta Wedding — Full Coverage", "Rohit Menon", 18200, 210, "raw, backup", "Card 1 RAW archive (verified checksum).", "/media/raw/gupta-card1.zip"},
            {"Gupta_Ceremony_Graded_Batch1.lr", "design", "Gupta Wedding — Full Coverage", "Priya Patel", 340, 280, "lightroom, grade", "Lightroom catalogue — ceremony batch 1.", "/media/design/gupta-batch1.lr"},
            {"Engagement_Album_Layout_v2.pdf", "design", "Rohan & Sneha — Engagement", "Aditi Rao", 88, 30, "album, layout", "Album layout v2 — story flow.", "/media/design/engagement-album-v2.pdf"},
            {"Kapoor_Anniversary_Assembly.mp4", "video", "Kapoor 25th Anniversary", "Farhan Ali", 4200, 130, "film, assembly", "Highlight film assembly cut.", "/media/films/kapoor-assembly.mp4"},
            {"Kapoor_Final_Highlight_4K.mp4", "video", "Kapoor Family Video Highlights", "Meera Nambiar", 8900, 130, "final, 4k", "Delivered 5-minute highlight master.", "/media/films/kapoor-final-4k.mp4"},
            {"TechNova_Conference_Day1.zip", "document", "TechNova Annual Conference", "Arnav Singh", 9600, 260, "raw, corporate", "Day 1 RAW archive.", "/media/raw/technova-day1.zip"},
            {"PreWedding_Loc2_Graded.jpg", "image", "Meera's Pre-Wedding Shoot", "Sneha Kulkarni", 24, 45, "grade, still", "Location 2 hero graded still.", "/media/stills/prewedding-loc2.jpg"},
            {"Desai_StoryBook_Part1.pdf", "design", "Desai Album — Story Book", "Aditi Rao", 120, 275, "album, storybook", "Story book spread design part 1.", "/media/design/desai-storybook-p1.pdf"},
            {"Desai_Wedding_Highlight_Assembly.mp4", "video", "Aarav & Nisha — Highlight Film", "Meera Nambiar", 6100, 275, "film, assembly", "6-minute assembly cut.", "/media/films/desai-assembly.mp4"},
            {"Goa_Album_FinalReview.pdf", "design", "Aarav & Nisha — Destination Wedding", "Aryan Kapoor", 210, 275, "album, print", "Print-ready album PDF for review.", "/media/design/goa-album-review.pdf"},
            {"Goa_Wedding_QC_Checklist.pdf", "document", "Aarav & Nisha — Destination Wedding", "Zoya Khan", 4, 320, "qc, checklist", "Final review checklist — signed.", "/media/docs/goa-qc.pdf"},
            {"Gupta_Teasers_15s_Reels.mp4", "video", "Gupta Wedding — Teaser Reels", "Divya Krishnan", 1800, 210, "teaser, social", "15s vertical teasers.", "/media/films/gupta-teasers.mp4"},
            {"Anniversary_Music_Bed.wav", "audio", "Kapoor 25th Anniversary", "Farhan Ali", 310, 130, "music, audio", "Licensed music bed.", "/media/audio/kapoor-music.wav"},
            {"Bridal_Portrait_Moodboard.pdf", "document", "Nisha's Bridal Portraits", "Aditya Rao", 26, 275, "moodboard, proposal", "Package proposal + moodboard.", "/media/docs/bridal-moodboard.pdf"},
            {"GodhBharai_Shotlist.pdf", "document", "Agarwal Godh Bharai", "Sanjay Verma", 2, 160, "shotlist, plan", "Shoot-day plan.", "/media/docs/godh-shotlist.pdf"},
            {"Engagement_Album_Cover_Concepts.pdf", "design", "Rohan & Sneha — Engagement", "Aryan Kapoor", 64, 30, "cover, concepts", "Premium cover concepts.", "/media/design/engagement-cover.pdf"},
            {"Gupta_Album_40Page_Design.pdf", "design", "Gupta Album — 40 Page Premium", "Aditi Rao", 150, 210, "album, 40page", "40-page album design v2.", "/media/design/gupta-album-40.pdf"},
            {"Kapoor_Ceremony_Sequence.mp4", "video", "Kapoor 25th Anniversary", "Divya Krishnan", 3600, 130, "ceremony, timeline", "Ceremony sequence pass.", "/media/films/kapoor-ceremony.mp4"},
        };
        for (Object[] a : assets) {
            jdbc.update("""
                INSERT INTO assets (name, type, project_id, uploaded_by, size_mb, hue, tags, description, url)
                VALUES (:name, :type, (SELECT id FROM projects WHERE name = :project), (SELECT id FROM users WHERE name = :uploader),
                        :size, :hue, :tags, :desc, :url)
                """, new MapSqlParameterSource()
                    .addValue("name", a[0]).addValue("type", a[1]).addValue("project", a[2]).addValue("uploader", a[3])
                    .addValue("size", a[4]).addValue("hue", a[5]).addValue("tags", a[6]).addValue("desc", a[7]).addValue("url", a[8]));
        }

        // ---------------- PHOTOS (client gallery & album approval) ----------------
        // name, project, category, size_mb, capturedDaysAgo, status, uploader
        Object[][] photos = {
            {"Gupta_Ceremony_001.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 9, 12, "approved", "Kabir Khan"},
            {"Gupta_Ceremony_002.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 8, 12, "approved", "Kabir Khan"},
            {"Gupta_Ceremony_003.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 9, 12, "selected", "Kabir Khan"},
            {"Gupta_Ceremony_004.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 7, 12, "selected", "Kabir Khan"},
            {"Gupta_Varmala_005.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 8, 11, "selected", "Priya Patel"},
            {"Gupta_Varmala_006.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 9, 11, "uploaded", "Priya Patel"},
            {"Gupta_Pheras_007.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 10, 11, "uploaded", "Priya Patel"},
            {"Gupta_Pheras_008.jpg", "Gupta Wedding — Full Coverage", "Ceremony", 9, 11, "uploaded", "Priya Patel"},
            {"Gupta_Portraits_009.jpg", "Gupta Wedding — Full Coverage", "Portraits", 12, 9, "selected", "Sneha Kulkarni"},
            {"Gupta_Portraits_010.jpg", "Gupta Wedding — Full Coverage", "Portraits", 11, 9, "uploaded", "Sneha Kulkarni"},
            {"Gupta_Reception_011.jpg", "Gupta Wedding — Full Coverage", "Reception", 9, 8, "uploaded", "Sneha Kulkarni"},
            {"Gupta_Reception_012.jpg", "Gupta Wedding — Full Coverage", "Reception", 10, 8, "uploaded", "Sneha Kulkarni"},
            {"RohanSneha_Engagement_001.jpg", "Rohan & Sneha — Engagement", "Engagement", 8, 22, "approved", "Kabir Khan"},
            {"RohanSneha_Engagement_002.jpg", "Rohan & Sneha — Engagement", "Engagement", 9, 22, "selected", "Kabir Khan"},
            {"RohanSneha_Engagement_003.jpg", "Rohan & Sneha — Engagement", "Engagement", 8, 22, "selected", "Kabir Khan"},
            {"RohanSneha_Couple_004.jpg", "Rohan & Sneha — Engagement", "Couple", 11, 20, "selected", "Priya Patel"},
            {"RohanSneha_Couple_005.jpg", "Rohan & Sneha — Engagement", "Couple", 10, 20, "uploaded", "Priya Patel"},
            {"RohanSneha_Family_006.jpg", "Rohan & Sneha — Engagement", "Family", 7, 20, "uploaded", "Priya Patel"},
            {"PreWedding_Loc1_001.jpg", "Meera's Pre-Wedding Shoot", "Pre-Wedding", 12, 15, "selected", "Sneha Kulkarni"},
            {"PreWedding_Loc1_002.jpg", "Meera's Pre-Wedding Shoot", "Pre-Wedding", 13, 15, "selected", "Sneha Kulkarni"},
            {"PreWedding_Loc1_003.jpg", "Meera's Pre-Wedding Shoot", "Pre-Wedding", 11, 15, "uploaded", "Sneha Kulkarni"},
            {"PreWedding_Loc2_004.jpg", "Meera's Pre-Wedding Shoot", "Pre-Wedding", 12, 14, "uploaded", "Sneha Kulkarni"},
            {"PreWedding_Loc2_005.jpg", "Meera's Pre-Wedding Shoot", "Pre-Wedding", 14, 14, "uploaded", "Sneha Kulkarni"},
            {"Kapoor_Anniversary_001.jpg", "Kapoor 25th Anniversary", "Celebration", 8, 10, "approved", "Arnav Singh"},
            {"Kapoor_Anniversary_002.jpg", "Kapoor 25th Anniversary", "Celebration", 7, 10, "selected", "Arnav Singh"},
            {"Kapoor_Anniversary_003.jpg", "Kapoor 25th Anniversary", "Celebration", 9, 10, "uploaded", "Arnav Singh"},
            {"Kapoor_Cake_004.jpg", "Kapoor 25th Anniversary", "Celebration", 6, 10, "uploaded", "Arnav Singh"},
            {"TechNova_Conference_001.jpg", "TechNova Annual Conference", "Corporate", 6, 4, "uploaded", "Arnav Singh"},
            {"TechNova_Conference_002.jpg", "TechNova Annual Conference", "Corporate", 5, 4, "uploaded", "Arnav Singh"},
            {"TechNova_Stage_003.jpg", "TechNova Annual Conference", "Corporate", 7, 4, "uploaded", "Rohit Menon"},
            {"Desai_Goa_Beach_001.jpg", "Aarav & Nisha — Destination Wedding", "Destination", 12, 30, "approved", "Kabir Khan"},
            {"Desai_Goa_Beach_002.jpg", "Aarav & Nisha — Destination Wedding", "Destination", 13, 30, "selected", "Kabir Khan"},
            {"Desai_Goa_Beach_003.jpg", "Aarav & Nisha — Destination Wedding", "Destination", 11, 30, "selected", "Kabir Khan"},
            {"Desai_Mandap_004.jpg", "Aarav & Nisha — Destination Wedding", "Ceremony", 10, 29, "selected", "Priya Patel"},
            {"Desai_Mandap_005.jpg", "Aarav & Nisha — Destination Wedding", "Ceremony", 10, 29, "uploaded", "Priya Patel"},
            {"Desai_Evening_006.jpg", "Aarav & Nisha — Destination Wedding", "Reception", 12, 28, "uploaded", "Priya Patel"},
            {"Desai_Evening_007.jpg", "Aarav & Nisha — Destination Wedding", "Reception", 11, 28, "uploaded", "Sneha Kulkarni"},
            {"Desai_Portraits_008.jpg", "Aarav & Nisha — Destination Wedding", "Portraits", 14, 27, "uploaded", "Sneha Kulkarni"},
        };
        for (Object[] ph : photos) {
            jdbc.update("""
                INSERT INTO photos (project_id, name, url, category, size_mb, captured_on, status, uploaded_by, created_by)
                VALUES ((SELECT id FROM projects WHERE name = :project), :name, :url, :category, :size, :captured, :status,
                        (SELECT id FROM users WHERE name = :uploader), (SELECT id FROM users WHERE name = :uploader))
                """, new MapSqlParameterSource()
                    .addValue("project", ph[1]).addValue("name", ph[0])
                    .addValue("url", "/media/gallery/" + ((String) ph[0]).toLowerCase())
                    .addValue("category", ph[2]).addValue("size", ph[3])
                    .addValue("captured", daysAgo((Integer) ph[4]))
                    .addValue("status", ph[5]).addValue("uploader", ph[6]));
        }

        // ---------------- TIMESHEETS ----------------
        String[] tsStaff = {"Priya Patel", "Sneha Kulkarni", "Kabir Khan", "Farhan Ali", "Divya Krishnan",
                "Meera Nambiar", "Aditi Rao", "Aryan Kapoor", "Rohit Menon", "Arnav Singh", "Zoya Khan"};
        String[] tsProject = {"Gupta Wedding — Full Coverage", "Meera's Pre-Wedding Shoot", "Gupta Wedding — Full Coverage",
                "Aarav & Nisha — Highlight Film", "Kapoor Family Video Highlights", "Aarav & Nisha — Highlight Film",
                "Rohan & Sneha — Engagement", "Desai Album — Story Book", "Gupta Wedding — Full Coverage",
                "TechNova Annual Conference", "Aarav & Nisha — Destination Wedding"};
        for (int i = 0; i < 12; i++) {
            for (int s = 0; s < tsStaff.length; s++) {
                LocalDate date = LocalDate.now().minusDays(i + 1);
                if (date.getDayOfWeek().getValue() >= 6) continue;
                double hours = Math.round((6 + rnd.nextDouble() * 3.5) * 2) / 2.0;
                String status = i >= 4 ? "approved" : (rnd.nextDouble() > 0.3 ? "pending" : "rejected");
                jdbc.update("""
                    INSERT INTO timesheets (user_id, project_id, date, hours, description, status)
                    VALUES ((SELECT id FROM users WHERE name = :user), (SELECT id FROM projects WHERE name = :project),
                            :date, :hours, :desc, :status)
                    """, new MapSqlParameterSource()
                        .addValue("user", tsStaff[s]).addValue("project", tsProject[s]).addValue("date", date.toString())
                        .addValue("hours", hours).addValue("desc", "Production stage work — see project board.").addValue("status", status));
            }
        }

        // ---------------- ATTENDANCE (previous 14 days; today free for check-in) ----------------
        String[] attStaff = {"Priya Patel", "Sneha Kulkarni", "Kabir Khan", "Farhan Ali", "Divya Krishnan",
                "Meera Nambiar", "Aditi Rao", "Aryan Kapoor", "Rohit Menon", "Arnav Singh", "Zoya Khan",
                "Rahul Sharma", "Sanjay Verma", "Aditya Rao", "Ishita Gupta", "Ananya Iyer", "Vikram Nair"};
        for (int i = 1; i <= 14; i++) {
            LocalDate date = LocalDate.now().minusDays(i);
            if (date.getDayOfWeek().getValue() >= 6) continue;
            for (String name : attStaff) {
                double roll = rnd.nextDouble();
                String status = "present";
                String checkIn = String.format("%d:%02d", 9 + rnd.nextInt(2), rnd.nextInt(60));
                String checkOut = null;
                if (roll > 0.88) { status = "late"; checkIn = String.format("10:%02d", 10 + rnd.nextInt(40)); }
                else if (roll > 0.82) { status = "wfh"; checkIn = null; }
                else if (roll > 0.78) { status = "half_day"; checkOut = "13:30"; }
                if (checkOut == null && !"wfh".equals(status)) checkOut = String.format("18:%02d", rnd.nextInt(50));
                jdbc.update("""
                    INSERT INTO attendance (user_id, date, check_in, check_out, status)
                    VALUES ((SELECT id FROM users WHERE name = :user), :date, :ci, :co, :status)
                    """, new MapSqlParameterSource()
                        .addValue("user", name).addValue("date", date.toString())
                        .addValue("ci", checkIn).addValue("co", checkOut).addValue("status", status));
            }
        }

        // ---------------- PAYROLL ----------------
        for (int m = 2; m >= 0; m--) {
            for (Object[] u : users) {
                if ("owner".equals(u[2])) continue;
                int salary = (Integer) u[9];
                int bonus = rnd.nextDouble() > 0.6 ? (int) Math.round(salary * (0.05 + rnd.nextDouble() * 0.1)) : 0;
                int deductions = rnd.nextDouble() > 0.75 ? (int) Math.round(salary * 0.05) : 0;
                int net = salary + bonus - deductions;
                String status = m == 0 ? "draft" : "paid";
                jdbc.update("""
                    INSERT INTO payroll (user_id, month, base_salary, bonus, deductions, net, status, paid_at)
                    VALUES ((SELECT id FROM users WHERE name = :user), :month, :base, :bonus, :ded, :net, :status,
                            CASE WHEN :status = 'paid' THEN TIMESTAMP(CONCAT(:month, '-05 10:00:00')) ELSE NULL END)
                    """, new MapSqlParameterSource()
                        .addValue("user", u[0]).addValue("month", month(m)).addValue("base", salary)
                        .addValue("bonus", bonus).addValue("ded", deductions).addValue("net", net).addValue("status", status));
            }
        }

        // ---------------- INVOICES & PAYMENTS (GST) ----------------
        // invoice: project, issuedDaysAgo, dueInDays(+ = daysAhead offset as negative for daysAhead), base, gstRate, advance, status, notes
        Object[][] invoices = {
            {"Aarav & Nisha — Destination Wedding", 30, -6, 350000, 18, 150000, "partial", "Advance taken at booking; balance due before delivery."},
            {"Gupta Wedding — Full Coverage", 15, -15, 280000, 18, 100000, "partial", "Wedding package invoice."},
            {"Rohan & Sneha — Engagement", 20, -10, 120000, 18, 60000, "partial", "Engagement + pre-wedding shoot."},
            {"Kapoor 25th Anniversary", 8, -20, 90000, 18, 90000, "paid", "Paid in full on the day."},
            {"TechNova Annual Conference", 3, -25, 75000, 18, 0, "draft", "Corporate invoice — awaiting billing details."},
            {"Agarwal Godh Bharai", 1, -30, 45000, 18, 20000, "partial", "Booking advance received."},
        };
        for (Object[] inv : invoices) {
            double base = (Integer) inv[3];
            double gst = Math.round(base * ((Integer) inv[4]) / 100.0 * 100.0) / 100.0;
            double total = base + gst;
            double advance = (Integer) inv[5];
            double balance = Math.round((total - advance) * 100.0) / 100.0;
            String invoiceNo = "INV-2026-" + String.format("%04d", 100 + rnd.nextInt(900));
            String status = (String) inv[6];
            jdbc.update("""
                INSERT INTO invoices (project_id, client_id, invoice_no, issued_on, due_on, base_amount, gst_rate,
                                      gst_amount, total_amount, advance_paid, balance, status, notes, created_by)
                VALUES ((SELECT id FROM projects WHERE name = :project), (SELECT client_id FROM projects WHERE name = :project),
                        :no, :issued, :due, :base, :gstRate, :gst, :total, :advance, :balance, :status, :notes,
                        (SELECT id FROM users WHERE name = 'Vikram Nair'))
                """, new MapSqlParameterSource()
                    .addValue("project", inv[0]).addValue("no", invoiceNo)
                    .addValue("issued", daysAgo((Integer) inv[1]))
                    .addValue("due", (Integer) inv[2] < 0 ? daysAhead(-(Integer) inv[2]) : daysAgo((Integer) inv[2]))
                    .addValue("base", base).addValue("gstRate", inv[4]).addValue("gst", gst).addValue("total", total)
                    .addValue("advance", advance).addValue("balance", balance).addValue("status", status)
                    .addValue("notes", inv[7]));
            if (advance > 0) {
                jdbc.update("""
                    INSERT INTO payments (invoice_id, amount, paid_on, method, reference, notes, recorded_by)
                    VALUES (LAST_INSERT_ID(), :amt, :date, 'bank', 'NEFT/UPI', 'Advance at booking',
                            (SELECT id FROM users WHERE name = 'Meera Shah'))
                    """, new MapSqlParameterSource()
                        .addValue("amt", advance).addValue("date", daysAgo((Integer) inv[1])));
            }
        }

        // ---------------- ACTIVITY ----------------
        Object[][] activity = {
            {"Zoya Khan", "approved", "project", "Released 'Kapoor Family Video Highlights' to delivery"},
            {"Sanjay Verma", "moved", "project", "Advanced 'Gupta Wedding — Full Coverage' to Lightroom"},
            {"Aditi Rao", "updated", "task", "Updated 'Album layout v2 — story flow' to In Progress"},
            {"Zoya Khan", "completed", "task", "Completed 'Final review — film QC'"},
            {"Rahul Sharma", "created", "project", "Booked 'Agarwal Godh Bharai'"},
            {"Arnav Singh", "uploaded", "asset", "Uploaded TechNova_Conference_Day1.zip"},
            {"Ananya Iyer", "added", "employee", "Added Aryan Kapoor as Senior Album Designer"},
            {"Meera Nambiar", "completed", "task", "Completed 'Deliver 5-min highlight master'"},
            {"Vikram Nair", "processed", "payroll", "Marked payroll as paid"},
            {"Aditya Rao", "created", "client", "Added client Desai Wedding"},
            {"Priya Patel", "updated", "task", "Moved 'Lightroom colour grade — batch 1' to In Progress"},
            {"Kavya Reddy", "updated", "employee", "Updated Zoya Khan's profile"},
            {"Ishita Gupta", "completed", "task", "Completed 'Client gallery setup'"},
            {"Arjun Mehta", "approved", "project", "Signed off final review for 'Aarav & Nisha — Destination Wedding'"},
        };
        for (int i = 0; i < activity.length; i++) {
            Object[] a = activity[i];
            String createdAt = LocalDateTime.now().minusHours(i * 5 + 2).format(DT);
            jdbc.update("""
                INSERT INTO activity (user_id, action, target_type, details, created_at)
                VALUES ((SELECT id FROM users WHERE name = :user), :action, :target, :details, :created)
                """, new MapSqlParameterSource()
                    .addValue("user", a[0]).addValue("action", a[1]).addValue("target", a[2])
                    .addValue("details", a[3]).addValue("created", createdAt));
        }

        log.info("Seeded: 20 employees, 7 clients, 13 projects, 28 tasks, 18 assets, 38 gallery photos, timesheets, attendance, payroll.");
        log.info("Demo login: owner@lumina.studio / demo123 (and other roles)");
    }
}
