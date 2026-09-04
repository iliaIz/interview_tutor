package jakarta.transaction;

import java.lang.annotation.*;

@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface Transactional {
    Class[] rollbackOn() default {};
    Class[] dontRollbackOn() default {};
}
