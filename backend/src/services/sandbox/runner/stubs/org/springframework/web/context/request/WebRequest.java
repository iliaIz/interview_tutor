package org.springframework.web.context.request;

public interface WebRequest {
    String getHeader(String headerName);
    String getParameter(String paramName);
}
