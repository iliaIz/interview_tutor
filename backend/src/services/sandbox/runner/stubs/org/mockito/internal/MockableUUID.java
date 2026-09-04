package org.mockito.internal;

import org.mockito.Mockito;
import java.util.UUID;

public class MockableUUID {
    public static UUID randomUUID() {
        Object override = Mockito.getStaticOverride(UUID.class);
        if (override instanceof UUID u) {
            return u;
        }
        return UUID.randomUUID();
    }
}
