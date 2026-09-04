package org.springframework.transaction.annotation;

import java.lang.annotation.*;

@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
public @interface Transactional {
    String value() default "";
    String transactionManager() default "";
    Propagation propagation() default Propagation.REQUIRED;
    String[] label() default {};
    boolean readOnly() default false;
    int timeout() default -1;
    String timeoutString() default "";
    Class<? extends Throwable>[] rollbackFor() default {};
    String[] rollbackForClassName() default {};
    Class<? extends Throwable>[] noRollbackFor() default {};
    String[] noRollbackForClassName() default {};
}
