package dev.training.web;

import java.util.List;

public record ApiError(String code, String message, List<Detail> details, String requestId) {
    public record Detail(String field, String reason) {
    }
}