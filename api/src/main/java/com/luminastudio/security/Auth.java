package com.luminastudio.security;

import com.luminastudio.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Helpers used by controllers: pull the authenticated user set by the JWT
 * filter, and enforce capability checks (same semantics as the old API).
 */
public final class Auth {

    public static final String ATTR = "authUser";

    private Auth() {}

    /** The authenticated user as a map (id, name, email, role, department, position, status). */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> user(HttpServletRequest req) {
        Map<String, Object> u = (Map<String, Object>) req.getAttribute(ATTR);
        if (u == null) throw new ApiException(401, "Authentication required");
        return u;
    }

    public static String role(HttpServletRequest req) {
        Object r = user(req).get("role");
        return r == null ? "staff" : String.valueOf(r);
    }

    public static int id(HttpServletRequest req) {
        return ((Number) user(req).get("id")).intValue();
    }

    /**
     * True for the pre-seeded demo accounts (they share the sample workspace).
     * Real (signed-up) accounts get an isolated workspace — they only ever see
     * records they created themselves, never the mock/demo data.
     */
    public static boolean isDemo(HttpServletRequest req) {
        Object v = user(req).get("is_demo");
        if (v instanceof Boolean) return (Boolean) v;
        if (v instanceof Number) return ((Number) v).intValue() != 0;
        return "1".equals(String.valueOf(v)) || "true".equalsIgnoreCase(String.valueOf(v));
    }

    /** Throws 403 unless the record belongs to the caller (real-account isolation). */
    public static void requireOwnership(HttpServletRequest req, Map<String, Object> row, String recordName) {
        if (isDemo(req)) return; // demo accounts share the whole workspace
        Object createdBy = row.get("created_by");
        if (createdBy == null || ((Number) createdBy).intValue() != id(req)) {
            throw new ApiException(403, "You can only manage your own " + recordName);
        }
    }

    /** Throws 403 unless the authenticated role holds the capability. */
    public static Map<String, Object> require(HttpServletRequest req, String perm) {
        Map<String, Object> u = user(req);
        String role = String.valueOf(u.get("role"));
        if (!Permissions.has(role, perm)) {
            throw new ApiException(403, "You need the \"" + perm + "\" permission for this action. " +
                    "Your role (" + role + ") has access level " + Permissions.LEVELS.getOrDefault(role, 0) + ".");
        }
        return u;
    }

    /**
     * Serializes a users-table row for API responses.
     * Salary is included only for privileged viewers (owner/admin/hr/finance),
     * exactly like the old API's serializeUser().
     */
    public static Map<String, Object> serializeUser(Map<String, Object> row, String viewerRole) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", row.get("id"));
        out.put("name", row.get("name"));
        out.put("email", row.get("email"));
        out.put("role", row.get("role"));
        out.put("department", row.get("department"));
        out.put("position", row.get("position"));
        out.put("phone", row.get("phone"));
        out.put("location", row.get("location"));
        out.put("bio", row.get("bio"));
        out.put("skills", row.get("skills"));
        if (Permissions.has(viewerRole, "salary.view")) out.put("salary", row.get("salary"));
        out.put("hire_date", row.get("hire_date"));
        out.put("status", row.get("status"));
        out.put("avatar_hue", row.get("avatar_hue"));
        out.put("created_at", row.get("created_at"));
        return out;
    }
}
