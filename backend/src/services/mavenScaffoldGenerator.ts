/**
 * mavenScaffoldGenerator.ts
 * Generates canonical Java 21 LTS Maven projects and packages full ZIP archives
 * for IntelliJ IDEA practice with JUnit 5 Jupiter, AssertJ, and Zero-Dependency Bridge.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CodingChallenge } from './challengeSeedData';
import { createZipArchive, ZipEntry } from './zipGenerator';

export function generatePomXml(challenge: CodingChallenge): string {
  const isSpring = challenge.category === 'spring_transactions' ||
    (challenge.targetStack && challenge.targetStack.toLowerCase().includes('spring'));

  const artifactId = (challenge.slug || challenge.id || 'practice-task')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');

  const safeTitle = (challenge.title || 'Practice Challenge')
    .replace(/[<>&"']/g, '');

  const springDependency = isSpring
    ? `
        <!-- Spring Boot Starter Test for Transaction and Context Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <version>3.3.4</version>
            <scope>test</scope>
        </dependency>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.interview.tutor</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <name>${safeTitle}</name>
    <description>InterviewTutor Practice Challenge: ${challenge.id}</description>

    <properties>
        <maven.compiler.release>21</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <junit.jupiter.version>5.11.0</junit.jupiter.version>
        <assertj.version>3.26.3</assertj.version>
        <mockito.version>5.14.0</mockito.version>
    </properties>

    <dependencies>
        <!-- JUnit 5 Jupiter Aggregator -->
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>\${junit.jupiter.version}</version>
            <scope>test</scope>
        </dependency>

        <!-- AssertJ Fluent Assertions -->
        <dependency>
            <groupId>org.assertj</groupId>
            <artifactId>assertj-core</artifactId>
            <version>\${assertj.version}</version>
            <scope>test</scope>
        </dependency>

        <!-- Mockito Jupiter Extension -->
        <dependency>
            <groupId>org.mockito</groupId>
            <artifactId>mockito-junit-jupiter</artifactId>
            <version>\${mockito.version}</version>
            <scope>test</scope>
        </dependency>${springDependency}
    </dependencies>

    <build>
        <plugins>
            <!-- Maven Compiler Plugin configured for Java 21 with Preview support -->
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

            <!-- Maven Surefire Plugin with Virtual Threads and Preview support -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.5.0</version>
                <configuration>
                    <argLine>--enable-preview</argLine>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;
}

function getBridgeFiles(): { bridgeScript: string; wsServerScript: string } {
  const possiblePaths = [
    path.resolve(process.cwd(), 'bridge'),
    path.resolve(__dirname, '../../../bridge'),
    path.resolve(__dirname, '../../bridge')
  ];

  for (const basePath of possiblePaths) {
    const bridgePath = path.join(basePath, 'bridge.mjs');
    const wsPath = path.join(basePath, 'wsServer.mjs');
    if (fs.existsSync(bridgePath) && fs.existsSync(wsPath)) {
      return {
        bridgeScript: fs.readFileSync(bridgePath, 'utf8'),
        wsServerScript: fs.readFileSync(wsPath, 'utf8')
      };
    }
  }

  return {
    bridgeScript: '// Fallback bridge script\nconsole.log("InterviewTutor bridge ready");',
    wsServerScript: '// Fallback wsServer\n'
  };
}

export function buildChallengeZipPackage(
  challenge: CodingChallenge,
  files: Array<{ path: string; content: string }>
): Buffer {
  const entries: ZipEntry[] = [];

  // 1. pom.xml
  entries.push({
    path: 'pom.xml',
    content: generatePomXml(challenge)
  });

  // 2. .gitignore
  entries.push({
    path: '.gitignore',
    content: 'target/\n*.class\n.idea/\n*.iml\n.DS_Store\n*~\n*.swp\n'
  });

  // 3. README.md
  entries.push({
    path: 'README.md',
    content: `# 🚀 ${challenge.title}

## Инструкция по решению в IntelliJ IDEA

1. **Откройте папку в IntelliJ IDEA**:
   - Меню: **File -> Open** -> выберите эту распакованную папку.
   - IDE откроет её как стандартный Maven-проект на Java 21.

2. **Запустите мост синхронизации**:
   - **Linux / macOS**: \`./run-bridge.sh\` (или \`node bridge.mjs\`)
   - **Windows**: дважды кликните \`run-bridge.cmd\`
   *(Установка npm-пакетов не требуется, работает на встроенном Node.js)*.

3. **Решайте задачу**:
   - Нажимайте \`Ctrl+S\` при редактировании — код синхронизируется с ИИ-напарником за <50 мс.
   - Запускайте локальные тесты кликом по зелёной стрелке возле \`@Test\` в IntelliJ.
   - Официальную проверку запускайте по кнопке «Проверить» в веб-интерфейсе платформы.
`
  });

  // 4. Bridge runner scripts
  const { bridgeScript, wsServerScript } = getBridgeFiles();
  entries.push({ path: 'bridge.mjs', content: bridgeScript });
  entries.push({ path: 'wsServer.mjs', content: wsServerScript });

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

  // 5. Source files
  for (const file of files) {
    let targetPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!targetPath.startsWith('src/')) {
      targetPath = targetPath.endsWith('Test.java')
        ? `src/test/java/${targetPath}`
        : `src/main/java/${targetPath}`;
    }
    entries.push({
      path: targetPath,
      content: file.content
    });
  }

  return createZipArchive(entries);
}
