package org.assertj.core.api;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.List;
import java.util.ArrayList;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Consumer;

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

    public static <E> CollectionAssert<E> assertThat(List<E> actual) {
        return new CollectionAssert<>(actual);
    }

    public static <K, V> MapAssert<K, V> assertThat(Map<K, V> actual) {
        return new MapAssert<>(actual);
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

        public ObjectAssert<T> isSameAs(Object expected) {
            if (actual != expected) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected same instance: <" + expected + "> but was: <" + actual + ">");
            }
            return this;
        }

        public ObjectAssert<T> isNotSameAs(Object other) {
            if (actual == other) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected not same instance: <" + other + ">");
            }
            return this;
        }

        public ObjectAssert<T> isIn(Object... values) {
            isNotNull();
            for (Object v : values) {
                if (Objects.equals(actual, v)) return this;
            }
            String prefix = description != null ? "[" + description + "] " : "";
            throw new AssertionError(prefix + "expected <" + actual + "> to be in: " + java.util.Arrays.toString(values));
        }

        public ObjectAssert<T> isNotIn(Object... values) {
            isNotNull();
            for (Object v : values) {
                if (Objects.equals(actual, v)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "expected <" + actual + "> not to be in: " + java.util.Arrays.toString(values));
                }
            }
            return this;
        }

        public ObjectAssert<T> satisfies(Consumer<? super T> requirements) {
            isNotNull();
            requirements.accept(actual);
            return this;
        }

        public ObjectAssert<T> matches(Predicate<? super T> predicate) {
            isNotNull();
            if (!predicate.test(actual)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected <" + actual + "> to match predicate");
            }
            return this;
        }
    }

    public static class BigDecimalAssert extends ObjectAssert<BigDecimal> {
        public BigDecimalAssert(BigDecimal actual) {
            super(actual);
        }

        @Override
        public BigDecimalAssert as(String description, Object... args) {
            super.as(description, args);
            return this;
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

        public BigDecimalAssert isGreaterThanOrEqualTo(BigDecimal other) {
            isNotNull();
            if (actual.compareTo(other) < 0) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected >= <" + other + "> but was: <" + actual + ">");
            }
            return this;
        }

        public BigDecimalAssert isLessThan(BigDecimal other) {
            isNotNull();
            if (actual.compareTo(other) >= 0) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected < <" + other + "> but was: <" + actual + ">");
            }
            return this;
        }
    }

    public static class BooleanAssert extends ObjectAssert<Boolean> {
        public BooleanAssert(Boolean actual) {
            super(actual);
        }

        @Override
        public BooleanAssert as(String description, Object... args) {
            super.as(description, args);
            return this;
        }

        public BooleanAssert isTrue() {
            isNotNull();
            if (!Boolean.TRUE.equals(actual)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected true");
            }
            return this;
        }

        public BooleanAssert isFalse() {
            isNotNull();
            if (!Boolean.FALSE.equals(actual)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected false");
            }
            return this;
        }
    }

    public static class StringAssert extends ObjectAssert<String> {
        public StringAssert(String actual) {
            super(actual);
        }

        @Override
        public StringAssert as(String description, Object... args) {
            super.as(description, args);
            return this;
        }

        public StringAssert contains(CharSequence... values) {
            isNotNull();
            for (CharSequence val : values) {
                if (!actual.contains(val)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "expected string to contain <" + val + "> but was: <" + actual + ">");
                }
            }
            return this;
        }

        public StringAssert doesNotContain(CharSequence... values) {
            isNotNull();
            for (CharSequence val : values) {
                if (actual.contains(val)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "expected string not to contain <" + val + ">");
                }
            }
            return this;
        }

        public StringAssert startsWith(CharSequence prefix) {
            isNotNull();
            if (!actual.startsWith(prefix.toString())) {
                String p = description != null ? "[" + description + "] " : "";
                throw new AssertionError(p + "expected string to start with <" + prefix + "> but was: <" + actual + ">");
            }
            return this;
        }

        public StringAssert endsWith(CharSequence suffix) {
            isNotNull();
            if (!actual.endsWith(suffix.toString())) {
                String p = description != null ? "[" + description + "] " : "";
                throw new AssertionError(p + "expected string to end with <" + suffix + "> but was: <" + actual + ">");
            }
            return this;
        }

        public StringAssert isEmpty() {
            isNotNull();
            if (!actual.isEmpty()) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected string to be empty");
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

        @Override
        public CollectionAssert<E> as(String description, Object... args) {
            super.as(description, args);
            return this;
        }

        public CollectionAssert<E> hasSize(int expectedSize) {
            isNotNull();
            if (actual.size() != expectedSize) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected size <" + expectedSize + "> but was: <" + actual.size() + ">");
            }
            return this;
        }

        public CollectionAssert<E> contains(Object... elements) {
            isNotNull();
            for (Object el : elements) {
                if (!actual.contains(el)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "expected collection to contain: <" + el + "> but was: <" + actual + ">");
                }
            }
            return this;
        }

        public CollectionAssert<E> doesNotContain(Object... elements) {
            isNotNull();
            for (Object el : elements) {
                if (actual.contains(el)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "expected collection not to contain: <" + el + ">");
                }
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

        public CollectionAssert<E> containsExactly(Object... elements) {
            hasSize(elements.length);
            int idx = 0;
            for (E item : actual) {
                if (!Objects.equals(item, elements[idx])) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "at index " + idx + " expected <" + elements[idx] + "> but was <" + item + ">");
                }
                idx++;
            }
            return this;
        }

        public CollectionAssert<E> containsExactlyInAnyOrder(Object... elements) {
            hasSize(elements.length);
            contains(elements);
            return this;
        }

        public <R> CollectionAssert<R> extracting(Function<? super E, R> extractor) {
            isNotNull();
            List<R> extracted = new ArrayList<>();
            for (E item : actual) {
                extracted.add(extractor.apply(item));
            }
            return new CollectionAssert<>(extracted);
        }

        public CollectionAssert<E> filteredOn(Predicate<? super E> filter) {
            isNotNull();
            List<E> filtered = new ArrayList<>();
            for (E item : actual) {
                if (filter.test(item)) {
                    filtered.add(item);
                }
            }
            return new CollectionAssert<>(filtered);
        }

        public CollectionAssert<E> allMatch(Predicate<? super E> predicate) {
            isNotNull();
            for (E item : actual) {
                if (!predicate.test(item)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "element <" + item + "> does not match predicate");
                }
            }
            return this;
        }

        public CollectionAssert<E> anyMatch(Predicate<? super E> predicate) {
            isNotNull();
            for (E item : actual) {
                if (predicate.test(item)) return this;
            }
            String prefix = description != null ? "[" + description + "] " : "";
            throw new AssertionError(prefix + "no element matches predicate in collection");
        }

        public CollectionAssert<E> noneMatch(Predicate<? super E> predicate) {
            isNotNull();
            for (E item : actual) {
                if (predicate.test(item)) {
                    String prefix = description != null ? "[" + description + "] " : "";
                    throw new AssertionError(prefix + "element <" + item + "> unexpectedly matched predicate");
                }
            }
            return this;
        }
    }

    public static class MapAssert<K, V> extends ObjectAssert<Map<K, V>> {
        public MapAssert(Map<K, V> actual) {
            super(actual);
        }

        @Override
        public MapAssert<K, V> as(String description, Object... args) {
            super.as(description, args);
            return this;
        }

        public MapAssert<K, V> hasSize(int expectedSize) {
            isNotNull();
            if (actual.size() != expectedSize) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected map size <" + expectedSize + "> but was: <" + actual.size() + ">");
            }
            return this;
        }

        public MapAssert<K, V> containsKey(K key) {
            isNotNull();
            if (!actual.containsKey(key)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected map to contain key: <" + key + ">");
            }
            return this;
        }

        public MapAssert<K, V> containsEntry(K key, V value) {
            isNotNull();
            if (!actual.containsKey(key) || !Objects.equals(actual.get(key), value)) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected map to contain entry <" + key + "=" + value + "> but was: <" + actual.get(key) + ">");
            }
            return this;
        }

        public MapAssert<K, V> isEmpty() {
            isNotNull();
            if (!actual.isEmpty()) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected map to be empty");
            }
            return this;
        }

        public MapAssert<K, V> isNotEmpty() {
            isNotNull();
            if (actual.isEmpty()) {
                String prefix = description != null ? "[" + description + "] " : "";
                throw new AssertionError(prefix + "expected map not to be empty");
            }
            return this;
        }
    }
}
