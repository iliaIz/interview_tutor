package org.springframework.http;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

public class ResponseEntity<T> {
    private final T body;
    private final HttpStatus status;
    private final Map<String, String> headers = new HashMap<>();

    public ResponseEntity(T body, HttpStatus status) {
        this.body = body;
        this.status = status;
    }

    public T getBody() { return body; }
    public HttpStatus getStatusCode() { return status; }
    public int getStatusCodeValue() { return status.value(); }
    public Map<String, String> getHeaders() { return headers; }

    public static <T> ResponseEntity<T> ok(T body) {
        return new ResponseEntity<>(body, HttpStatus.OK);
    }

    public static BodyBuilder status(HttpStatus status) {
        return new DefaultBodyBuilder(status);
    }

    public static BodyBuilder status(HttpStatusCode status) {
        if (status instanceof HttpStatus hs) return new DefaultBodyBuilder(hs);
        return status(status != null ? status.value() : 200);
    }

    public static BodyBuilder status(int status) {
        for (HttpStatus s : HttpStatus.values()) {
            if (s.value() == status) return status(s);
        }
        return new DefaultBodyBuilder(HttpStatus.OK);
    }

    public static BodyBuilder created(URI location) {
        return status(HttpStatus.CREATED).header("Location", location.toString());
    }

    public interface BodyBuilder {
        BodyBuilder header(String name, String... values);
        BodyBuilder headers(HttpHeaders headers);
        BodyBuilder contentType(MediaType contentType);
        <T> ResponseEntity<T> body(T body);
        <T> ResponseEntity<T> build();
    }

    private static class DefaultBodyBuilder implements BodyBuilder {
        private final HttpStatus status;
        private final Map<String, String> headers = new HashMap<>();

        DefaultBodyBuilder(HttpStatus status) {
            this.status = status;
        }

        public BodyBuilder header(String name, String... values) {
            if (values.length > 0) headers.put(name, values[0]);
            return this;
        }

        public BodyBuilder headers(HttpHeaders httpHeaders) {
            if (httpHeaders != null) {
                for (Map.Entry<String, java.util.List<String>> e : httpHeaders.getHeaders().entrySet()) {
                    if (!e.getValue().isEmpty()) {
                        headers.put(e.getKey(), e.getValue().get(0));
                    }
                }
            }
            return this;
        }

        public BodyBuilder contentType(MediaType contentType) {
            headers.put("Content-Type", contentType.toString());
            return this;
        }

        public <T> ResponseEntity<T> body(T body) {
            ResponseEntity<T> entity = new ResponseEntity<>(body, status);
            entity.headers.putAll(headers);
            return entity;
        }

        public <T> ResponseEntity<T> build() {
            return body(null);
        }
    }
}
