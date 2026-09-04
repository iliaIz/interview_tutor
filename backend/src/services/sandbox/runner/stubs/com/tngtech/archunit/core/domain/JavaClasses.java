package com.tngtech.archunit.core.domain;

import java.util.*;

public class JavaClasses implements Iterable<JavaClass> {
    private final Map<String, JavaClass> classMap = new HashMap<>();

    public JavaClasses(Collection<JavaClass> classes) {
        for (JavaClass c : classes) {
            classMap.put(c.getName(), c);
        }
    }

    public JavaClass get(Class<?> clazz) {
        return classMap.get(clazz.getName());
    }

    public JavaClass get(String className) {
        return classMap.get(className);
    }

    public Collection<JavaClass> asCollection() {
        return Collections.unmodifiableCollection(classMap.values());
    }

    @Override
    public Iterator<JavaClass> iterator() {
        return classMap.values().iterator();
    }

    public int size() {
        return classMap.size();
    }
}
