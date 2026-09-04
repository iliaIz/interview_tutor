package com.tngtech.archunit.core.importer;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ClassFileImporter {
    private static final Map<String, JavaClass> REGISTERED_CLASSES = new ConcurrentHashMap<>();

    public static void registerClass(Class<?> clazz, String sourceCode) {
        JavaClass jc = new JavaClass(clazz);
        jc.setSourceCode(sourceCode);
        REGISTERED_CLASSES.put(clazz.getName(), jc);
    }

    public static void clear() {
        REGISTERED_CLASSES.clear();
    }

    public JavaClasses importPackages(String... packages) {
        List<JavaClass> matched = new ArrayList<>();
        for (JavaClass jc : REGISTERED_CLASSES.values()) {
            for (String pkg : packages) {
                if (jc.getPackageName().startsWith(pkg)) {
                    matched.add(jc);
                    break;
                }
            }
        }
        return new JavaClasses(matched);
    }
}
