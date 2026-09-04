package com.tngtech.archunit.core.domain;

import java.lang.annotation.Annotation;
import java.lang.reflect.*;
import java.util.*;

public class JavaClass {
    private final Class<?> clazz;
    private final Set<JavaMethod> methods = new HashSet<>();
    private final Set<String> directDependencies = new HashSet<>();
    private String sourceCode = "";

    public JavaClass(Class<?> clazz) {
        this.clazz = clazz;
        for (Method m : clazz.getDeclaredMethods()) {
            methods.add(new JavaMethod(m, this));
        }
        extractDependencies();
    }

    public void setSourceCode(String sourceCode) {
        this.sourceCode = sourceCode != null ? sourceCode : "";
    }

    public String getSourceCode() {
        return sourceCode;
    }

    private void extractDependencies() {
        // Field types
        for (Field f : clazz.getDeclaredFields()) {
            directDependencies.add(f.getType().getName());
        }
        // Method returns and parameters
        for (Method m : clazz.getDeclaredMethods()) {
            directDependencies.add(m.getReturnType().getName());
            for (Class<?> p : m.getParameterTypes()) {
                directDependencies.add(p.getName());
            }
        }
        // Superclass and interfaces
        if (clazz.getSuperclass() != null && clazz.getSuperclass() != Object.class) {
            directDependencies.add(clazz.getSuperclass().getName());
        }
        for (Class<?> iface : clazz.getInterfaces()) {
            directDependencies.add(iface.getName());
        }
    }

    public String getName() {
        return clazz.getName();
    }

    public String getSimpleName() {
        return clazz.getSimpleName();
    }

    public String getPackageName() {
        Package pkg = clazz.getPackage();
        return pkg != null ? pkg.getName() : "";
    }

    public Set<JavaMethod> getMethods() {
        return Collections.unmodifiableSet(methods);
    }

    public boolean isAnnotatedWith(Class<? extends Annotation> annotationType) {
        return clazz.isAnnotationPresent(annotationType);
    }

    public <A extends Annotation> Optional<A> tryGetAnnotationOfType(Class<A> annotationType) {
        return Optional.ofNullable(clazz.getAnnotation(annotationType));
    }

    public Set<String> getDirectDependencyNames() {
        return directDependencies;
    }

    public Class<?> getReflectedClass() {
        return clazz;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof JavaClass other)) return false;
        return Objects.equals(clazz.getName(), other.clazz.getName());
    }

    @Override
    public int hashCode() {
        return clazz.getName().hashCode();
    }

    @Override
    public String toString() {
        return "JavaClass<" + clazz.getName() + ">";
    }
}
