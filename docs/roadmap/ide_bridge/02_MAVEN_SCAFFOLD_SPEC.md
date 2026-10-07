# Спецификация генерации Maven-проекта и упаковки ZIP

> **Документ**: `02_MAVEN_SCAFFOLD_SPEC.md`  
> **Статус**: Архитектурный стандарт генерации Java 21 проектов  
> **Назначение**: Формирование структуры каталогов, `pom.xml`, тестовых зависимостей и ZIP-архива для IntelliJ IDEA.

---

## 1. Каноническая файловая структура проекта

Когда пользователь скачивает ZIP-архив задачи, он получает полноценную структуру Maven-проекта:

```
challenge-[slug]/
├── pom.xml
├── .gitignore
├── README.md
├── bridge.mjs
├── run-bridge.sh
├── run-bridge.cmd
└── src/
    ├── main/
    │   └── java/
    │       └── com/assessment/...
    └── test/
        └── java/
            └── com/assessment/...
```

---

## 2. Канонический шаблон `pom.xml` (Java 21 LTS)

Шаблон генерируется детерминированно в зависимости от стека задачи (`targetStack`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.interview.tutor</groupId>
    <artifactId>{{artifactId}}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <name>{{challengeTitle}}</name>
    <description>InterviewTutor Practice Challenge: {{challengeId}}</description>

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
            <version>${junit.jupiter.version}</version>
            <scope>test</scope>
        </dependency>

        <!-- AssertJ Fluent Assertions -->
        <dependency>
            <groupId>org.assertj</groupId>
            <artifactId>assertj-core</artifactId>
            <version>${assertj.version}</version>
            <scope>test</scope>
        </dependency>

        <!-- Mockito Jupiter Extension -->
        <dependency>
            <groupId>org.mockito</groupId>
            <artifactId>mockito-junit-jupiter</artifactId>
            <version>${mockito.version}</version>
            <scope>test</scope>
        </dependency>
        
        {{#if isSpringChallenge}}
        <!-- Spring Boot Test Starter (for Spring Transaction Lab) -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <version>3.3.4</version>
            <scope>test</scope>
        </dependency>
        {{/if}}
    </dependencies>

    <build>
        <plugins>
            <!-- Maven Compiler Plugin with Java 21 -->
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

            <!-- Maven Surefire Plugin with Virtual Threads / Preview -->
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
```

---

## 3. Маппинг файлов рабочей области

1. Исходные файлы задачи хранятся в свойстве `workspaceFiles` массива `CodingChallenge`:
   - Если путь начинается с `src/main/java/` или `src/test/java/`, он сохраняется в архиве «как есть».
   - Если файл находится в корне или плоском пакете, он автоматически классифицируется:
     - Файлы с `*Test.java` помещаются в `src/test/java/`.
     - Все остальные `.java` помещаются в `src/main/java/`.
2. **Read-Only файлы**:
   - Файлы контрактов (интерфейсы `RateLimiter.java`, базовые модели) маркируются комментарием в шапке:
     ```java
     // [INTERVIEW_TUTOR_READ_ONLY] Данный файл является неизменяемым контрактом задачи.
     ```
   - Мост отслеживает попытки изменения read-only файлов и выводит предупреждение в консоли, предотвращая рассинхронизацию с серверным контрактом.

---

## 4. Содержимое `.gitignore` в архиве

Для чистоты репозитория и предотвращения передачи мусора в мост создаётся `.gitignore`:

```gitignore
target/
*.class
.idea/
*.iml
.DS_Store
*~
*.swp
```

---

## 5. Скрипты быстрого запуска

### `run-bridge.sh` (Linux / macOS):
```bash
#!/usr/bin/env bash
set -e
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js не найден. Установите Node.js 20+"; exit 1; }
exec node bridge.mjs
```

### `run-bridge.cmd` (Windows):
```cmd
@echo off
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js не найден. Установите Node.js 20+ с https://nodejs.org
    pause
    exit /b 1
)
node bridge.mjs
pause
```

---

## 6. Алгоритм сборки архива на бэкенде (`/export-zip`)

1. Бэкенд получает `challengeId` и проверяет наличие актуального черновика (`coding_submissions.files_json`).
2. Если черновик найден — берутся файлы из черновика. Если нет — базовые `workspaceFiles` шаблона.
3. В памяти формируется ZIP-архив с использованием легковесной потоковой библиотеки (или нативного `archiver` / `adm-zip`):
   - Добавляется сгенерированный `pom.xml`.
   - Добавляются `.java` файлы с сохранением иерархии папок.
   - Добавляется скрипт `bridge.mjs`.
   - Добавляются файлы `run-bridge.sh`, `run-bridge.cmd`, `README.md`.
4. Клиенту отправляется HTTP-ответ с заголовками:
   - `Content-Type: application/zip`
   - `Content-Disposition: attachment; filename="challenge-[slug].zip"`
5. Память освобождается сразу после стриминга (O(1) memory overhead).
