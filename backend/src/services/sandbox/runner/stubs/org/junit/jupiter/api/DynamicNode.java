package org.junit.jupiter.api;

public abstract class DynamicNode {
    private final String displayName;

    protected DynamicNode(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
