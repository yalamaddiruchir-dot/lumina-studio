package com.luminastudio;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LuminaApplication {

    private static final String DEV_SECRET = "lumina-dev-only-secret-please-change-me-0123456789";

    public static void main(String[] args) {
        boolean prod = Boolean.parseBoolean(System.getenv("PROD"));
        String secret = System.getenv("JWT_SECRET");
        if (prod && (secret == null || secret.isBlank() || DEV_SECRET.equals(secret))) {
            System.err.println("[config] Fatal: JWT_SECRET must be set in production. Generate one with: openssl rand -hex 32");
            System.exit(1);
        }
        SpringApplication.run(LuminaApplication.class, args);
    }
}
