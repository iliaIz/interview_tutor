package com.fasterxml.jackson.databind;

import com.fasterxml.jackson.core.JsonGenerator;
import java.io.IOException;

public abstract class JsonSerializer<T> {
    public abstract void serialize(T value, JsonGenerator gen, SerializerProvider serializers) throws IOException;

    public static abstract class None extends JsonSerializer<Object> {}
}
