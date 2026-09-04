package org.springframework.test.web.servlet.request;

import org.springframework.http.MediaType;

public class MockHttpServletRequestBuilder {
    private final String method;
    private final String urlTemplate;
    private final Object[] uriVars;
    private MediaType contentType = MediaType.APPLICATION_JSON;
    private MediaType accept = MediaType.APPLICATION_JSON;
    private String content = "";

    public MockHttpServletRequestBuilder(String method, String urlTemplate, Object... uriVars) {
        this.method = method;
        this.urlTemplate = urlTemplate;
        this.uriVars = uriVars;
    }

    public MockHttpServletRequestBuilder contentType(MediaType mediaType) {
        this.contentType = mediaType;
        return this;
    }

    public MockHttpServletRequestBuilder accept(MediaType mediaType) {
        this.accept = mediaType;
        return this;
    }

    public MockHttpServletRequestBuilder content(String content) {
        this.content = content;
        return this;
    }

    public String getMethod() { return method; }
    public String getUrlTemplate() { return urlTemplate; }
    public Object[] getUriVars() { return uriVars; }
    public MediaType getContentType() { return contentType; }
    public MediaType getAccept() { return accept; }
    public String getContent() { return content; }
}
