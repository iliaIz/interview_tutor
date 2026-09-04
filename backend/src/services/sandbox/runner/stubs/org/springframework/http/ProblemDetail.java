package org.springframework.http;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

public class ProblemDetail {
    private URI type = URI.create("about:blank");
    private String title;
    private int status;
    private String detail;
    private URI instance;
    private final Map<String, Object> properties = new HashMap<>();

    public ProblemDetail() {}

    public static ProblemDetail forStatus(int status) {
        ProblemDetail pd = new ProblemDetail();
        pd.setStatus(status);
        return pd;
    }

    public static ProblemDetail forStatus(HttpStatus status) {
        return forStatus(status.value());
    }

    public static ProblemDetail forStatusAndDetail(HttpStatus status, String detail) {
        ProblemDetail pd = forStatus(status);
        pd.setDetail(detail);
        return pd;
    }

    public URI getType() { return type; }
    public void setType(URI type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public URI getInstance() { return instance; }
    public void setInstance(URI instance) { this.instance = instance; }

    public void setProperty(String name, Object value) {
        properties.put(name, value);
    }

    public Map<String, Object> getProperties() {
        return properties;
    }
}
