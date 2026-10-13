package dev.training.web;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApiException(ApiException exception) {
        List<ApiError.Detail> details = exception.field() == null
                ? List.of()
                : List.of(new ApiError.Detail(exception.field(), exception.code()));
        return ResponseEntity.status(exception.status()).body(new ApiError(
                exception.code(), exception.getMessage(), details, RequestIdFilter.current()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleConflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "CONFLICT", "関連データが存在するため処理できません。", List.of(), RequestIdFilter.current()));
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class
    })
    ResponseEntity<ApiError> handleMalformedRequest() {
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR", "入力内容を確認してください。", List.of(), RequestIdFilter.current()));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> handleMissingRoute() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(
                "NOT_FOUND", "対象のAPIが見つかりません。", List.of(), RequestIdFilter.current()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpectedException(Exception exception) {
        log.error("Unhandled exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError(
                "INTERNAL_ERROR", "サーバーでエラーが発生しました。", List.of(), RequestIdFilter.current()));
    }
}