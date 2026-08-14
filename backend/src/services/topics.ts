export interface TopicDefinition {
  id: string; // friendly slug
  name: string; // exact DB topic name
  prefix: string;
  category: string;
  icon: string;
  color: string;
  description: string;
}

export const TOPIC_DEFINITIONS: TopicDefinition[] = [
  {
    id: 'core',
    name: 'Java Core',
    prefix: 'CORE',
    category: 'Core Java & JVM',
    icon: 'coffee',
    color: '#E08E89',
    description: 'Основы языка, синтаксис, типы данных, память, исключения и классы'
  },
  {
    id: 'oop',
    name: 'ООП (OOP)',
    prefix: 'OOP',
    category: 'Core Java & JVM',
    icon: 'boxes',
    color: '#6C5CE7',
    description: 'Принципы ООП, абстракция, инкапсуляция, наследование, полиморфизм'
  },
  {
    id: 'jvm',
    name: 'JVM & Память',
    prefix: 'JVM',
    category: 'Core Java & JVM',
    icon: 'cpu',
    color: '#A29BFE',
    description: 'Архитектура JVM, загрузчики классов, стек, куча, сборка мусора'
  },
  {
    id: 'jcf',
    name: 'Java Collections Framework',
    prefix: 'JCF',
    category: 'Core Java & JVM',
    icon: 'layers',
    color: '#00CEC9',
    description: 'List, Set, Map, Queue, внутреннее устройство HashMap, TreeMap и Concurrent коллекций'
  },
  {
    id: 'java8',
    name: 'Java 8+ Features',
    prefix: 'JAVA8',
    category: 'Core Java & JVM',
    icon: 'sparkles',
    color: '#FD79A8',
    description: 'Лямбда-выражения, Stream API, Optional, функциональные интерфейсы, default методы'
  },
  {
    id: 'concurrency',
    name: 'Многопоточность (Concurrency)',
    prefix: 'CONC',
    category: 'Architecture & Concurrency',
    icon: 'zap',
    color: '#FF7675',
    description: 'Threads, volatile, synchronized, JMM, java.util.concurrent, блокировки и пулы потоков'
  },
  {
    id: 'io',
    name: 'I/O & NIO',
    prefix: 'IO',
    category: 'Architecture & Concurrency',
    icon: 'arrow-left-right',
    color: '#FDCB6E',
    description: 'Байтовые и символьные потоки, буферизация, неблокирующий ввод/вывод (NIO/NIO2)'
  },
  {
    id: 'serialization',
    name: 'Сериализация',
    prefix: 'SERIAL',
    category: 'Architecture & Concurrency',
    icon: 'archive',
    color: '#E17055',
    description: 'Serializable, Externalizable, serialVersionUID, transient поля и безопасность'
  },
  {
    id: 'patterns',
    name: 'Паттерны проектирования',
    prefix: 'PAT',
    category: 'Architecture & Concurrency',
    icon: 'git-fork',
    color: '#0984E3',
    description: 'Порождающие, структурные и поведенческие шаблоны проектирования (GoF)'
  },
  {
    id: 'db',
    name: 'Базы данных',
    prefix: 'DB',
    category: 'Data & Storage',
    icon: 'database',
    color: '#00B894',
    description: 'Реляционная модель, транзакции (ACID), уровни изоляции, нормализация и индексы'
  },
  {
    id: 'sql',
    name: 'SQL & Оконные функции',
    prefix: 'SQL',
    category: 'Data & Storage',
    icon: 'table',
    color: '#55EFC4',
    description: 'SELECT, JOIN, группировки, агрегаты, оконные функции RANK, DENSE_RANK, NTILE'
  },
  {
    id: 'jdbc',
    name: 'JDBC',
    prefix: 'JDBC',
    category: 'Data & Storage',
    icon: 'link',
    color: '#81ECEC',
    description: 'Драйверы, Connection, Statement, PreparedStatement, ResultSet, пулы соединений'
  },
  {
    id: 'spring',
    name: 'Spring Framework',
    prefix: 'SPRING',
    category: 'Web & Enterprise',
    icon: 'leaf',
    color: '#5A9E96',
    description: 'IoC/DI контейнер, бины, скоупы, AOP, @Transactional, Spring MVC, WebFlux'
  },
  {
    id: 'spring-boot',
    name: 'Spring Boot',
    prefix: 'BOOT',
    category: 'Web & Enterprise',
    icon: 'zap',
    color: '#6DB33F',
    description: 'Автоконфигурация, Starters, Actuator, Profiles, Spring Boot 3, GraalVM AOT'
  },
  {
    id: 'reactive',
    name: 'Реактивное программирование',
    prefix: 'REACT',
    category: 'Web & Enterprise',
    icon: 'activity',
    color: '#D63031',
    description: 'Reactive Streams, Mono, Flux, Backpressure, Project Reactor и RxJava'
  },
  {
    id: 'servlets',
    name: 'Servlets & JSP',
    prefix: 'SERV',
    category: 'Web & Enterprise',
    icon: 'server',
    color: '#74B9FF',
    description: 'Жизненный цикл сервлетов, фильтры, слушатели, HttpSession, JSP и Servlet API'
  },
  {
    id: 'web',
    name: 'Основы Web & REST',
    prefix: 'WEB',
    category: 'Web & Enterprise',
    icon: 'globe',
    color: '#0984E3',
    description: 'Протокол HTTP/HTTPS, методы, коды ответов, REST архитектура, Cookies и Сессии'
  },
  {
    id: 'kafka',
    name: 'Apache Kafka',
    prefix: 'KAFKA',
    category: 'Web & Enterprise',
    icon: 'radio',
    color: '#E84393',
    description: 'Брокеры, топики, партиции, Consumer Groups, гарантии доставки (at-least-once, exactly-once)'
  },
  {
    id: 'test',
    name: 'Тестирование (JUnit, Mockito)',
    prefix: 'TEST',
    category: 'Engineering & Tools',
    icon: 'check-circle-2',
    color: '#2ECC71',
    description: 'Модульное тестирование, TDD, аннотации JUnit 5, моки, стабы, Mockito и ассерты'
  },
  {
    id: 'log',
    name: 'Журналирование (Logging)',
    prefix: 'LOG',
    category: 'Engineering & Tools',
    icon: 'file-text',
    color: '#B2BEC3',
    description: 'Уровни логирования (DEBUG, INFO, WARN, ERROR), SLF4J фасад, Logback, Log4j2'
  },
  {
    id: 'xml',
    name: 'XML & JSON Парсеры',
    prefix: 'XML',
    category: 'Engineering & Tools',
    icon: 'code-2',
    color: '#636E72',
    description: 'DOM, SAX, StAX парсеры, валидация DTD/XSD, маршалинг JAXB и работа с JSON'
  },
  {
    id: 'uml',
    name: 'UML Диаграммы',
    prefix: 'UML',
    category: 'Engineering & Tools',
    icon: 'network',
    color: '#2D3436',
    description: 'Диаграммы классов, последовательности (Sequence), состояний и отношений в ООП'
  },
  {
    id: 'html',
    name: 'Основы HTML',
    prefix: 'HTML',
    category: 'Frontend Basics',
    icon: 'file-code',
    color: '#E67E22',
    description: 'Структура документа, теги, семантический HTML5, формы, ссылки и таблицы'
  },
  {
    id: 'css',
    name: 'Основы CSS',
    prefix: 'CSS',
    category: 'Frontend Basics',
    icon: 'palette',
    color: '#3498DB',
    description: 'Селекторы, блочная модель (Box Model), Flexbox, Grid, каскадность и специфичность'
  }
];

export const TOPIC_MAP: Record<string, string> = Object.fromEntries(
  TOPIC_DEFINITIONS.map(t => [t.id, t.name])
);
