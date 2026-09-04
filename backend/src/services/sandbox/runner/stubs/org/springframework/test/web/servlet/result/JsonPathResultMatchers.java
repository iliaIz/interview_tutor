package org.springframework.test.web.servlet.result;

import org.springframework.test.web.servlet.ResultMatcher;
import java.util.Objects;
import java.util.regex.*;

public class JsonPathResultMatchers {
    private final String expression;

    public JsonPathResultMatchers(String expression) {
        this.expression = expression;
    }

    public ResultMatcher value(Object expected) {
        return resp -> {
            String val = extractJsonPath(resp.getContentAsString(), expression);
            if (!Objects.equals(val, String.valueOf(expected))) {
                throw new AssertionError("JSON path [" + expression + "] expected <" + expected + "> but was <" + val + "> in: " + resp.getContentAsString());
            }
        };
    }

    public ResultMatcher exists() {
        return resp -> {
            String val = extractJsonPath(resp.getContentAsString(), expression);
            if (val == null) {
                throw new AssertionError("JSON path [" + expression + "] does not exist in: " + resp.getContentAsString());
            }
        };
    }

    public ResultMatcher doesNotExist() {
        return resp -> {
            String val = extractJsonPath(resp.getContentAsString(), expression);
            if (val != null) {
                throw new AssertionError("JSON path [" + expression + "] was expected NOT to exist but was <" + val + ">");
            }
        };
    }

    private static String extractJsonPath(String json, String path) {
        if (json == null || json.isEmpty()) return null;
        // Simple extraction for $.key or $.nested.key
        String key = path.startsWith("$.") ? path.substring(2) : path;
        String[] parts = key.split("\\.");
        String searchIn = json;
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i];
            Pattern pattern = Pattern.compile("\"" + Pattern.quote(p) + "\"\\s*:\\s*(\"[^\"]*\"|\\d+|true|false|null|\\{[^}]*\\})");
            Matcher m = pattern.matcher(searchIn);
            if (!m.find()) return null;
            String raw = m.group(1).trim();
            if (i == parts.length - 1) {
                if (raw.startsWith("\"") && raw.endsWith("\"")) {
                    return raw.substring(1, raw.length() - 1);
                }
                return raw;
            } else {
                searchIn = raw;
            }
        }
        return null;
    }
}
