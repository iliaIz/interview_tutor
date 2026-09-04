package com.tngtech.archunit.lang;

public abstract class ArchCondition<T> {
    private final String description;

    public ArchCondition(String description) {
        this.description = description;
    }

    public abstract void check(T item, ConditionEvents events);

    public String getDescription() {
        return description;
    }
}
