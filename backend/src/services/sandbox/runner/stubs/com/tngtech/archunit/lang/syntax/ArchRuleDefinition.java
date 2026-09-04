package com.tngtech.archunit.lang.syntax;

import com.tngtech.archunit.core.domain.*;
import com.tngtech.archunit.lang.*;
import java.lang.annotation.Annotation;
import java.util.*;
import java.util.function.Predicate;

public class ArchRuleDefinition {

    public static ClassesShouldConjunction noClasses() {
        return new ClassesShouldConjunction(false);
    }

    public static ClassesShouldConjunction classes() {
        return new ClassesShouldConjunction(true);
    }

    public static MethodsShouldConjunction methods() {
        return new MethodsShouldConjunction();
    }

    // --- Classes Conjunction ---
    public static class ClassesShouldConjunction implements ArchRule {
        private final boolean positive;
        private final List<Predicate<JavaClass>> filters = new ArrayList<>();
        private final List<Predicate<JavaClass>> violations = new ArrayList<>();
        private String becauseReason;
        private String description;

        public ClassesShouldConjunction(boolean positive) {
            this.positive = positive;
        }

        public ClassesShouldConjunction that() { return this; }
        public ClassesShouldConjunction should() { return this; }
        public ClassesShouldConjunction orShould() { return this; }

        public ClassesShouldConjunction resideInAPackage(String packageIdentifier) {
            String clean = packageIdentifier.replace("..", "").replace(".", "");
            filters.add(c -> c.getPackageName().contains(clean));
            return this;
        }

        public ClassesShouldConjunction areAnnotatedWith(Class<? extends Annotation> annotationType) {
            filters.add(c -> c.isAnnotatedWith(annotationType));
            return this;
        }

        public ClassesShouldConjunction dependOnClassesThat() {
            return this;
        }

        public ClassesShouldConjunction haveFullyQualifiedName(String name) {
            violations.add(c -> {
                for (String dep : c.getDirectDependencyNames()) {
                    if (dep.equals(name)) return true;
                }
                String src = c.getSourceCode();
                String simple = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1) : name;
                return src.contains("import " + name + ";") || src.contains("new " + simple + "(") || src.contains("new " + name + "(") || src.contains(name + " ");
            });
            return this;
        }

        public ClassesShouldConjunction callMethod(Class<?> target, String methodName, Class<?>... params) {
            violations.add(c -> {
                String pattern1 = target.getSimpleName() + "." + methodName;
                String pattern2 = target.getName() + "." + methodName;
                return c.getSourceCode().contains(pattern1) || c.getSourceCode().contains(pattern2);
            });
            return this;
        }

        public ClassesShouldConjunction callConstructor(Class<?> target, Class<?>... params) {
            violations.add(c -> {
                String pattern1 = "new " + target.getSimpleName() + "(";
                String pattern2 = "new " + target.getName() + "(";
                return c.getSourceCode().contains(pattern1) || c.getSourceCode().contains(pattern2);
            });
            return this;
        }

        public ClassesShouldConjunction should(ArchCondition<JavaClass> condition) {
            violations.add(c -> {
                ConditionEvents events = new ConditionEvents();
                condition.check(c, events);
                return events.containViolations();
            });
            return this;
        }

        public ClassesShouldConjunction because(String reason) {
            this.becauseReason = reason;
            return this;
        }

        public ClassesShouldConjunction as(String description) {
            this.description = description;
            return this;
        }

        @Override
        public void check(JavaClasses classes) {
            for (JavaClass jc : classes) {
                if (jc.getName().endsWith("Test") || jc.getName().endsWith("Tests") || jc.getName().contains("ArchTest")) {
                    continue;
                }
                boolean matchesFilter = true;
                for (Predicate<JavaClass> f : filters) {
                    if (!f.test(jc)) {
                        matchesFilter = false;
                        break;
                    }
                }
                if (!matchesFilter) continue;

                for (Predicate<JavaClass> v : violations) {
                    if (v.test(jc)) {
                        if (!positive) {
                            // noClasses violated!
                            throw new AssertionError("Architecture violation in <" + jc.getName() + ">: " + (becauseReason != null ? becauseReason : "Rule violated"));
                        }
                    } else if (positive) {
                        // classes().should() violated
                        throw new AssertionError("Architecture violation in <" + jc.getName() + ">: " + (becauseReason != null ? becauseReason : "Rule violated"));
                    }
                }
            }
        }
    }

    // --- Methods Conjunction ---
    public static class MethodsShouldConjunction implements ArchRule {
        private final List<Predicate<JavaMethod>> filters = new ArrayList<>();
        private final List<ArchCondition<JavaMethod>> conditions = new ArrayList<>();
        private boolean checkPublic = false;
        private String becauseReason;
        private String description;

        public MethodsShouldConjunction that() { return this; }
        public MethodsShouldConjunction should() { return this; }
        public MethodsShouldConjunction or() { return this; }

        public MethodsShouldConjunction areAnnotatedWith(Class<? extends Annotation> annotationType) {
            filters.add(m -> m.isAnnotatedWith(annotationType));
            return this;
        }

        public MethodsShouldConjunction bePublic() {
            this.checkPublic = true;
            return this;
        }

        public MethodsShouldConjunction should(ArchCondition<JavaMethod> condition) {
            this.conditions.add(condition);
            return this;
        }

        public MethodsShouldConjunction because(String reason) {
            this.becauseReason = reason;
            return this;
        }

        public MethodsShouldConjunction as(String description) {
            this.description = description;
            return this;
        }

        @Override
        public void check(JavaClasses classes) {
            for (JavaClass jc : classes) {
                for (JavaMethod jm : jc.getMethods()) {
                    boolean matchesFilter = false;
                    if (filters.isEmpty()) matchesFilter = true;
                    else {
                        for (Predicate<JavaMethod> f : filters) {
                            if (f.test(jm)) {
                                matchesFilter = true;
                                break;
                            }
                        }
                    }
                    if (!matchesFilter) continue;

                    if (checkPublic && !jm.getModifiers().contains(JavaModifier.PUBLIC)) {
                        throw new AssertionError("Method <" + jm.getFullName() + "> must be public: " + (becauseReason != null ? becauseReason : "Rule violated"));
                    }

                    for (ArchCondition<JavaMethod> cond : conditions) {
                        ConditionEvents events = new ConditionEvents();
                        cond.check(jm, events);
                        if (events.containViolations()) {
                            String msg = events.getViolations().get(0).getMessage();
                            throw new AssertionError("Method <" + jm.getFullName() + "> violated condition: " + msg);
                        }
                    }
                }
            }
        }
    }
}
