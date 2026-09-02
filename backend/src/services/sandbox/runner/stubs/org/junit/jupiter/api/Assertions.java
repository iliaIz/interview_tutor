package org.junit.jupiter.api;

import org.junit.jupiter.api.function.Executable;
import java.util.Objects;

public class Assertions {

    public static void assertEquals(Object expected, Object actual) {
        assertEquals(expected, actual, null);
    }

    public static void assertEquals(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            String prefix = (message != null && !message.isEmpty()) ? message + " ==> " : "";
            throw new AssertionError(prefix + "expected: <" + expected + "> but was: <" + actual + ">");
        }
    }

    public static void assertEquals(long expected, long actual) {
        assertEquals(Long.valueOf(expected), Long.valueOf(actual), null);
    }

    public static void assertEquals(long expected, long actual, String message) {
        assertEquals(Long.valueOf(expected), Long.valueOf(actual), message);
    }

    public static void assertEquals(double expected, double actual) {
        assertEquals(Double.valueOf(expected), Double.valueOf(actual), null);
    }

    public static void assertEquals(double expected, double actual, double delta) {
        if (Math.abs(expected - actual) > delta) {
            throw new AssertionError("expected: <" + expected + "> but was: <" + actual + "> within delta " + delta);
        }
    }

    public static void assertTrue(boolean condition) {
        assertTrue(condition, null);
    }

    public static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message != null ? message : "expected: <true> but was: <false>");
        }
    }

    public static void assertFalse(boolean condition) {
        assertFalse(condition, null);
    }

    public static void assertFalse(boolean condition, String message) {
        if (condition) {
            throw new AssertionError(message != null ? message : "expected: <false> but was: <true>");
        }
    }

    public static void assertNotNull(Object actual) {
        assertNotNull(actual, null);
    }

    public static void assertNotNull(Object actual, String message) {
        if (actual == null) {
            throw new AssertionError(message != null ? message : "expected: not <null>");
        }
    }

    public static void assertNull(Object actual) {
        assertNull(actual, null);
    }

    public static void assertNull(Object actual, String message) {
        if (actual != null) {
            throw new AssertionError(message != null ? message : "expected: <null> but was: <" + actual + ">");
        }
    }

    public static <T extends Throwable> T assertThrows(Class<T> expectedType, Executable executable) {
        return assertThrows(expectedType, executable, null);
    }

    @SuppressWarnings("unchecked")
    public static <T extends Throwable> T assertThrows(Class<T> expectedType, Executable executable, String message) {
        try {
            executable.execute();
        } catch (Throwable actualException) {
            if (expectedType.isInstance(actualException)) {
                return (T) actualException;
            } else {
                throw new AssertionError((message != null ? message + " ==> " : "") +
                    "Unexpected exception type thrown ==> expected: <" + expectedType.getName() +
                    "> but was: <" + actualException.getClass().getName() + ">", actualException);
            }
        }
        throw new AssertionError((message != null ? message + " ==> " : "") +
            "Expected " + expectedType.getName() + " to be thrown, but nothing was thrown.");
    }

    public static void assertSame(Object expected, Object actual) {
        assertSame(expected, actual, null);
    }

    public static void assertSame(Object expected, Object actual, String message) {
        if (expected != actual) {
            String prefix = (message != null && !message.isEmpty()) ? message + " ==> " : "";
            throw new AssertionError(prefix + "expected: same <" + expected + "> was not: <" + actual + ">");
        }
    }

    public static void assertNotSame(Object unexpected, Object actual) {
        assertNotSame(unexpected, actual, null);
    }

    public static void assertNotSame(Object unexpected, Object actual, String message) {
        if (unexpected == actual) {
            String prefix = (message != null && !message.isEmpty()) ? message + " ==> " : "";
            throw new AssertionError(prefix + "expected not same: <" + actual + ">");
        }
    }

    public static void assertAll(Executable... executables) {
        assertAll(null, executables);
    }

    public static void assertAll(String heading, Executable... executables) {
        java.util.List<Throwable> failures = new java.util.ArrayList<>();
        for (Executable executable : executables) {
            try {
                executable.execute();
            } catch (Throwable t) {
                failures.add(t);
            }
        }
        if (!failures.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            if (heading != null && !heading.isEmpty()) {
                sb.append(heading).append(" (").append(failures.size()).append(" failures):\n");
            } else {
                sb.append("Multiple Failures (").append(failures.size()).append(" failures):\n");
            }
            for (Throwable f : failures) {
                sb.append("\t").append(f.getMessage()).append("\n");
            }
            throw new AssertionError(sb.toString(), failures.get(0));
        }
    }

    public static void fail(String message) {
        throw new AssertionError(message != null ? message : "Test failed");
    }
}
