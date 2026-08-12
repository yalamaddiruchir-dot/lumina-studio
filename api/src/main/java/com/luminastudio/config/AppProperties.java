package com.luminastudio.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

/**
 * App-level configuration, driven by environment variables (application.yml).
 */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String jwtSecret;
    private boolean seedDemo = true;
    private String corsOrigins = "";
    private boolean prod = false;
    private int loginRateLimit = 20;

    public String jwtSecret() { return jwtSecret; }
    public boolean seedDemo() { return seedDemo; }
    public boolean prod() { return prod; }
    public int loginRateLimit() { return loginRateLimit; }

    public List<String> corsOrigins() {
        return Arrays.stream(corsOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public void setJwtSecret(String v) { this.jwtSecret = v; }
    public void setSeedDemo(boolean v) { this.seedDemo = v; }
    public void setCorsOrigins(String v) { this.corsOrigins = v; }
    public void setProd(boolean v) { this.prod = v; }
    public void setLoginRateLimit(int v) { this.loginRateLimit = v; }
}
