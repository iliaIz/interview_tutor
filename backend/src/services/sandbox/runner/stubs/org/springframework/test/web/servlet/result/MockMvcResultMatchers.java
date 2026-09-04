package org.springframework.test.web.servlet.result;

public class MockMvcResultMatchers {
    public static StatusResultMatchers status() {
        return new StatusResultMatchers();
    }

    public static HeaderResultMatchers header() {
        return new HeaderResultMatchers();
    }

    public static ContentResultMatchers content() {
        return new ContentResultMatchers();
    }

    public static JsonPathResultMatchers jsonPath(String expression, Object... args) {
        return new JsonPathResultMatchers(expression);
    }
}
