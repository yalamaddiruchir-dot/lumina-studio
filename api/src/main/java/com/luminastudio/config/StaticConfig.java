package com.luminastudio.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Serves the built frontend assets (client/dist) when present.
 * In dev (no dist) the Vite dev server on :5173 serves the UI instead.
 */
@Configuration
public class StaticConfig implements WebMvcConfigurer {

    private static final Path DIST = Path.of("client", "dist");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        if (!Files.isDirectory(DIST)) return; // dev mode — skip
        String base = DIST.toAbsolutePath().toUri().toString();
        registry.addResourceHandler("/assets/**").addResourceLocations(base + "assets/");
        registry.addResourceHandler("/*.png", "/*.svg", "/*.ico", "/*.txt", "/*.json", "/*.webmanifest")
                .addResourceLocations(base);
    }
}
