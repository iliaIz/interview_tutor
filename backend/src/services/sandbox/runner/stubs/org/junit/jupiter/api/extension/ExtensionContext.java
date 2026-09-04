package org.junit.jupiter.api.extension;

import java.lang.reflect.Method;
import java.util.Optional;

public interface ExtensionContext {
    Optional<Class<?>> getTestClass();
    Class<?> getRequiredTestClass();
    Optional<Method> getTestMethod();
    Method getRequiredTestMethod();
    Optional<Object> getTestInstance();
    Object getRequiredTestInstance();
    Store getStore(Namespace namespace);

    interface Store {
        Object get(Object key);
        <T> T get(Object key, Class<T> requiredType);
        void put(Object key, Object value);
        Object remove(Object key);
    }

    class Namespace {
        public static Namespace create(Object... parts) {
            return new Namespace();
        }
    }
}
