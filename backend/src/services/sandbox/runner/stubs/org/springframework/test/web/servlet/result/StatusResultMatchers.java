package org.springframework.test.web.servlet.result;

import org.springframework.test.web.servlet.ResultMatcher;

public class StatusResultMatchers {
    public ResultMatcher isOk() { return resp -> matchStatus(resp, 200); }
    public ResultMatcher isCreated() { return resp -> matchStatus(resp, 201); }
    public ResultMatcher isBadRequest() { return resp -> matchStatus(resp, 400); }
    public ResultMatcher isNotFound() { return resp -> matchStatus(resp, 404); }
    public ResultMatcher isConflict() { return resp -> matchStatus(resp, 409); }
    public ResultMatcher is(int expected) { return resp -> matchStatus(resp, expected); }

    private void matchStatus(org.springframework.test.web.servlet.MockHttpServletResponse resp, int expected) {
        if (resp.getStatus() != expected) {
            throw new AssertionError("Expected HTTP status " + expected + " but was " + resp.getStatus() + ": " + resp.getContentAsString());
        }
    }
}
