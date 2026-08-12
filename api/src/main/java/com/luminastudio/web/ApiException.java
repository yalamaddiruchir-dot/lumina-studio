package com.luminastudio.web;

import org.springframework.http.HttpStatus;

/** Thrown by controllers/filters → mapped to {"error": msg} with the given status. */
public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() { return status; }

    public HttpStatus httpStatus() { return HttpStatus.resolve(status); }
}
