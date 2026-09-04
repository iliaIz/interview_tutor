package org.junit.jupiter.api;

import java.util.Collection;
import java.util.stream.Stream;

public class DynamicContainer extends DynamicNode {
    private final Iterable<? extends DynamicNode> children;

    private DynamicContainer(String displayName, Iterable<? extends DynamicNode> children) {
        super(displayName);
        this.children = children;
    }

    public static DynamicContainer dynamicContainer(String displayName, Iterable<? extends DynamicNode> dynamicNodes) {
        return new DynamicContainer(displayName, dynamicNodes);
    }

    public static DynamicContainer dynamicContainer(String displayName, Stream<? extends DynamicNode> dynamicNodes) {
        return new DynamicContainer(displayName, dynamicNodes.toList());
    }

    public Iterable<? extends DynamicNode> getChildren() {
        return children;
    }
}
