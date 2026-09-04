package org.springframework.test.context.bean.override.mockito;

import java.lang.annotation.*;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface MockitoBean {
    String[] name() default {};
}
