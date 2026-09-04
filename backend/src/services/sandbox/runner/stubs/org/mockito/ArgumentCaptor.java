package org.mockito;

import java.util.ArrayList;
import java.util.List;

public class ArgumentCaptor<T> {
    private final Class<? extends T> clazz;
    private final List<T> values = new ArrayList<>();

    private ArgumentCaptor(Class<? extends T> clazz) {
        this.clazz = clazz;
    }

    public static <U, S extends U> ArgumentCaptor<U> forClass(Class<S> clazz) {
        return new ArgumentCaptor<>(clazz);
    }

    public T capture() {
        Mockito.registerCaptor(this);
        return null;
    }

    public T getValue() {
        if (values.isEmpty()) {
            throw new IllegalStateException("No argument value has been captured yet");
        }
        return values.get(values.size() - 1);
    }

    public List<T> getAllValues() {
        return new ArrayList<>(values);
    }

    @SuppressWarnings("unchecked")
    public void captureFrom(Object value) {
        values.add((T) value);
    }
}
