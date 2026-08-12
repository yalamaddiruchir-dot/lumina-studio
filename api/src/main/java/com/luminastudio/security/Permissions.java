package com.luminastudio.security;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Role → capability matrix. Single source of truth for access control.
 *
 * Org chart (wedding/album studio):
 *   OWNER
 *   ├── Management          → manager (Manager, Project Manager)
 *   ├── Production Team     → production (Data Copy / Lightroom / Video / Album), quality (Final Review)
 *   ├── Sales & Client Mgmt → sales (Sales Executive, Client Coordinator)
 *   ├── Finance             → finance (Accountant, Billing Executive)
 *   └── Administration      → admin (System Administrator), hr (HR / Admin)
 *
 * Workflow pipeline: booked → data_copy → lightroom → video → album → final_review → delivered
 */
public final class Permissions {

    public static final List<String> PIPELINE = List.of(
            "booked", "data_copy", "lightroom", "video", "album", "final_review", "delivered");

    public static final Map<String, Integer> LEVELS = new LinkedHashMap<>();
    public static final Map<String, String> LABELS = new LinkedHashMap<>();
    public static final Map<String, String> CAP_LABELS = new LinkedHashMap<>();

    static {
        LEVELS.put("owner", 5);
        LEVELS.put("admin", 4);
        LEVELS.put("manager", 3);
        LEVELS.put("hr", 3);
        LEVELS.put("finance", 3);
        LEVELS.put("sales", 2);
        LEVELS.put("quality", 2);
        LEVELS.put("production", 1);

        LABELS.put("owner", "Owner");
        LABELS.put("admin", "System Admin");
        LABELS.put("manager", "Manager");
        LABELS.put("hr", "HR / Admin");
        LABELS.put("finance", "Finance");
        LABELS.put("sales", "Sales");
        LABELS.put("quality", "Quality Control");
        LABELS.put("production", "Production");

        CAP_LABELS.put("dashboard.view", "View dashboard");
        CAP_LABELS.put("employees.view", "View employees");
        CAP_LABELS.put("employees.manage", "Add / edit employees");
        CAP_LABELS.put("employees.delete", "Remove employees");
        CAP_LABELS.put("salary.view", "View salaries");
        CAP_LABELS.put("clients.view", "View clients");
        CAP_LABELS.put("clients.manage", "Add / edit / remove clients");
        CAP_LABELS.put("projects.view", "View projects");
        CAP_LABELS.put("projects.manage", "Create / edit projects");
        CAP_LABELS.put("projects.delete", "Delete projects");
        CAP_LABELS.put("pipeline.advance", "Advance project stage");
        CAP_LABELS.put("tasks.view_all", "View all tasks");
        CAP_LABELS.put("tasks.manage", "Create / edit / delete tasks");
        CAP_LABELS.put("tasks.own", "Update own tasks");
        CAP_LABELS.put("assets.view", "View media assets");
        CAP_LABELS.put("assets.upload", "Upload assets");
        CAP_LABELS.put("assets.delete", "Delete assets");
        CAP_LABELS.put("timesheets.view_all", "View all timesheets");
        CAP_LABELS.put("timesheets.submit", "Submit timesheets");
        CAP_LABELS.put("timesheets.approve", "Approve / reject timesheets");
        CAP_LABELS.put("attendance.view_all", "View all attendance");
        CAP_LABELS.put("attendance.checkin", "Check in / out");
        CAP_LABELS.put("payroll.view", "View payroll");
        CAP_LABELS.put("invoices.view", "View invoices & payments");
        CAP_LABELS.put("estimates.view", "View estimations");
        CAP_LABELS.put("estimates.manage", "Create / manage estimations");
        CAP_LABELS.put("inventory.view", "View inventory");
        CAP_LABELS.put("inventory.manage", "Manage inventory");
        CAP_LABELS.put("invoices.manage", "Create / manage invoices & record payments");
        CAP_LABELS.put("payroll.manage", "Process / mark payroll paid");
        CAP_LABELS.put("activity.view", "View activity log");
        CAP_LABELS.put("access.view", "View access control matrix");
    }

    public static final List<String> CAPABILITIES = List.copyOf(CAP_LABELS.keySet());

    private static List<String> caps(String... keys) { return List.of(keys); }

    public static final Map<String, List<String>> MATRIX = new LinkedHashMap<>();

    static {
        MATRIX.put("owner", CAPABILITIES);

        MATRIX.put("admin", caps(
                "dashboard.view", "employees.view",
                "salary.view", "clients.view", "clients.manage", "projects.view",
                "projects.manage", "projects.delete", "pipeline.advance", "tasks.view_all",
                "tasks.manage", "assets.view", "assets.upload", "assets.delete",
                "timesheets.view_all", "timesheets.submit", "timesheets.approve",
                "attendance.view_all", "attendance.checkin", "payroll.view",
                "invoices.view", "invoices.manage", "activity.view", "access.view"));

        MATRIX.put("manager", caps(
                "dashboard.view", "employees.view", "employees.manage", "employees.delete",
                "clients.view", "clients.manage", "projects.view", "projects.manage",
                "projects.delete", "pipeline.advance", "estimates.view", "estimates.manage",
                "inventory.view",
                "tasks.view_all", "tasks.manage", "assets.view", "assets.upload",
                "assets.delete", "timesheets.view_all", "timesheets.submit",
                "timesheets.approve", "attendance.checkin", "invoices.view", "activity.view"));

        MATRIX.put("hr", caps(
                "dashboard.view", "employees.view", "employees.manage", "employees.delete",
                "salary.view", "clients.view", "projects.view", "tasks.view_all",
                "assets.view", "timesheets.view_all", "timesheets.submit",
                "attendance.view_all", "attendance.checkin", "activity.view"));

        MATRIX.put("finance", caps(
                "dashboard.view", "employees.view", "salary.view", "clients.view",
                "projects.view", "tasks.view_all", "assets.view", "timesheets.view_all",
                "timesheets.submit", "timesheets.approve", "attendance.view_all",
                "payroll.view", "payroll.manage", "invoices.view", "invoices.manage", "activity.view"));

        MATRIX.put("sales", caps(
                "dashboard.view", "clients.view", "clients.manage", "projects.view",
                "projects.manage", "tasks.own", "assets.view", "timesheets.submit",
                "attendance.checkin", "invoices.view"));

        MATRIX.put("quality", caps(
                "dashboard.view", "projects.view", "pipeline.advance", "tasks.own",
                "assets.view", "assets.upload", "timesheets.submit", "attendance.checkin"));

        MATRIX.put("production", caps(
                "dashboard.view", "projects.view", "tasks.own", "assets.view",
                "assets.upload", "timesheets.submit", "attendance.checkin"));
    }

    public static boolean has(String role, String perm) {
        if (role == null) return false;
        if (LEVELS.getOrDefault(role, 0) == 5) return true; // owner
        return MATRIX.getOrDefault(role, List.of()).contains(perm);
    }

    /** Next stage in the pipeline, or null if at the end / already delivered. */
    public static String nextStage(String current) {
        int i = PIPELINE.indexOf(current);
        if (i < 0 || i >= PIPELINE.size() - 1) return null;
        return PIPELINE.get(i + 1);
    }

    /** Builds the { levels, labels, capabilities, matrix } payload for the Access Control page. */
    public static Map<String, Object> meta() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("levels", LEVELS);
        out.put("labels", LABELS);
        List<Map<String, String>> caps = new ArrayList<>();
        for (String key : CAPABILITIES) {
            Map<String, String> c = new LinkedHashMap<>();
            c.put("key", key);
            c.put("label", CAP_LABELS.get(key));
            caps.add(c);
        }
        out.put("capabilities", caps);
        out.put("matrix", MATRIX);
        return out;
    }
}
