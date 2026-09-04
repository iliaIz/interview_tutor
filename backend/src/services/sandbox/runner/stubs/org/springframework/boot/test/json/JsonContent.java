package org.springframework.boot.test.json;

import org.assertj.core.api.Assertions;
import org.assertj.core.api.Assertions.StringAssert;
import java.util.Map;
import java.util.Objects;

public class JsonContent<T> {
    private final String json;
    private final Map<String, Object> values;

    public JsonContent(String json, Map<String, Object> values) {
        this.json = json;
        this.values = values;
    }

    public String getJson() {
        return json;
    }

    public StringAssert extractingJsonPathStringValue(String jsonPath) {
        String key = jsonPath.startsWith("$.") ? jsonPath.substring(2) : jsonPath;
        Object val = values.get(key);
        return Assertions.assertThat(val != null ? String.valueOf(val) : null);
    }

    public JsonContent<T> hasEmptyJsonPathValue(String jsonPath) {
        String key = jsonPath.startsWith("$.") ? jsonPath.substring(2) : jsonPath;
        Object val = values.get(key);
        if (val != null) {
            throw new AssertionError("Expected empty JSON path <" + jsonPath + "> but was: <" + val + ">");
        }
        return this;
    }
}
