package org.assertj.core.data;

public class Offset<T extends Number> {
    private final T value;

    public Offset(T value) {
        this.value = value;
    }

    public static <T extends Number> Offset<T> offset(T value) {
        return new Offset<>(value);
    }

    public T getValue() {
        return value;
    }
}
