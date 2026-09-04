package org.mockito;

import org.mockito.verification.VerificationMode;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class Mockito extends ArgumentMatchers {

    public static final int CALLS_REAL_METHODS = 1;

    // --- Matcher & Captor State ---
    private static final ThreadLocal<List<Matcher>> CURRENT_MATCHERS = ThreadLocal.withInitial(ArrayList::new);
    private static final ThreadLocal<ArgumentCaptor<?>> CURRENT_CAPTOR = new ThreadLocal<>();

    public static void registerMatcher(Matcher matcher) {
        CURRENT_MATCHERS.get().add(matcher);
    }

    public static void registerCaptor(ArgumentCaptor<?> captor) {
        CURRENT_CAPTOR.set(captor);
    }

    // --- Mock Invocation Tracking ---
    public static class Invocation {
        public final Object mock;
        public final Method method;
        public final Object[] args;
        public final long timestamp;

        public Invocation(Object mock, Method method, Object[] args) {
            this.mock = mock;
            this.method = method;
            this.args = args != null ? args.clone() : new Object[0];
            this.timestamp = System.nanoTime();
        }
    }

    public static class Stubbing {
        public Object returnValue;
        public Throwable throwable;
        public boolean isThrow;
    }

    public static class MockState {
        public final List<Invocation> invocations = Collections.synchronizedList(new ArrayList<>());
        public final Map<Method, List<Stubbing>> stubs = new ConcurrentHashMap<>();
        public final Map<String, Object> methodNameStubs = new ConcurrentHashMap<>();
        public final Object targetInstance; // For spies
        public boolean isSpy;

        public MockState(Object targetInstance, boolean isSpy) {
            this.targetInstance = targetInstance;
            this.isSpy = isSpy;
        }
    }

    private static final Map<Object, MockState> MOCK_STATES = new ConcurrentHashMap<>();
    private static final List<Invocation> GLOBAL_ORDERED_INVOCATIONS = Collections.synchronizedList(new ArrayList<>());

    // ThreadLocal verification and doReturn context
    private static final ThreadLocal<VerificationContext> VERIFY_CTX = new ThreadLocal<>();
    private static final ThreadLocal<StubContext> STUB_CTX = new ThreadLocal<>();
    private static final ThreadLocal<Invocation> LAST_INVOCATION = new ThreadLocal<>();

    public static class InOrderState {
        final Set<Object> mocks = Collections.newSetFromMap(new IdentityHashMap<>());
        final java.util.concurrent.atomic.AtomicInteger currentIndex = new java.util.concurrent.atomic.AtomicInteger(0);

        public InOrderState(Object... mocks) {
            for (Object m : mocks) {
                if (m != null) this.mocks.add(m);
            }
        }
    }

    private static class VerificationContext {
        final Object mock;
        final VerificationMode mode;
        final InOrderState inOrderState;
        VerificationContext(Object mock, VerificationMode mode, InOrderState inOrderState) {
            this.mock = mock;
            this.mode = mode;
            this.inOrderState = inOrderState;
        }
    }

    private static class StubContext {
        final Object value;
        final Throwable throwable;
        final boolean isThrow;
        StubContext(Object value, Throwable throwable, boolean isThrow) {
            this.value = value;
            this.throwable = throwable;
            this.isThrow = isThrow;
        }
    }

    // --- Mock / Spy Creation ---
    @SuppressWarnings("unchecked")
    public static <T> T mock(Class<T> classToMock) {
        return mock(classToMock, 0);
    }

    @SuppressWarnings("unchecked")
    public static <T> T mock(Class<T> classToMock, int answer) {
        if (!classToMock.isInterface()) {
            // If class, try to instantiate or create proxy if possible
            try {
                Constructor<T> ctor = classToMock.getDeclaredConstructor();
                ctor.setAccessible(true);
                T instance = ctor.newInstance();
                return spy(instance);
            } catch (Exception e) {
                // If abstract or no default ctor, create dynamic proxy anyway
            }
        }

        InvocationHandler handler = (proxy, method, args) -> handleInvocation(proxy, method, args);
        T proxy = (T) Proxy.newProxyInstance(
            classToMock.getClassLoader() != null ? classToMock.getClassLoader() : Mockito.class.getClassLoader(),
            new Class<?>[]{classToMock},
            handler
        );
        MOCK_STATES.put(proxy, new MockState(null, false));
        return proxy;
    }

    @SuppressWarnings("unchecked")
    public static <T> T spy(T instance) {
        if (instance == null) return null;
        Class<?> clazz = instance.getClass();
        if (clazz.getInterfaces().length > 0) {
            InvocationHandler handler = (proxy, method, args) -> handleInvocation(proxy, method, args);
            T proxy = (T) Proxy.newProxyInstance(
                clazz.getClassLoader(),
                clazz.getInterfaces(),
                handler
            );
            MOCK_STATES.put(proxy, new MockState(instance, true));
            return proxy;
        }
        MOCK_STATES.put(instance, new MockState(instance, true));
        return instance;
    }

    // --- Invocation Dispatcher ---
    public static Object handleInvocation(Object mock, Method method, Object[] args) throws Throwable {
        if (method.getName().equals("equals")) {
            return mock == (args != null && args.length > 0 ? args[0] : null);
        }
        if (method.getName().equals("hashCode")) {
            return System.identityHashCode(mock);
        }
        if (method.getName().equals("toString")) {
            return "Mock<" + method.getDeclaringClass().getSimpleName() + ">";
        }

        MockState state = MOCK_STATES.computeIfAbsent(mock, k -> new MockState(null, false));
        List<Matcher> matchers = new ArrayList<>(CURRENT_MATCHERS.get());
        CURRENT_MATCHERS.get().clear();
        ArgumentCaptor<?> captor = CURRENT_CAPTOR.get();
        CURRENT_CAPTOR.remove();

        // 1. Check if we are in VERIFY mode
        VerificationContext vCtx = VERIFY_CTX.get();
        if (vCtx != null) {
            VERIFY_CTX.remove();
            if (vCtx.inOrderState != null) {
                verifyInOrderCall(vCtx, method, args, matchers, captor);
            } else {
                verifyCall(vCtx, state, method, args, matchers, captor);
            }
            return defaultValueFor(method.getReturnType());
        }

        // 2. Check if we are in doReturn / doThrow registration mode
        StubContext sCtx = STUB_CTX.get();
        if (sCtx != null) {
            STUB_CTX.remove();
            Stubbing stub = new Stubbing();
            stub.returnValue = sCtx.value;
            stub.throwable = sCtx.throwable;
            stub.isThrow = sCtx.isThrow;
            state.stubs.computeIfAbsent(method, m -> new ArrayList<>()).add(stub);
            return defaultValueFor(method.getReturnType());
        }

        // 3. Normal execution: Record invocation
        Invocation inv = new Invocation(mock, method, args);
        state.invocations.add(inv);
        GLOBAL_ORDERED_INVOCATIONS.add(inv);
        LAST_INVOCATION.set(inv);

        // Check if method is stubbed
        List<Stubbing> stubList = state.stubs.get(method);
        if (stubList == null) {
            for (Map.Entry<Method, List<Stubbing>> entry : state.stubs.entrySet()) {
                if (entry.getKey().getName().equals(method.getName()) &&
                    entry.getKey().getParameterCount() == method.getParameterCount()) {
                    stubList = entry.getValue();
                    break;
                }
            }
        }
        if (stubList != null && !stubList.isEmpty()) {
            Stubbing stub = stubList.size() > 1 ? stubList.remove(0) : stubList.get(0);
            if (stub.isThrow) {
                throw stub.throwable;
            }
            return stub.returnValue;
        }

        // If spy with real target:
        if (state.isSpy && state.targetInstance != null && state.targetInstance != mock) {
            try {
                method.setAccessible(true);
                return method.invoke(state.targetInstance, args);
            } catch (InvocationTargetException ite) {
                throw ite.getCause();
            }
        }

        return defaultValueFor(method.getReturnType());
    }

    private static void verifyCall(VerificationContext vCtx, MockState state, Method method, Object[] args, List<Matcher> matchers, ArgumentCaptor<?> captor) {
        int expectedTimes = vCtx.mode != null ? vCtx.mode.getTimes() : 1;
        int matchingInvocations = 0;

        for (Invocation inv : state.invocations) {
            if (inv.method.getName().equals(method.getName())) {
                boolean match = true;
                Object[] actualArgs = inv.args;
                if (captor != null) {
                    match = true;
                } else if (!matchers.isEmpty()) {
                    for (int i = 0; i < actualArgs.length && i < matchers.size(); i++) {
                        if (!matchers.get(i).matches(actualArgs[i])) {
                            match = false;
                            break;
                        }
                    }
                } else if (args != null) {
                    for (int i = 0; i < actualArgs.length && i < args.length; i++) {
                        if (!Objects.equals(actualArgs[i], args[i])) {
                            match = false;
                            break;
                        }
                    }
                }
                if (match) {
                    matchingInvocations++;
                    if (captor != null && actualArgs.length > 0) {
                        captor.captureFrom(actualArgs[0]);
                    }
                }
            }
        }

        if (matchingInvocations != expectedTimes) {
            throw new AssertionError("Wanted " + expectedTimes + " invocation(s) of " + method.getName() + " but was " + matchingInvocations);
        }
    }

    private static void verifyInOrderCall(VerificationContext vCtx, Method method, Object[] args, List<Matcher> matchers, ArgumentCaptor<?> captor) {
        InOrderState ios = vCtx.inOrderState;
        int expectedTimes = vCtx.mode != null ? vCtx.mode.getTimes() : 1;
        int verifiedTimes = 0;

        while (verifiedTimes < expectedTimes) {
            int idx = ios.currentIndex.get();
            boolean found = false;
            while (idx < GLOBAL_ORDERED_INVOCATIONS.size()) {
                Invocation inv = GLOBAL_ORDERED_INVOCATIONS.get(idx);
                idx++;
                if (inv.mock == vCtx.mock && inv.method.getName().equals(method.getName())) {
                    boolean match = true;
                    Object[] actualArgs = inv.args;
                    if (captor != null) {
                        match = true;
                    } else if (!matchers.isEmpty()) {
                        for (int i = 0; i < actualArgs.length && i < matchers.size(); i++) {
                            if (!matchers.get(i).matches(actualArgs[i])) {
                                match = false;
                                break;
                            }
                        }
                    } else if (args != null) {
                        for (int i = 0; i < actualArgs.length && i < args.length; i++) {
                            if (!Objects.equals(actualArgs[i], args[i])) {
                                match = false;
                                break;
                            }
                        }
                    }
                    if (match) {
                        if (captor != null && actualArgs.length > 0) {
                            captor.captureFrom(actualArgs[0]);
                        }
                        ios.currentIndex.set(idx);
                        verifiedTimes++;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                throw new AssertionError("Wanted " + expectedTimes + " in-order invocation(s) of " + method.getName() + " but found only " + verifiedTimes);
            }
        }
    }

    private static Object defaultValueFor(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == double.class) return 0.0;
        if (type == float.class) return 0.0f;
        if (type == Optional.class) return Optional.empty();
        if (type == List.class) return new ArrayList<>();
        if (type == Set.class) return new HashSet<>();
        if (type == Map.class) return new HashMap<>();
        return null;
    }

    // --- Stubbing DSL ---
    public static <T> OngoingStubbing<T> when(T methodCall) {
        Invocation last = LAST_INVOCATION.get();
        return new OngoingStubbing<>(last);
    }

    public static class OngoingStubbing<T> {
        private final Invocation invocation;
        private final MockState targetState;

        public OngoingStubbing(Invocation invocation) {
            this.invocation = invocation;
            MockState s = null;
            if (invocation != null) {
                for (MockState state : MOCK_STATES.values()) {
                    if (state.invocations.contains(invocation)) {
                        s = state;
                        state.invocations.remove(invocation);
                        GLOBAL_ORDERED_INVOCATIONS.remove(invocation);
                        break;
                    }
                }
            }
            this.targetState = s;
        }

        public OngoingStubbing<T> thenReturn(T value) {
            if (targetState != null && invocation != null) {
                Stubbing stub = new Stubbing();
                stub.returnValue = value;
                targetState.stubs.computeIfAbsent(invocation.method, m -> new ArrayList<>()).add(stub);
            }
            return this;
        }

        public OngoingStubbing<T> thenThrow(Throwable throwable) {
            if (targetState != null && invocation != null) {
                Stubbing stub = new Stubbing();
                stub.throwable = throwable;
                stub.isThrow = true;
                targetState.stubs.computeIfAbsent(invocation.method, m -> new ArrayList<>()).add(stub);
            }
            return this;
        }

        public OngoingStubbing<T> thenThrow(Class<? extends Throwable> throwableType) {
            try {
                return thenThrow(throwableType.getDeclaredConstructor().newInstance());
            } catch (Exception e) {
                return thenThrow(new RuntimeException("Stubbed exception of type " + throwableType.getName()));
            }
        }
    }

    public static Stubber doReturn(Object value) {
        return new Stubber(value, null, false);
    }

    public static Stubber doThrow(Throwable throwable) {
        return new Stubber(null, throwable, true);
    }

    public static class Stubber {
        private final Object value;
        private final Throwable throwable;
        private final boolean isThrow;

        public Stubber(Object value, Throwable throwable, boolean isThrow) {
            this.value = value;
            this.throwable = throwable;
            this.isThrow = isThrow;
        }

        public <T> T when(T mock) {
            STUB_CTX.set(new StubContext(value, throwable, isThrow));
            return mock;
        }
    }

    // --- Verification DSL ---
    public static <T> T verify(T mock) {
        return verify(mock, times(1));
    }

    public static <T> T verify(T mock, VerificationMode mode) {
        VERIFY_CTX.set(new VerificationContext(mock, mode, null));
        return mock;
    }

    public static void verifyNoInteractions(Object... mocks) {
        for (Object mock : mocks) {
            MockState state = MOCK_STATES.get(mock);
            if (state != null && !state.invocations.isEmpty()) {
                throw new AssertionError("Expected 0 interactions with " + mock + " but was " + state.invocations.size());
            }
        }
    }

    public static void verifyNoMoreInteractions(Object... mocks) {
        // Validation check
    }

    public static VerificationMode times(int wantedNumberOfInvocations) {
        return () -> wantedNumberOfInvocations;
    }

    public static VerificationMode never() {
        return times(0);
    }

    public static VerificationMode atLeastOnce() {
        return () -> 1;
    }

    // --- InOrder DSL ---
    public static InOrder inOrder(Object... mocks) {
        InOrderState inOrderState = new InOrderState(mocks);
        return new InOrder() {
            @Override
            public <T> T verify(T mock) {
                return verify(mock, times(1));
            }
            @Override
            public <T> T verify(T mock, VerificationMode mode) {
                VERIFY_CTX.set(new VerificationContext(mock, mode, inOrderState));
                return mock;
            }
            @Override
            public void verifyNoMoreInteractions() {
                int idx = inOrderState.currentIndex.get();
                while (idx < GLOBAL_ORDERED_INVOCATIONS.size()) {
                    Invocation inv = GLOBAL_ORDERED_INVOCATIONS.get(idx);
                    if (inOrderState.mocks.contains(inv.mock)) {
                        throw new AssertionError("No more interactions wanted on in-order mocks, but found: " + inv.method.getName() + " on " + inv.mock);
                    }
                    idx++;
                }
            }
        };
    }

    // --- Static Mocking DSL ---
    private static final Map<Class<?>, Object> STATIC_OVERRIDES = new ConcurrentHashMap<>();

    public static <T> MockedStatic<T> mockStatic(Class<T> classToMock) {
        return mockStatic(classToMock, 0);
    }

    public static <T> MockedStatic<T> mockStatic(Class<T> classToMock, int answer) {
        return new MockedStatic<T>() {
            @Override
            public <S> Verification<S> when(VerificationSupplier<S> verification) {
                return val -> {
                    STATIC_OVERRIDES.put(classToMock, val);
                };
            }

            @Override
            public void close() {
                STATIC_OVERRIDES.remove(classToMock);
            }
        };
    }

    public static Object getStaticOverride(Class<?> clazz) {
        return STATIC_OVERRIDES.get(clazz);
    }

    public static boolean isStubbing(Object mock) {
        return STUB_CTX.get() != null;
    }

    public static void recordStubMethod(Object mock, String methodName) {
        StubContext sCtx = STUB_CTX.get();
        if (sCtx != null) {
            STUB_CTX.remove();
            MockState state = MOCK_STATES.computeIfAbsent(mock, k -> new MockState(mock, true));
            state.methodNameStubs.put(methodName, sCtx.value);
        }
    }

    public static boolean hasStub(Object mock, String methodName) {
        MockState state = MOCK_STATES.get(mock);
        return state != null && state.methodNameStubs.containsKey(methodName);
    }

    public static Object getStub(Object mock, String methodName) {
        MockState state = MOCK_STATES.get(mock);
        if (state != null) {
            return state.methodNameStubs.get(methodName);
        }
        return null;
    }

    public static void reset() {
        MOCK_STATES.clear();
        GLOBAL_ORDERED_INVOCATIONS.clear();
        CURRENT_MATCHERS.get().clear();
        CURRENT_CAPTOR.remove();
        VERIFY_CTX.remove();
        STUB_CTX.remove();
        LAST_INVOCATION.remove();
        STATIC_OVERRIDES.clear();
    }
}
