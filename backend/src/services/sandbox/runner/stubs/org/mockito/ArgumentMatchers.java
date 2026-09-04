package org.mockito;

public class ArgumentMatchers {
    public static <T> T any() {
        Mockito.registerMatcher(new AnyMatcher(Object.class));
        return null;
    }

    public static <T> T any(Class<T> type) {
        Mockito.registerMatcher(new AnyMatcher(type));
        return null;
    }

    public static String anyString() {
        Mockito.registerMatcher(new AnyMatcher(String.class));
        return "";
    }

    public static int anyInt() {
        Mockito.registerMatcher(new AnyMatcher(Integer.class));
        return 0;
    }

    public static long anyLong() {
        Mockito.registerMatcher(new AnyMatcher(Long.class));
        return 0L;
    }

    public static boolean anyBoolean() {
        Mockito.registerMatcher(new AnyMatcher(Boolean.class));
        return false;
    }

    public static <T> T eq(T value) {
        Mockito.registerMatcher(new EqMatcher(value));
        return value;
    }

    public static <T> T isNull() {
        Mockito.registerMatcher(new NullMatcher());
        return null;
    }

    public static <T> T isNotNull() {
        Mockito.registerMatcher(new NotNullMatcher());
        return null;
    }

    public interface Matcher {
        boolean matches(Object actual);
    }

    public static class AnyMatcher implements Matcher {
        private final Class<?> type;
        public AnyMatcher(Class<?> type) { this.type = type; }
        public boolean matches(Object actual) {
            if (actual == null) return true;
            return type.isInstance(actual);
        }
    }

    public static class EqMatcher implements Matcher {
        private final Object expected;
        public EqMatcher(Object expected) { this.expected = expected; }
        public boolean matches(Object actual) {
            return java.util.Objects.equals(expected, actual);
        }
    }

    public static class NullMatcher implements Matcher {
        public boolean matches(Object actual) { return actual == null; }
    }

    public static class NotNullMatcher implements Matcher {
        public boolean matches(Object actual) { return actual != null; }
    }
}
