package org.springframework.http;

public class MediaType {
    public static final String APPLICATION_JSON_VALUE = "application/json";
    public static final MediaType APPLICATION_JSON = new MediaType("application", "json");
    public static final String APPLICATION_PROBLEM_JSON_VALUE = "application/problem+json";
    public static final MediaType APPLICATION_PROBLEM_JSON = new MediaType("application", "problem+json");

    private final String type;
    private final String subtype;

    public MediaType(String type, String subtype) {
        this.type = type;
        this.subtype = subtype;
    }

    @Override
    public String toString() {
        return type + "/" + subtype;
    }
}
