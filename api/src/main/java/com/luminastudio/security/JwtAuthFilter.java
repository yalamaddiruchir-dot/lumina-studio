package com.luminastudio.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Reads "Authorization: Bearer <token>", verifies it, reloads the user from the
 * DB (fresh role/status), and stashes the user map on the request for controllers.
 * Invalid/expired tokens → 401 JSON (same message as the old API).
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final NamedParameterJdbcTemplate jdbc;

    public JwtAuthFilter(JwtService jwtService, NamedParameterJdbcTemplate jdbc) {
        this.jwtService = jwtService;
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }
        String token = header.substring(7);
        try {
            Claims claims = jwtService.parse(token);
            int id = Integer.parseInt(claims.getSubject());
            Map<String, Object> user = jdbc.queryForMap(
                    "SELECT id, name, email, role, department, position, status, is_demo FROM users WHERE id = :id",
                    Map.of("id", id));
            if (user == null || user.isEmpty() || "inactive".equals(user.get("status"))) {
                write401(response, "Account no longer exists");
                return;
            }
            request.setAttribute(Auth.ATTR, user);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    id, null, List.of(new SimpleGrantedAuthority("ROLE_" + String.valueOf(user.get("role"))))));
        } catch (JwtException | IllegalArgumentException e) {
            write401(response, "Session expired — please sign in again");
            return;
        }
        chain.doFilter(request, response);
    }

    private void write401(HttpServletResponse response, String msg) throws IOException {
        response.setStatus(401);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"" + msg.replace("\"", "\\\"") + "\"}");
    }
}
