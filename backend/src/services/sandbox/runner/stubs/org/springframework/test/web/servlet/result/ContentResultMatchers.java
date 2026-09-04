package org.springframework.test.web.servlet.result;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultMatcher;
import java.util.Objects;

public class ContentResultMatchers {
    public ResultMatcher contentType(MediaType expected) {
        return resp -> {
            if (resp.getContentType() == null || !Objects.equals(resp.getContentType().toString(), expected.toString())) {
                throw new AssertionError("Expected Content-Type <" + expected + "> but was <" + resp.getContentType() + ">");
            }
        };
    }

    public ResultMatcher string(String expected) {
        return resp -> {
            if (!Objects.equals(resp.getContentAsString(), expected)) {
                throw new AssertionError("Expected content <" + expected + "> but was <" + resp.getContentAsString() + ">");
            }
        };
    }
}
