package org.mockito;

public interface MockedStatic<T> extends AutoCloseable {
    <S> Verification<S> when(VerificationSupplier<S> verification);
    void close();

    @FunctionalInterface
    interface VerificationSupplier<R> {
        R get() throws Throwable;
    }

    interface Verification<R> {
        void thenReturn(R value);
    }
}
