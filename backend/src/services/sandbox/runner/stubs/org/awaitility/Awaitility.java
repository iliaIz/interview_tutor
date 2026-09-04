package org.awaitility;

import org.awaitility.core.ConditionFactory;

public class Awaitility {
    public static ConditionFactory await() {
        return new ConditionFactory();
    }

    public static ConditionFactory await(String alias) {
        return new ConditionFactory(alias);
    }
}
