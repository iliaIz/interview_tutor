package com.tngtech.archunit.lang;

import com.tngtech.archunit.core.domain.JavaClasses;

public interface ArchRule {
    void check(JavaClasses classes);
    ArchRule because(String reason);
    ArchRule as(String description);
}
