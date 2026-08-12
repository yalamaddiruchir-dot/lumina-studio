package com.luminastudio.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Path;

/**
 * Serves the built React frontend (client/dist) from the same process as the API.
 *
 * - /api/** and /assets/** → pass through to Spring/static handlers.
 * - Any other GET → the SPA shell (index.html) so client-side routes
 *   (/dashboard, /projects/2, …) work on refresh and deep links.
 * - If client/dist isn't present (e.g. dev mode with Vite), requests just 404
 *   normally — the dev frontend is served by Vite on :5173.
 *
 * Order is before Spring Security so public static content is reachable;
 * /api/** stays fully secured.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SpaFilter extends OncePerRequestFilter {

    private static final Path DIST = Path.of("client", "dist");
    private static final Path INDEX = DIST.resolve("index.html");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean get = "GET".equalsIgnoreCase(request.getMethod());
        boolean api = path.startsWith("/api");
        boolean asset = path.startsWith("/assets/");
        boolean dotFile = path.matches(".*\\.[a-z0-9]{1,6}$"); // .png .js .css .woff2 …

        if (get && !api && !asset && !dotFile && INDEX.toFile().isFile()) {
            response.setStatus(200);
            response.setContentType("text/html");
            response.setCharacterEncoding("UTF-8");
            try (FileInputStream in = new FileInputStream(INDEX.toFile())) {
                in.transferTo(response.getOutputStream());
            }
            return;
        }
        chain.doFilter(request, response);
    }
}
