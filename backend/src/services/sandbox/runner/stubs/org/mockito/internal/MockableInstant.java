package org.mockito.internal;

import org.mockito.Mockito;
import java.time.Instant;

public class MockableInstant {
    public static Instant now() {
        Object override = Mockito.getStaticOverride(Instant.class);
        if (override instanceof Instant i) {
            return i;
        }
        return Instant.now();
    }
}
