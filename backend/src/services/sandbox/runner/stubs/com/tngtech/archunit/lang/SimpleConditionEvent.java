package com.tngtech.archunit.lang;

public class SimpleConditionEvent {
    private final Object correspondingObject;
    private final String message;
    private final boolean violated;

    public SimpleConditionEvent(Object correspondingObject, String message, boolean violated) {
        this.correspondingObject = correspondingObject;
        this.message = message;
        this.violated = violated;
    }

    public static SimpleConditionEvent violated(Object correspondingObject, String message) {
        return new SimpleConditionEvent(correspondingObject, message, true);
    }

    public static SimpleConditionEvent satisfied(Object correspondingObject, String message) {
        return new SimpleConditionEvent(correspondingObject, message, false);
    }

    public String getMessage() { return message; }
    public boolean isViolated() { return violated; }
}
