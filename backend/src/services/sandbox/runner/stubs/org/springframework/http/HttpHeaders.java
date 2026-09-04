package org.springframework.http;

import java.util.*;

public class HttpHeaders {
    private final Map<String, List<String>> headers = new LinkedHashMap<>();

    public void add(String headerName, String headerValue) {
        headers.computeIfAbsent(headerName, k -> new ArrayList<>()).add(headerValue);
    }

    public void set(String headerName, String headerValue) {
        headers.put(headerName, new ArrayList<>(List.of(headerValue)));
    }

    public String getFirst(String headerName) {
        List<String> list = headers.get(headerName);
        return list != null && !list.isEmpty() ? list.get(0) : null;
    }

    public Map<String, List<String>> getHeaders() {
        return headers;
    }
}
