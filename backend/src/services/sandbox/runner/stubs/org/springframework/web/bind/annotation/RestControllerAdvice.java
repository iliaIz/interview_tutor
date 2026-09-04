package org.springframework.web.bind.annotation;

import java.lang.annotation.*;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RestControllerAdvice {
    String[] value() default {};
    String[] basePackages() default {};
}
