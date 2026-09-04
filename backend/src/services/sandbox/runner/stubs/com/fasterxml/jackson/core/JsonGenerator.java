package com.fasterxml.jackson.core;

import java.io.IOException;

public abstract class JsonGenerator {
    public abstract void writeString(String text) throws IOException;
    public abstract void writeNumber(double v) throws IOException;
    public abstract void writeNumber(long v) throws IOException;
    public abstract void writeNumber(int v) throws IOException;
    public abstract void writeBoolean(boolean v) throws IOException;
    public abstract void writeNull() throws IOException;
}
