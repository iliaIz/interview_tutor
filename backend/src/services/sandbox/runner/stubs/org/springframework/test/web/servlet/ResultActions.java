package org.springframework.test.web.servlet;

public interface ResultActions {
    ResultActions andExpect(ResultMatcher matcher) throws Exception;
    MockHttpServletResponse getResponse();
}
