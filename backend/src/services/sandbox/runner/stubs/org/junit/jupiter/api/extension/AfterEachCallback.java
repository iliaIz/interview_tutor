package org.junit.jupiter.api.extension;

public interface AfterEachCallback extends Extension {
    void afterEach(ExtensionContext context) throws Exception;
}
