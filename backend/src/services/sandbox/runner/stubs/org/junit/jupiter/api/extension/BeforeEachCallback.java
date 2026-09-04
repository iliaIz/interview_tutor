package org.junit.jupiter.api.extension;

public interface BeforeEachCallback extends Extension {
    void beforeEach(ExtensionContext context) throws Exception;
}
