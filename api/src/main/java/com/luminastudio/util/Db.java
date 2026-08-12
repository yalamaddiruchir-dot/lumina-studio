package com.luminastudio.util;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;

/** Small JDBC helpers shared across controllers. */
public final class Db {

    private Db() {}

    /** Inserts and returns the generated auto-increment key. */
    public static int insert(NamedParameterJdbcTemplate jdbc, String sql, MapSqlParameterSource params) {
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(sql, params, kh);
        Number key = kh.getKey();
        return key == null ? -1 : key.intValue();
    }

    public static String str(Object o) { return o == null ? "" : String.valueOf(o); }
    public static String nz(Object o) { return o == null ? null : String.valueOf(o); }
    public static int num(Object o, int fallback) {
        if (o == null) return fallback;
        try { return (int) Math.round(Double.parseDouble(String.valueOf(o))); } catch (Exception e) { return fallback; }
    }
    public static double dbl(Object o, double fallback) {
        if (o == null) return fallback;
        try { return Double.parseDouble(String.valueOf(o)); } catch (Exception e) { return fallback; }
    }
}
