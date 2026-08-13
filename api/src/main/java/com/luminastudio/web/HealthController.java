package com.luminastudio.web;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GET /api/health — used by Docker healthchecks, UptimeRobot, etc.
 * GET /api/** that matches nothing → { "error": "Not found" } (404), same as the old API.
 */
@RestController
public class HealthController implements ErrorController {

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("app", "Lumina Studios");
        out.put("env", System.getProperty("app.env", "development"));
        out.put("version", "v2.6.1");
        out.put("demo", "true".equalsIgnoreCase(System.getenv("SEED_DEMO")) || "true".equalsIgnoreCase(System.getProperty("SEED_DEMO", "false")));
        out.put("time", OffsetDateTime.now().toString());
        return out;
    }

    @RequestMapping("/api/**")
    public Map<String, Object> notFound() {
        throw new ApiException(404, "Not found");
    }
}
