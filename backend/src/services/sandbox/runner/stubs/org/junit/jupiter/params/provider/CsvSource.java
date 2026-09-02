package org.junit.jupiter.params.provider;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface CsvSource {
    String[] value() default {};
    String[] textBlock() default {};
    char delimiter() default ',';
    String delimiterString() default "";
    String emptyValue() default "";
    String nullValues() default "";
}
