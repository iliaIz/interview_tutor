package com.tngtech.archunit.junit;

import java.lang.annotation.*;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface AnalyzeClasses {
    String[] packages() default {};
    Class<?>[] packagesOf() default {};
}
