package org.slf4j;

public class LoggerFactory {
    private static final Logger NO_OP = new Logger() {
        public void info(String f, Object... a) {}
        public void warn(String f, Object... a) {}
        public void error(String f, Object... a) {}
        public void debug(String f, Object... a) {}
        public void trace(String f, Object... a) {}
        public boolean isInfoEnabled() { return false; }
        public boolean isWarnEnabled() { return false; }
        public boolean isErrorEnabled() { return false; }
        public boolean isDebugEnabled() { return false; }
        public boolean isTraceEnabled() { return false; }
    };

    public static Logger getLogger(Class<?> clazz) {
        return NO_OP;
    }

    public static Logger getLogger(String name) {
        return NO_OP;
    }
}
