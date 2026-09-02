package org.assertj.core.api;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Objects;

public class Assertions {
    public static <T> ObjectAssert<T> assertThat(T actual) {
        return new ObjectAssert<>(actual);
    }

    public static BigDecimalAssert assertThat(BigDecimal actual) {
        return new BigDecimalAssert(actual);
    }

    public static BooleanAssert assertThat(Boolean actual) {
        return new BooleanAssert(actual);
    }

    public static StringAssert assertThat(String actual) {
        return new StringAssert(actual);
    }

    public static <E> CollectionAssert<E> assertThat(Collection<E> actual) {
        return new CollectionAssert<>(actual);
    }

    public static class ObjectAssert<T> {
        protected final T actual;
        protected String description;

        public ObjectAssert(T actual) {
            this.actual = actual;
        }

        public ObjectAssert<T> as(String description, Object... args) {
            this.description = String.format(description, args);
            return this;
        }

        public ObjectAssert<T> isEqualTo(Object expected) {
            if (!Objects.equals(actual, expected)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected: <" + expected + "> but was: <" + actual + ">");
            }
            return this;
        }

        public ObjectAssert<T> isNotEqualTo(Object other) {
            if (Objects.equals(actual, other)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected not equal to: <" + other + ">");
            }
            return this;
        }

        public ObjectAssert<T> isNotNull() {
            if (actual == null) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected not null");
            }
            return this;
        }

        public ObjectAssert<T> isNull() {
            if (actual != null) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected null, but was: <" + actual + ">");
            }
            return this;
        }
    }

    public static class BigDecimalAssert extends ObjectAssert<BigDecimal> {
        public BigDecimalAssert(BigDecimal actual) {
            super(actual);
        }

        public BigDecimalAssert isEqualByComparingTo(BigDecimal expected) {
            isNotNull();
            if (expected == null || actual.compareTo(expected) != 0) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected equal by comparing to: <" + expected + "> but was: <" + actual + ">");
            }
            return this;
        }

        public BigDecimalAssert isEqualByComparingTo(String expected) {
            return isEqualByComparingTo(new BigDecimal(expected));
        }

        public BigDecimalAssert isGreaterThan(BigDecimal other) {
            isNotNull();
            if (actual.compareTo(other) <= 0) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected > <" + other + "> but was: <" + actual + ">");
            }
            return this;
        }
    }

    public static class BooleanAssert extends ObjectAssert<Boolean> {
        public BooleanAssert(Boolean actual) {
            super(actual);
        }

        public BooleanAssert isTrue() {
            if (!Boolean.TRUE.equals(actual)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected true, but was false/null");
            }
            return this;
        }

        public BooleanAssert isFalse() {
            if (!Boolean.FALSE.equals(actual)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected false, but was true/null");
            }
            return this;
        }
    }

    public static class StringAssert extends ObjectAssert<String> {
        public StringAssert(String actual) {
            super(actual);
        }

        public StringAssert contains(CharSequence... values) {
            isNotNull();
            for (CharSequence v : values) {
                if (!actual.contains(v)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "expected string to contain <" + v + "> but was: <" + actual + ">");
                }
            }
            return this;
        }

        public StringAssert isNotEmpty() {
            isNotNull();
            if (actual.isEmpty()) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected string to not be empty");
            }
            return this;
        }
    }

    public static class CollectionAssert<E> extends ObjectAssert<Collection<E>> {
        public CollectionAssert(Collection<E> actual) {
            super(actual);
        }

        public CollectionAssert<E> hasSize(int expectedSize) {
            isNotNull();
            if (actual.size() != expectedSize) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected size <" + expectedSize + "> but was: <" + actual.size() + ">");
            }
            return this;
        }

        public CollectionAssert<E> isEmpty() {
            isNotNull();
            if (!actual.isEmpty()) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected collection to be empty");
            }
            return this;
        }

        public CollectionAssert<E> isNotEmpty() {
            isNotNull();
            if (actual.isEmpty()) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected collection to not be empty");
            }
            return this;
        }
    }
}
