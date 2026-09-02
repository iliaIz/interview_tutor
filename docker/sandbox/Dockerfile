FROM eclipse-temurin:21-jdk-alpine

# Set non-root unprivileged runner user
RUN addgroup -S runner && adduser -S runner -G runner

WORKDIR /app

# Copy CompilerService and compile into classes
COPY backend/src/services/sandbox/runner/CompilerService.java /app/CompilerService.java
RUN javac -d /app /app/CompilerService.java

# Drop root privileges
USER runner

# Run in ephemeral mode
ENTRYPOINT ["java", "-cp", "/app", "com.assessment.sandbox.CompilerService"]
