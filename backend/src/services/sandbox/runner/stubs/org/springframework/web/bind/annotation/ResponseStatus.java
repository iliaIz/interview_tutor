package org.springframework.web.bind.annotation;

import org.springframework.http.HttpStatus;
import java.lang.annotation.*;

@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface ResponseStatus {
    HttpStatus value() default HttpStatus.INTERNAL_SERVER_ERROR;
    HttpStatus code() default HttpStatus.INTERNAL_SERVER_ERROR;
    String reason() default "";
}
