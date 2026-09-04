package org.springframework.test.web.servlet;

@FunctionalInterface
public interface ResultMatcher {
    void match(MockHttpServletResponse response) throws Exception;
}
