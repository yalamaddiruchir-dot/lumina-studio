package com.luminastudio.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * SPA deep-link fallback. The React frontend is bundled in the jar
 * (classpath:/static) — Spring serves index.html at "/" and /assets/**
 * automatically with correct MIME types. This filter forwards non-API,
 * non-file GET routes (e.g. /dashboard, /projects/2) to the SPA shell so
 * client-side routing works on refresh and deep links.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SpaFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean get = "GET".equalsIgnoreCase(request.getMethod());
        boolean api = path.startsWith("/api");
        boolean hasDot = path.matches(".*\\.[a-zA-Z0-9]{1,6}$"); // files: .js .css .png .woff2 …
        boolean root = "/".equals(path);

        if (get && !api && !hasDot && !root) {
            request.getRequestDispatcher("/index.html").forward(request, response);
            return;
        }
        chain.doFilter(request, response);
    }
}
