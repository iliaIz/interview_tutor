package org.springframework.test.web.servlet.request;

public class MockMvcRequestBuilders {
    public static MockHttpServletRequestBuilder post(String urlTemplate, Object... uriVars) {
        return new MockHttpServletRequestBuilder("POST", urlTemplate, uriVars);
    }

    public static MockHttpServletRequestBuilder get(String urlTemplate, Object... uriVars) {
        return new MockHttpServletRequestBuilder("GET", urlTemplate, uriVars);
    }

    public static MockHttpServletRequestBuilder put(String urlTemplate, Object... uriVars) {
        return new MockHttpServletRequestBuilder("PUT", urlTemplate, uriVars);
    }

    public static MockHttpServletRequestBuilder delete(String urlTemplate, Object... uriVars) {
        return new MockHttpServletRequestBuilder("DELETE", urlTemplate, uriVars);
    }
}
