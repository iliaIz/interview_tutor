package org.springframework.test.web.servlet.result;

import org.springframework.test.web.servlet.ResultMatcher;
import java.util.Objects;

public class HeaderResultMatchers {
    public ResultMatcher string(String name, String expected) {
        return resp -> {
            String val = resp.getHeader(name);
            if (!Objects.equals(val, expected)) {
                throw new AssertionError("Expected header <" + name + "> to be <" + expected + "> but was <" + val + ">");
            }
        };
    }
}
