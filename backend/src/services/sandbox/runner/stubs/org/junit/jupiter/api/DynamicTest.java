package org.junit.jupiter.api;

import org.junit.jupiter.api.function.Executable;

public class DynamicTest extends DynamicNode {
    private final Executable executable;

    private DynamicTest(String displayName, Executable executable) {
        super(displayName);
        this.executable = executable;
    }

    public static DynamicTest dynamicTest(String displayName, Executable executable) {
        return new DynamicTest(displayName, executable);
    }

    public Executable getExecutable() {
        return executable;
    }
}
