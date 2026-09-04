package org.springframework.web.bind.annotation;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface GetMapping {
    String[] value() default {};
    String[] path() default {};
    String[] consumes() default {};
    String[] produces() default {};
}
