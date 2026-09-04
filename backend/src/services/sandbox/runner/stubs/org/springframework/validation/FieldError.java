package org.springframework.validation;

public class FieldError {
    private final String objectName;
    private final String field;
    private final String defaultMessage;

    public FieldError(String objectName, String field, String defaultMessage) {
        this.objectName = objectName;
        this.field = field;
        this.defaultMessage = defaultMessage;
    }

    public String getObjectName() { return objectName; }
    public String getField() { return field; }
    public String getDefaultMessage() { return defaultMessage; }
}
