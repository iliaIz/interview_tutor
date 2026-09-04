package com.tngtech.archunit.library.dependencies;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.lang.ArchRule;
import java.util.*;
import java.util.regex.*;

public class SlicesRuleDefinition {

    public static SliceRuleBuilder slices() {
        return new SliceRuleBuilder();
    }

    public static class SliceRuleBuilder {
        private String pattern;

        public SliceRuleBuilder matching(String pattern) {
            this.pattern = pattern;
            return this;
        }

        public SlicesRule should() {
            return new SlicesRule(pattern);
        }
    }

    public static class SlicesRule implements ArchRule {
        private final String pattern;
        private boolean checkFreeOfCycles = false;
        private String becauseReason;
        private String description;

        public SlicesRule(String pattern) {
            this.pattern = pattern;
        }

        public SlicesRule beFreeOfCycles() {
            this.checkFreeOfCycles = true;
            return this;
        }

        public SlicesRule because(String reason) {
            this.becauseReason = reason;
            return this;
        }

        public SlicesRule as(String description) {
            this.description = description;
            return this;
        }

        @Override
        public void check(JavaClasses classes) {
            if (!checkFreeOfCycles) return;

            // Map slice name -> set of slices it depends on
            Map<String, Set<String>> sliceDeps = new HashMap<>();

            for (JavaClass jc : classes) {
                String pkg = jc.getPackageName();
                String currentSlice = extractSlice(pkg);
                if (currentSlice == null) continue;

                Set<String> deps = sliceDeps.computeIfAbsent(currentSlice, k -> new HashSet<>());
                for (String depClass : jc.getDirectDependencyNames()) {
                    String depSlice = extractSlice(depClass);
                    if (depSlice != null && !depSlice.equals(currentSlice)) {
                        deps.add(depSlice);
                    }
                }
            }

            // Check for 2-node cycles: A -> B and B -> A
            for (Map.Entry<String, Set<String>> entry : sliceDeps.entrySet()) {
                String sliceA = entry.getKey();
                for (String sliceB : entry.getValue()) {
                    Set<String> depsB = sliceDeps.get(sliceB);
                    if (depsB != null && depsB.contains(sliceA)) {
                        throw new AssertionError("Circular dependency detected between slices <" + sliceA + "> and <" + sliceB + ">: " + (becauseReason != null ? becauseReason : "Cycles forbidden"));
                    }
                }
            }
        }

        private String extractSlice(String packageName) {
            if (packageName == null) return null;
            if (packageName.contains("com.enterprise.order.")) {
                String sub = packageName.substring(packageName.indexOf("com.enterprise.order.") + "com.enterprise.order.".length());
                int dot = sub.indexOf('.');
                return dot != -1 ? sub.substring(0, dot) : sub;
            }
            return null;
        }
    }
}
