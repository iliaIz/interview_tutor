package org.mockito.junit.jupiter;

import org.junit.jupiter.api.extension.*;
import org.mockito.*;
import java.lang.reflect.Field;

public class MockitoExtension implements Extension, BeforeEachCallback, AfterEachCallback {

    @Override
    public void beforeEach(ExtensionContext context) throws Exception {
        Object testInstance = context.getRequiredTestInstance();
        initMocks(testInstance);
    }

    @Override
    public void afterEach(ExtensionContext context) throws Exception {
        Mockito.reset();
    }

    public static void initMocks(Object testInstance) {
        if (testInstance == null) return;
        Class<?> clazz = testInstance.getClass();
        while (clazz != null && clazz != Object.class) {
            for (Field f : clazz.getDeclaredFields()) {
                f.setAccessible(true);
                try {
                    boolean isMock = f.isAnnotationPresent(Mock.class);
                    if (!isMock) {
                        for (java.lang.annotation.Annotation a : f.getAnnotations()) {
                            String aName = a.annotationType().getSimpleName();
                            if (aName.equals("MockitoBean") || aName.equals("MockBean")) {
                                isMock = true;
                                break;
                            }
                        }
                    }
                    if (isMock) {
                        Object mock = Mockito.mock(f.getType());
                        f.set(testInstance, mock);
                    } else if (f.isAnnotationPresent(Captor.class)) {
                        // find generic type if ArgumentCaptor
                        if (f.getType().equals(ArgumentCaptor.class)) {
                            ArgumentCaptor<?> captor = ArgumentCaptor.forClass(Object.class);
                            f.set(testInstance, captor);
                        }
                    } else if (f.isAnnotationPresent(Spy.class)) {
                        Object val = f.get(testInstance);
                        if (val == null) {
                            val = Mockito.mock(f.getType());
                            f.set(testInstance, val);
                        } else {
                            f.set(testInstance, Mockito.spy(val));
                        }
                    }
                } catch (Exception ignored) {}
            }
            clazz = clazz.getSuperclass();
        }
    }
}
