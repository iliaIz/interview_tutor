package com.assessment.sandbox;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * High-performance Hot Resident JVM Sandbox Daemon.
 * Keeps Java 21 compiler, JIT compiler, and classloader warm in memory.
 * Listens on 127.0.0.1:8099, reducing sandbox execution latency from ~900ms to ~60ms.
 */
public class ResidentSandboxDaemon {
    public static final int DEFAULT_PORT = 8099;
    private static final AtomicInteger executionCount = new AtomicInteger(0);

    public static void main(String[] args) {
        int port = DEFAULT_PORT;
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {}
        }

        System.out.println("[DAEMON] Starting Resident JVM Sandbox Daemon on port " + port + "...");

        // Pre-warm JavaCompiler and standard classes
        try {
            CompilerService.execute("{\"files\":[{\"path\":\"src/main/java/Warmup.java\",\"content\":\"public class Warmup {}\"}]}");
            System.out.println("[DAEMON] Warmup compilation completed successfully.");
        } catch (Throwable t) {
            System.err.println("[DAEMON] Warmup warning: " + t.getMessage());
        }

        ExecutorService pool = Executors.newFixedThreadPool(16);

        try (ServerSocket serverSocket = new ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"))) {
            System.out.println("[DAEMON_READY] Listening on 127.0.0.1:" + port);
            System.out.flush();

            while (!serverSocket.isClosed()) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    pool.submit(() -> handleClient(clientSocket));
                } catch (IOException e) {
                    if (serverSocket.isClosed()) break;
                }
            }
        } catch (IOException e) {
            System.err.println("[DAEMON] Fatal server socket error: " + e.getMessage());
        } finally {
            pool.shutdown();
        }
    }

    private static void handleClient(Socket socket) {
        try (
            socket;
            DataInputStream in = new DataInputStream(new BufferedInputStream(socket.getInputStream()));
            DataOutputStream out = new DataOutputStream(new BufferedOutputStream(socket.getOutputStream()))
        ) {
            socket.setSoTimeout(10000); // 10s socket timeout

            int length = in.readInt();
            if (length <= 0 || length > 20 * 1024 * 1024) { // Max 20MB payload
                return;
            }

            byte[] buffer = new byte[length];
            in.readFully(buffer);
            String requestJson = new String(buffer, StandardCharsets.UTF_8);

            String responseJson;
            try {
                responseJson = CompilerService.execute(requestJson);
            } catch (Throwable t) {
                responseJson = "{\"isCompilable\":false,\"error\":\"" + t.getMessage() + "\"}";
            }

            byte[] responseBytes = responseJson.getBytes(StandardCharsets.UTF_8);
            out.writeInt(responseBytes.length);
            out.write(responseBytes);
            out.flush();

            int count = executionCount.incrementAndGet();
            if (count % 200 == 0) {
                System.gc();
            }
        } catch (IOException ignored) {
        }
    }
}
