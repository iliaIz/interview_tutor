package org.springframework.test.web.servlet;

import org.springframework.http.MediaType;
import java.util.HashMap;
import java.util.Map;

public class MockHttpServletResponse {
    private int status = 200;
    private final Map<String, String> headers = new HashMap<>();
    private String contentAsString = "";
    private MediaType contentType = MediaType.APPLICATION_JSON;

    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }
    public String getHeader(String name) { return headers.get(name); }
    public void setHeader(String name, String value) { headers.put(name, value); }
    public String getContentAsString() { return contentAsString; }
    public void setContentAsString(String content) { this.contentAsString = content; }
    public MediaType getContentType() { return contentType; }
    public void setContentType(MediaType contentType) { this.contentType = contentType; }
}
