package com.tngtech.archunit.core.domain;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.*;

public class JavaMethod {
    private final Method method;
    private final JavaClass owner;

    public JavaMethod(Method method, JavaClass owner) {
        this.method = method;
        this.owner = owner;
    }

    public String getName() {
        return method.getName();
    }

    public String getFullName() {
        return owner.getName() + "." + method.getName() + "()";
    }

    public JavaClass getOwner() {
        return owner;
    }

    public Set<JavaModifier> getModifiers() {
        Set<JavaModifier> mods = new HashSet<>();
        int m = method.getModifiers();
        if (Modifier.isPublic(m)) mods.add(JavaModifier.PUBLIC);
        if (Modifier.isProtected(m)) mods.add(JavaModifier.PROTECTED);
        if (Modifier.isPrivate(m)) mods.add(JavaModifier.PRIVATE);
        if (Modifier.isStatic(m)) mods.add(JavaModifier.STATIC);
        if (Modifier.isFinal(m)) mods.add(JavaModifier.FINAL);
        return mods;
    }

    public boolean isAnnotatedWith(Class<? extends Annotation> annotationType) {
        return method.isAnnotationPresent(annotationType);
    }

    public <A extends Annotation> Optional<A> tryGetAnnotationOfType(Class<A> annotationType) {
        return Optional.ofNullable(method.getAnnotation(annotationType));
    }

    public Method getReflectedMethod() {
        return method;
    }
}
