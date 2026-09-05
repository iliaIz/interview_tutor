# Isolated Java 21 Sandbox Daemon for Machine Coding Evaluation
# Build stage
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /build

# Copy Java sources and stubs
COPY backend/src/services/sandbox/runner /build/runner

# Compile daemon and all stubs into /app/bin
RUN mkdir -p /app/bin && \
    find /build/runner -name "*.java" > /build/sources.txt && \
    javac -d /app/bin @/build/sources.txt

# Stage 2: Hardened unprivileged runner
FROM eclipse-temurin:21-jdk-alpine AS runner

WORKDIR /app

# Create unprivileged application user
RUN addgroup -S sandboxgroup && adduser -S sandboxuser -G sandboxgroup

# Copy compiled classes from builder
COPY --from=builder --chown=sandboxuser:sandboxgroup /app/bin /app/bin

USER sandboxuser

ENV SANDBOX_BIND_HOST=0.0.0.0
ENV SANDBOX_PORT=8099

EXPOSE 8099

# Strict memory envelope for 2GB VPS: Serial GC, max 128MB heap
CMD ["java", "-Xms16m", "-Xmx128m", "-XX:+UseSerialGC", "-cp", "/app/bin", "com.assessment.sandbox.ResidentSandboxDaemon", "8099"]
