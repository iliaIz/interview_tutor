package org.mockito;

import org.mockito.verification.VerificationMode;

public interface InOrder {
    <T> T verify(T mock);
    <T> T verify(T mock, VerificationMode mode);
    void verifyNoMoreInteractions();
}
