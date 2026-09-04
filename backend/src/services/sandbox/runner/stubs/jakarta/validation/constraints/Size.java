package jakarta.validation.constraints;

import java.lang.annotation.*;

@Target({ElementType.METHOD, ElementType.FIELD, ElementType.ANNOTATION_TYPE, ElementType.CONSTRUCTOR, ElementType.PARAMETER, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Size {
    String message() default "{jakarta.validation.constraints.Size.message}";
    Class<?>[] groups() default {};
    int min() default 0;
    int max() default Integer.MAX_VALUE;
}
