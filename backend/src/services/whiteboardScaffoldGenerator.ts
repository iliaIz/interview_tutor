/**
 * whiteboardScaffoldGenerator.ts
 * Generates canonical Java 21 LTS Maven scratchpad package for IntelliJ IDEA
 * and bundles the Zero-Dependency Whiteboard Companion Bridge on port 41790.
 */

import { createZipArchive, ZipEntry } from './zipGenerator';
import { BRIDGE_MJS_TEMPLATE } from './bridgeMjsTemplate';
import { WS_SERVER_MJS_TEMPLATE } from './wsServerMjsTemplate';

export const WHITEBOARD_BRIDGE_PORT = 41790;

export function generateWhiteboardPomXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.interview.tutor</groupId>
    <artifactId>interview-whiteboard</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <name>InterviewTutor Code Whiteboard</name>
    <description>Zero-Dependency Local IntelliJ IDEA Companion for Live Whiteboard</description>

    <properties>
        <maven.compiler.release>21</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <build>
        <plugins>
            <!-- Maven Compiler Plugin configured for Java 21 -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.13.0</version>
                <configuration>
                    <release>21</release>
                    <compilerArgs>
                        <arg>--enable-preview</arg>
                    </compilerArgs>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;
}

export function generateWhiteboardStarterJava(initialCode?: string): string {
  if (initialCode && initialCode.trim().length > 0) {
    return initialCode;
  }

  return `package com.interview.tutor;

/**
 * 🎨 Интерактивная доска кода (InterviewTutor Whiteboard)
 * 
 * Пишите здесь код, архитектурные наброски, интерфейсы или алгоритмы.
 * Нажимайте Ctrl + S для мгновенной синхронизации с веб-доской и ИИ-напарником.
 */
public class Whiteboard {

    public static void main(String[] args) {
        System.out.println("Интерактивная доска кода готова к работе!");
    }
}
`;
}

export function generateWhiteboardBridgeScript(): string {
  // Re-use BRIDGE_MJS_TEMPLATE re-targeted to port 41790 and Whiteboard channel
  return BRIDGE_MJS_TEMPLATE
    .replace('const PORT = 41789;', `const PORT = ${WHITEBOARD_BRIDGE_PORT};`)
    .replace(
      '🚀 InterviewTutor IntelliJ Companion Bridge (v1.0.0)',
      '🎨 InterviewTutor Whiteboard Companion Bridge (:41790)'
    );
}

export function buildWhiteboardZipPackage(initialCode?: string): Buffer {
  const entries: ZipEntry[] = [];

  // 1. pom.xml
  entries.push({
    path: 'pom.xml',
    content: generateWhiteboardPomXml()
  });

  // 2. .gitignore
  entries.push({
    path: '.gitignore',
    content: 'target/\n*.class\n.idea/\n*.iml\n.DS_Store\n*~\n*.swp\n'
  });

  // 3. README.md
  entries.push({
    path: 'README.md',
    content: `# 🎨 InterviewTutor Whiteboard Companion

Скетчпад для интерактивной доски кода в IntelliJ IDEA.

## Быстрый старт (3 шага)

1. **Откройте папку в IntelliJ IDEA**:
   - Меню: **File -> Open** -> выберите эту папку.
   - IDE откроет её как стандартный проект Java 21.

2. **Запустите мост синхронизации доски**:
   - **Linux / macOS / Git Bash**: \`./run-bridge.sh\` (или \`node bridge.mjs\`)
   - **Windows**: дважды кликните \`run-bridge.cmd\`
   *(Слушает порт ws://127.0.0.1:41790, не конфликтует с мостом задач на :41789)*.

3. **Редактируйте \`src/main/java/Whiteboard.java\`**:
   - При каждом сохранении (\`Ctrl+S\`) код мгновенно появляется на интерактивной доске платформы.
   - Спрашивайте ИИ голосом в любой момент: *"Взгляни на доску, что скажешь по поводу моего решения?"*
`
  });

  // 4. Bridge runner scripts
  entries.push({ path: 'bridge.mjs', content: generateWhiteboardBridgeScript() });
  entries.push({ path: 'wsServer.mjs', content: WS_SERVER_MJS_TEMPLATE });

  entries.push({
    path: 'run-bridge.sh',
    content: `#!/usr/bin/env bash
set -e
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js не найден. Установите Node.js 20+"; exit 1; }
exec node bridge.mjs
`
  });

  entries.push({
    path: 'run-bridge.cmd',
    content: `@echo off
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js не найден. Установите Node.js 20+
    pause
    exit /b 1
)
node bridge.mjs
pause
`
  });

  // 5. Source code
  entries.push({
    path: 'src/main/java/Whiteboard.java',
    content: generateWhiteboardStarterJava(initialCode)
  });

  return createZipArchive(entries);
}
