package com.tngtech.archunit.lang;

import java.util.ArrayList;
import java.util.List;

public class ConditionEvents {
    private final List<SimpleConditionEvent> events = new ArrayList<>();

    public void add(SimpleConditionEvent event) {
        events.add(event);
    }

    public boolean containViolations() {
        for (SimpleConditionEvent e : events) {
            if (e.isViolated()) return true;
        }
        return false;
    }

    public List<SimpleConditionEvent> getViolations() {
        List<SimpleConditionEvent> list = new ArrayList<>();
        for (SimpleConditionEvent e : events) {
            if (e.isViolated()) list.add(e);
        }
        return list;
    }
}
