package org.springframework.boot.test.json;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.util.HashMap;
import java.util.Map;

public class JacksonTester<T> {

    public static void initFields(Object testInstance, Object mapper) {
        if (testInstance == null) return;
        for (Field f : testInstance.getClass().getDeclaredFields()) {
            if (f.getType().equals(JacksonTester.class)) {
                f.setAccessible(true);
                try {
                    f.set(testInstance, new JacksonTester<>());
                } catch (Exception ignored) {}
            }
        }
    }

    public JsonContent<T> write(T value) throws IOException {
        Map<String, Object> map = new HashMap<>();
        StringBuilder json = new StringBuilder("{");

        if (value != null) {
            Class<?> clazz = value.getClass();
            if (clazz.isRecord()) {
                RecordComponent[] components = clazz.getRecordComponents();
                boolean first = true;
                for (RecordComponent rc : components) {
                    String name = rc.getName();
                    Method getter = rc.getAccessor();
                    getter.setAccessible(true);
                    Object fieldVal;
                    try {
                        fieldVal = getter.invoke(value);
                    } catch (Exception e) {
                        continue;
                    }

                    // Check for @JsonSerialize
                    JsonSerialize js = getter.getAnnotation(JsonSerialize.class);
                    if (js == null) {
                        try {
                            Field f = clazz.getDeclaredField(name);
                            js = f.getAnnotation(JsonSerialize.class);
                        } catch (Exception ignored) {}
                    }

                    String[] serializedHolder = new String[1];
                    if (js != null && js.using() != null && js.using() != JsonSerializer.None.class) {
                        try {
                            JsonSerializer serializer = js.using().getDeclaredConstructor().newInstance();
                            JsonGenerator gen = new JsonGenerator() {
                                public void writeString(String text) { serializedHolder[0] = text; }
                                public void writeNumber(double v) { serializedHolder[0] = String.valueOf(v); }
                                public void writeNumber(long v) { serializedHolder[0] = String.valueOf(v); }
                                public void writeNumber(int v) { serializedHolder[0] = String.valueOf(v); }
                                public void writeBoolean(boolean v) { serializedHolder[0] = String.valueOf(v); }
                                public void writeNull() { serializedHolder[0] = null; }
                            };
                            serializer.serialize(fieldVal, gen, null);
                        } catch (Exception e) {
                            if (e instanceof RuntimeException re) throw re;
                            throw new IOException(e);
                        }
                    } else {
                        serializedHolder[0] = fieldVal != null ? String.valueOf(fieldVal) : null;
                    }

                    if (serializedHolder[0] != null) {
                        map.put(name, serializedHolder[0]);
                        if (!first) json.append(",");
                        json.append("\"").append(name).append("\":\"").append(serializedHolder[0]).append("\"");
                        first = false;
                    }
                }
            }
        }
        json.append("}");
        return new JsonContent<>(json.toString(), map);
    }
}
