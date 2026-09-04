package org.awaitility.core;

import java.time.Duration;
import java.util.concurrent.Callable;

public class ConditionFactory {
    private Duration timeout = Duration.ofSeconds(10);
    private Duration pollInterval = Duration.ofMillis(50);
    private Duration during = null;
    private String alias;

    public ConditionFactory() {}

    public ConditionFactory(String alias) {
        this.alias = alias;
    }

    public ConditionFactory atMost(Duration timeout) {
        this.timeout = timeout;
        return this;
    }

    public ConditionFactory pollInterval(Duration interval) {
        this.pollInterval = interval;
        return this;
    }

    public ConditionFactory during(Duration duration) {
        this.during = duration;
        return this;
    }

    public void until(Callable<Boolean> condition) {
        long start = System.currentTimeMillis();
        long maxMs = timeout.toMillis();
        long intervalMs = Math.max(1, pollInterval.toMillis());

        while (System.currentTimeMillis() - start <= maxMs) {
            try {
                if (Boolean.TRUE.equals(condition.call())) {
                    if (during != null) {
                        long duringMs = during.toMillis();
                        long dStart = System.currentTimeMillis();
                        while (System.currentTimeMillis() - dStart < duringMs) {
                            Thread.sleep(10);
                            if (!Boolean.TRUE.equals(condition.call())) {
                                throw new AssertionError("Condition did not hold during " + during);
                            }
                        }
                    }
                    return;
                }
            } catch (Throwable t) {
                // Keep polling
            }
            try {
                Thread.sleep(intervalMs);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new AssertionError("Condition not fulfilled within " + timeout + (alias != null ? " for " + alias : ""));
    }

    public void untilAsserted(ThrowingRunnable assertion) {
        long start = System.currentTimeMillis();
        long maxMs = timeout.toMillis();
        long intervalMs = Math.max(1, pollInterval.toMillis());
        Throwable lastErr = null;

        while (System.currentTimeMillis() - start <= maxMs) {
            try {
                assertion.run();
                return;
            } catch (Throwable t) {
                lastErr = t;
            }
            try {
                Thread.sleep(intervalMs);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new AssertionError("Assertion not fulfilled within " + timeout + ": " + (lastErr != null ? lastErr.getMessage() : "timeout"));
    }

    @FunctionalInterface
    public interface ThrowingRunnable {
        void run() throws Throwable;
    }
}
