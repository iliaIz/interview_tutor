package org.slf4j;

public interface Logger {
    void info(String format, Object... arguments);
    void warn(String format, Object... arguments);
    void error(String format, Object... arguments);
    void debug(String format, Object... arguments);
    void trace(String format, Object... arguments);
    boolean isInfoEnabled();
    boolean isWarnEnabled();
    boolean isErrorEnabled();
    boolean isDebugEnabled();
    boolean isTraceEnabled();
}
