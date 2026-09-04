package org.springframework.boot.test.autoconfigure.web.servlet;

import java.lang.annotation.*;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
public @interface WebMvcTest {
    Class<?>[] value() default {};
    Class<?>[] controllers() default {};
}
