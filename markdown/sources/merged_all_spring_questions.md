# Merged Spring & Spring Boot Questions (Baeldung + InterviewBit Raw)

> **Source URL:** [Multiple Sources](Multiple Sources) | **Total Questions:** 122

---
## Table of Contents

- [1. What Is Spring Framework?](#q-1)
- [2. What Are the Benefits of Using Spring?](#q-2)
- [3. What Spring Sub-Projects Do You Know? Describe Them Briefly.](#q-3)
- [4. What Is Dependency Injection?](#q-4)
- [5. How Can We Inject Beans in Spring?](#q-5)
- [6. Which Is the Best Way of Injecting Beans and Why?](#q-6)
- [7. What Is the Difference Between BeanFactory and ApplicationContext?](#q-7)
- [8. What Is a Spring Bean?](#q-8)
- [9. What Is the Default Bean Scope in Spring Framework?](#q-9)
- [10. How to Define the Scope of a Bean?](#q-10)
- [11. Are Singleton Beans Thread-Safe?](#q-11)
- [12. What Does the Spring Bean Life Cycle Look Like?](#q-12)
- [13. What Is the Spring Java-Based Configuration?](#q-13)
- [14. Can We Have Multiple Spring Configuration Files in One Project?](#q-14)
- [15. What Is Spring Security?](#q-15)
- [16. What Is Spring Boot?](#q-16)
- [17. Name Some of the Design Patterns Used in the Spring Framework?](#q-17)
- [18. How Does the Scope Prototype Work?](#q-18)
- [19. How to GetServletContextandServletConfigObjects in a Spring Bean?](#q-19)
- [20. What Is a Controller in Spring MVC?](#q-20)
- [21. How Does the@RequestMappingAnnotation Work?](#q-21)
- [22. What Is SpringJdbcTemplateClass and How to Use It?](#q-22)
- [23. How to Enable Transactions in Spring and What Are Their Benefits?](#q-23)
- [24. What Is Spring DAO?](#q-24)
- [25. What Is Aspect-Oriented Programming (AOP)?](#q-25)
- [26. What Are Aspect, Advice, Pointcut and JoinPoint in AOP?](#q-26)
- [27. What Is Weaving?](#q-27)
- [28. What Is Reactive Programming?](#q-28)
- [29. What Is Spring WebFlux?](#q-29)
- [30. What Are the Mono and Flux Types?](#q-30)
- [31. What Is the Use ofWebClientandWebTestClient?](#q-31)
- [32. What Are the Disadvantages of Using Reactive Streams?](#q-32)
- [33. Is Spring 5 Compatible With Older Versions of Java?](#q-33)
- [34. How Does Spring 5 Integrate With JDK 9 Modularity?](#q-34)
- [35. Can We Use Both Web MVC and WebFlux in the Same Application?](#q-35)
- [36. What Is Spring Boot and What Are Its Main Features?](#q-36)
- [37. What Are the Differences Between Spring and Spring Boot?](#q-37)
- [38. How Can We Set Up a Spring Boot Application With Maven?](#q-38)
- [39. What Is Spring Initializr?](#q-39)
- [40. What Spring Boot Starters Are Available Out There?](#q-40)
- [41. How to Disable a Specific Auto-Configuration?](#q-41)
- [42. How to Register a Custom Auto-Configuration?](#q-42)
- [43. How to Tell an Auto-Configuration to Back Away When a Bean Exists?](#q-43)
- [44. How to Deploy Spring Boot Web Applications as Jar and War Files?](#q-44)
- [45. How to Use Spring Boot for Command-Line Applications?](#q-45)
- [46. What Are Possible Sources of External Configuration?](#q-46)
- [47. What Does It Mean That Spring Boot Supports Relaxed Binding?](#q-47)
- [48. What IsSpring Boot DevTools Used For?](#q-48)
- [49. How to Write Integration Tests?](#q-49)
- [50. What Is Spring Boot Actuator Used For?](#q-50)
- [51. Which Is Better to Configure a Spring Boot Project — Properties or YAML?](#q-51)
- [52. What Basic Annotations Does Spring Boot Offer?](#q-52)
- [53. How to Change the Default Port in Spring Boot?](#q-53)
- [54. Which Embedded Servers Does Spring Boot Support, and How to Change the Default?](#q-54)
- [55. Why Do We Need Spring Profiles?](#q-55)
- [56. What are the bean scopes available in Spring?](#q-56)
- [57. What are the limitations of autowiring?](#q-57)
- [58. What is autowiring and name the different modes of it?](#q-58)
- [59. What do you understand by Bean Wiring.](#q-59)
- [60. Explain Bean life cycle in Spring Bean Factory Container.](#q-60)
- [61. How is the configuration meta data provided to the spring container?](#q-61)
- [62. What are Spring Beans?](#q-62)
- [63. Explain the difference between constructor and setter injection?](#q-63)
- [64. What do you understand by Dependency Injection?](#q-64)
- [65. What do you mean by IoC (Inversion of Control) Container?](#q-65)
- [66. What is a Spring configuration file?](#q-66)
- [67. What are the features of Spring Framework?](#q-67)
- [68. What is Spring Framework?](#q-68)
- [69. What are the features of Spring Boot?](#q-69)
- [70. Differentiate between Spring and Spring Boot.](#q-70)
- [71. Explain the advantages of using Spring Boot for application development.](#q-71)
- [72. What do you understand by the term ‘Spring Boot’?](#q-72)
- [73. What does @SpringBootApplication annotation do internally?](#q-73)
- [74. What are the uses of @RequestMapping and @RestController annotations in Spring Boot?](#q-74)
- [75. Can the default web server in the Spring Boot application be disabled?](#q-75)
- [76. How to disable specific auto-configuration class?](#q-76)
- [77. Can you tell how to exclude any package without using the basePackages filter?](#q-77)
- [78. Can we change the default port of the embedded Tomcat server in Spring boot?](#q-78)
- [79. What are the possible sources of external configuration?](#q-79)
- [80. What is Spring Boot dependency management system?](#q-80)
- [81. What are the effects of running Spring Boot Application as “Java Application”?](#q-81)
- [82. What is Spring AOP?](#q-82)
- [83. What is HibernateTemplate class?](#q-83)
- [84. What is Hibernate Validator Framework?](#q-84)
- [85. What are the two ways of accessing Hibernate by using Spring.](#q-85)
- [86. What is Hibernate ORM Framework?](#q-86)
- [87. How can you fetch records by Spring JdbcTemplate?](#q-87)
- [88. What are some of the classes for Spring JDBC API?](#q-88)
- [89. What is Spring AOP Proxy pattern?](#q-89)
- [90. How can you achieve thread-safety in beans?](#q-90)
- [91. Is there any need to keepspring-mvc.jar on the classpath or is it already present as part of spring-core?](#q-91)
- [92. What are Spring Interceptors?](#q-92)
- [93. Why do we need BindingResults?](#q-93)
- [94. Where does the access to the model from the view come from?](#q-94)
- [95. How does the Spring MVC flow look like? In other words, How does a DispatcherServlet know what Controller needs to be called when there is an incoming request to the Spring MVC?](#q-95)
- [96. How is the root application context in Spring MVC loaded?](#q-96)
- [97. How is the dispatcher servlet instantiated?](#q-97)
- [98. What is the significance of @Repository annotation?](#q-98)
- [99. What are the differences between the <context:annotation-config> vs <context:component-scan> tags?](#q-99)
- [100. Are singleton beans thread-safe?](#q-100)
- [101. What is the importance of @Required annotation?](#q-101)
- [102. What is the importance of session scope?](#q-102)
- [103. What are the types of Spring MVC Dependency Injection?](#q-103)
- [104. What is the importance of the web.xml in Spring MVC?](#q-104)
- [105. What is the role of @ModelAttribute annotation?](#q-105)
- [106. What is the use of @Autowired annotation?](#q-106)
- [107. What is the Model in Spring MVC?](#q-107)
- [108. What will be the selection state of a checkbox input if the user first checks the checkbox and gets validation errors in other fields and then unchecks the checkbox after getting the errors?](#q-108)
- [109. How is it possible to use the Tomcat JNDI DataSource in the Spring applications?](#q-109)
- [110. What do you understand by MultipartResolver?](#q-110)
- [111. How are i18n and localization supported in Spring MVC?](#q-111)
- [112. Differentiate between a Bean Factory and an Application Context.](#q-112)
- [113. How to get ServletConfig and ServletContext objects in spring bean?](#q-113)
- [114. How is the form data validation done in Spring Web MVC Framework?](#q-114)
- [115. What are the differences between @RequestParam and @PathVariable annotations?](#q-115)
- [116. What is ContextLoaderListener and what does it do?](#q-116)
- [117. Can you create a controller without using @Controller or @RestController annotations?](#q-117)
- [118. What is the @Controller annotation used for?](#q-118)
- [119. What is a View Resolver pattern and explain its significance in Spring MVC?](#q-119)
- [120. What is DispatcherServlet in Spring MVC? In other words, can you explain the Spring MVC architecture?](#q-120)
- [121. What are the benefits of Spring MVC framework over other MVC frameworks?](#q-121)
- [122. What is the Spring MVC framework?](#q-122)

---

### <a id="q-1"></a>1. What Is Spring Framework?

Spring is the most broadly used framework for the development of Java Enterprise Edition applications. Further, the core features of Spring can be used in developing any Java application.

We use its extensions for building various web applications on top of the Jakarta EE platform. We can also just use its dependency injection provisions in simple standalone applications.

---

### <a id="q-2"></a>2. What Are the Benefits of Using Spring?

Spring targets to make Jakarta EE development easier, so let’s look at the advantages:

* **Lightweight**  – There is a slight overhead of using the framework in development.
* **Inversion of Control (IoC)** – Spring container takes care of wiring dependencies of various objects instead of creating or looking for dependent objects.
* **Aspect-Oriented Programming (AOP)**  – Spring supports AOP to separate business logic from system services.
* **IoC container**  – manages Spring Bean life cycle and project-specific configurations
* **MVC framework**  – used to create web applications or RESTful web services, capable of returning XML/JSON responses
* **Transaction management**  – reduces the amount of boilerplate code in JDBC operations, file uploading, etc., either by using Java annotations or by Spring Bean XML configuration file
* **Exception Handling** – Spring provides a convenient API for translating technology-specific exceptions into unchecked exceptions.

---

### <a id="q-3"></a>3. What Spring Sub-Projects Do You Know? Describe Them Briefly.

* **Core**  – a key module that provides fundamental parts of the framework, such as IoC or DI
* **JDBC**  – enables a JDBC-abstraction layer that removes the need to do JDBC coding for specific vendor databases
* **ORM integration**  – provides integration layers for popular object-relational mapping APIs, such as JPA, JDO and Hibernate
* **Web**  – a web-oriented integration module that provides multipart file upload, Servlet listeners and web-oriented application context functionalities
* **MVC framework**  – a web module implementing the Model View Controller design pattern
* **AOP module**  – aspect-oriented programming implementation allowing the definition of clean method-interceptors and pointcuts

---

### <a id="q-4"></a>4. What Is Dependency Injection?

Dependency injection, an aspect of Inversion of Control (IoC), is a general concept stating that we do not create our objects manually but instead describe how they should be created. Then an IoC container will instantiate required classes if needed.

For more details, please look here.

---

### <a id="q-5"></a>5. How Can We Inject Beans in Spring?

A few different options exist in order to inject Spring beans:

* Setter injection
* Constructor injection
* Field injection

The configuration can be done using XML files or annotations.

For more details, check this article.

---

### <a id="q-6"></a>6. Which Is the Best Way of Injecting Beans and Why?

The recommended approach is to use constructor arguments for mandatory dependencies and setters for optional ones. This is because constructor injection allows injecting values to immutable fields and makes testing easier.

---

### <a id="q-7"></a>7. What Is the Difference Between BeanFactory and ApplicationContext?

*BeanFactory*  is an interface representing a container that provides and manages bean instances. The default implementation instantiates beans lazily when *getBean()*  is called.

In contrast, *ApplicationContext* is an interface representing a container holding all information, metadata and beans in the application. It also extends the *BeanFactory*  interface, but the default implementation instantiates beans eagerly when the application starts. However, this behavior can be overridden for individual beans.

For all differences, please refer to the documentation.

---

### <a id="q-8"></a>8. What Is a Spring Bean?

The Spring Beans are Java Objects that are initialized by the Spring IoC container.

---

### <a id="q-9"></a>9. What Is the Default Bean Scope in Spring Framework?

By default, a Spring Bean is initialized as a *singleton* .

---

### <a id="q-10"></a>10. How to Define the Scope of a Bean?

In order to set Spring Bean’s scope, we can use *@Scope*  annotation or “scope” attribute in XML configuration files. Note that there are five supported scopes:

* **Singleton**
* **Prototype**
* **Request**
* **Session**
* **Global-session**

For differences, please look here.

---

### <a id="q-11"></a>11. Are Singleton Beans Thread-Safe?

No, singleton beans are not thread-safe, as thread safety is about execution, whereas the singleton is a design pattern focusing on creation. Thread safety depends only on the bean implementation itself.

---

### <a id="q-12"></a>12. What Does the Spring Bean Life Cycle Look Like?

First, a Spring bean needs to be instantiated based on Java or XML bean definition. It may also be required to perform some initialization to get it into a usable state. After that, when the bean is no longer required, it will be removed from the IoC container.

The whole cycle with all initialization methods is shown in the image (source):

---

### <a id="q-13"></a>13. What Is the Spring Java-Based Configuration?

It’s one of the ways of configuring Spring-based applications in a type-safe manner. It’s an alternative to the XML-based configuration.

Also, to migrate a project from XML to Java config, please refer to this article.

---

### <a id="q-14"></a>14. Can We Have Multiple Spring Configuration Files in One Project?

Yes, in large projects, having multiple Spring configurations is recommended to increase maintainability and modularity.

We can load multiple Java-based configuration files:

```java
@Configuration
@Import({MainConfig.class, SchedulerConfig.class})
public class AppConfig {
```

---

### <a id="q-15"></a>15. What Is Spring Security?

Spring Security is a separate module of the Spring framework that focuses on providing authentication and authorization methods in Java applications. It also takes care of most of the common security vulnerabilities such as CSRF attacks.

To use Spring Security in web applications, we can get started with the simple annotation *@EnableWebSecurity* .

For more information, we have a whole series of articles related to security.

---

### <a id="q-16"></a>16. What Is Spring Boot?

Spring Boot is a project that provides a pre-configured set of frameworks to reduce boilerplate configuration. This way, we can have a Spring application up and running with the smallest amount of code.

---

### <a id="q-17"></a>17. Name Some of the Design Patterns Used in the Spring Framework?

* **Singleton Pattern**  – singleton-scoped beans
* **Factory Pattern**  – Bean Factory classes
* **Prototype Pattern**  – prototype-scoped beans
* **Adapter Pattern**  – Spring Web and Spring MVC
* **Proxy Pattern**  – Spring Aspect-Oriented Programming support
* **Template Method Pattern**  – *JdbcTemplate* , *HibernateTemplate* , etc.
* **Front Controller**  – Spring MVC *DispatcherServlet*
* **Data Access Object**  – Spring DAO support
* **Model View Controller** – Spring MVC

---

### <a id="q-18"></a>18. How Does the Scope Prototype Work?

Scope *prototype*  means that every time we call for an instance of the Bean, Spring will create a new instance and return it. This differs from the default *singleton*  scope, where a single object instance is instantiated once per Spring IoC container.

---

### <a id="q-19"></a>19. How to GetServletContextandServletConfigObjects in a Spring Bean?

We can do either by implementing Spring-aware interfaces. The complete list is available here.

We could also use *@Autowired*  annotation on those beans:

```java
@Autowired
ServletContext servletContext;

@Autowired
ServletConfig servletConfig;
```

---

### <a id="q-20"></a>20. What Is a Controller in Spring MVC?

Simply put, all the requests processed by the *DispatcherServlet*  are directed to classes annotated with *@Controller* . Each controller class maps one or more requests to methods that process and execute the requests with provided inputs.

To take a step back, we recommend having a look at the concept of the Front Controller in the typical Spring MVC architecture.

---

### <a id="q-21"></a>21. How Does the@RequestMappingAnnotation Work?

The *@RequestMapping* annotation is used to map web requests to Spring Controller methods. In addition to simple use cases, we can use it for mapping of HTTP headers, binding parts of the URI with *@PathVariable,*  and working with URI parameters and the *@RequestParam*  annotation.

More details on *@RequestMapping*  are available here.

**For more Spring MVC questions, please check out our article on Spring MVC interview questions** .

---

### <a id="q-22"></a>22. What Is SpringJdbcTemplateClass and How to Use It?

The Spring JDBC template is the primary API through which we can access database operations logic that we’re interested in:

* Creation and closing of connections
* Executing statements and stored procedure calls
* Iterating over the *ResultSet*  and returning results

In order to use it, we’ll need to define the simple configuration of *DataSource* :

```java
@Configuration
@ComponentScan("org.baeldung.jdbc")
public class SpringJdbcConfig {
    @Bean
    public DataSource mysqlDataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.jdbc.Driver");
        dataSource.setUrl("jdbc:mysql://localhost:3306/springjdbc");
        dataSource.setUsername("guest_user");
        dataSource.setPassword("guest_password");
 
        return dataSource;
    }
}
```

For further explanation, check out this quick article.

---

### <a id="q-23"></a>23. How to Enable Transactions in Spring and What Are Their Benefits?

There are two distinct ways to configure *Transactions*  — with annotations or by using Aspect-Oriented Programming (AOP) — each with their advantages.

Here are the benefits of using Spring Transactions, according to the official docs:

* Provide a consistent programming model across different transaction APIs such as JTA, JDBC, Hibernate, JPA and JDO
* Support declarative transaction management
* Provide a simpler API for programmatic transaction management than some complex transaction APIs such as JTA
* Integrate very well with Spring’s various data access abstractions

---

### <a id="q-24"></a>24. What Is Spring DAO?

Spring Data Access Object (DAO) is Spring’s support provided to work with data access technologies like JDBC, Hibernate and JPA in a consistent and easy way.

There is an entire series discussing persistence in Spring that provides a more in-depth look.

---

### <a id="q-25"></a>25. What Is Aspect-Oriented Programming (AOP)?

*Aspects*  enable the modularization of cross-cutting concerns such as transaction management that span multiple types and objects by adding extra behavior to already existing code without modifying affected classes.

Here is the example of aspect-based execution time logging.

---

### <a id="q-26"></a>26. What Are Aspect, Advice, Pointcut and JoinPoint in AOP?

* ***Aspect***  – a class that implements cross-cutting concerns, such as transaction management
* ***Advice***  – the methods that get executed when a specific *JoinPoint*  with matching *Pointcut*  is reached in the application
* ***Pointcut***  – a set of regular expressions that are matched with *JoinPoint*  to determine whether *Advice*  needs to be executed or not
* ***JoinPoint***  – a point during the execution of a program, such as the execution of a method or the handling of an exception

---

### <a id="q-27"></a>27. What Is Weaving?

According to the official docs, *weaving*  is a process that links aspects with other application types or objects to create an advised object. This can be done at compile time, load time, or runtime. Spring AOP, like other pure Java AOP frameworks, performs *weaving*  at runtime.

---

### <a id="q-28"></a>28. What Is Reactive Programming?

Reactive programming is about non-blocking, event-driven applications that scale with a small number of threads, with back pressure being a key ingredient that aims to ensure producers don’t overwhelm consumers.

These are the primary benefits of reactive programming:

* Increased utilization of computing resources on multicore and multi-CPU hardware
* Increased performance by reducing serialization

Reactive programming is generally event-driven, in contrast to reactive systems, which are message-driven. So, using reactive programming does not mean we’re building a reactive system, which is an architectural style.

However, reactive programming may be used as a means to implement reactive systems if we follow the Reactive Manifesto, which is quite vital to understand.

Based on this, reactive systems have four important characteristics:

* **Responsive**  – The system should respond in a timely manner.
* **Resilient**  – In case the system faces any failure, it should stay responsive.
* **Elastic**  – Reactive systems can react to changes and stay responsive under varying workload.
* **Message-driven**  – Reactive systems need to establish a boundary between components by relying on asynchronous message passing.

---

### <a id="q-29"></a>29. What Is Spring WebFlux?

Spring WebFlux is Spring’s reactive-stack web framework, and it’s an alternative to Spring MVC.

In order to achieve this reactive model and be highly scalable, the entire stack is non-blocking. Check out our tutorial on Spring 5 WebFlux for additional details.

---

### <a id="q-30"></a>30. What Are the Mono and Flux Types?

The WebFlux framework in Spring Framework 5 uses Reactor as its async foundation.

This project provides two core types: *Mono*  to represent a single async value and *Flux*  to represent a stream of async values. They both also implement the *Publisher*  interface defined in the Reactive Streams specification.

*Mono*  implements *Publisher*  and returns 0 or 1 elements:

```java
public abstract class Mono<T> implements Publisher<T> {...}
```

And*Flux*  implements *Publisher*  and returns *N*  elements:

```java
public abstract class Flux<T> implements Publisher<T> {...}
```

By definition, the two types represent streams, and so they’re both lazy. This means nothing is executed until we consume the stream using the *subscribe()*  method. Both types are also immutable, so calling any method will return a new instance of *Flux*  or *Mono* .

---

### <a id="q-31"></a>31. What Is the Use ofWebClientandWebTestClient?

*WebClient*  is a component in the new Web Reactive framework that can act as a reactive client for performing non-blocking HTTP requests. Since it’s reactive client, it can handle reactive streams with back pressure, and it can take full advantage of Java 8 lambdas. It can also handle both sync and async scenarios.

On the other hand, the *WebTestClient*  is a similar class that we can use in tests. Basically, it’s a thin shell around the *WebClient.*  It can connect to any server over an HTTP connection. It can also bind directly to WebFlux applications using mock request and response objects, without the need for an HTTP server.

---

### <a id="q-32"></a>32. What Are the Disadvantages of Using Reactive Streams?

There are some major disadvantages to using reactive streams:

* Troubleshooting a Reactive application is a bit difficult, so be sure to check out our tutorial on debugging reactive streams for some handy debugging tips.
* There is limited support for reactive data stores since traditional relational data stores have yet to embrace the reactive paradigm.
* There’s an extra learning curve when implementing.

---

### <a id="q-33"></a>33. Is Spring 5 Compatible With Older Versions of Java?

In order to take advantage of Java 8 features, the Spring codebase has been revamped. This means older versions of Java cannot be used. So, the framework requires a minimum of Java 8.

---

### <a id="q-34"></a>34. How Does Spring 5 Integrate With JDK 9 Modularity?

In Spring 5, everything has been modularized. This way, we won’t be forced to import jars that may not have the functionalities we’re looking for.

Please have a look at our guide to Java 9 modularity for an in-depth understanding of how this technology works.

Let’s see an example to understand the new module functionality in Java 9 and how to organize a Spring 5 project based on this concept.

We’ll first create a new class that contains a single method to return a *String*  “HelloWorld”. We’ll place this within a new Java project — *HelloWorldModule* :

```java
package com.hello;
public class HelloWorld {
    public String sayHello(){
        return "HelloWorld";
    }
}
```

Then we create a new module:

```java
module com.hello {
    export com.hello;
}
```

Now let’s create a new Java Project, *HelloWorldClient* , to consume the above module by defining a module:

```java
module com.hello.client {
    requires com.hello;
}
```

The above module will be available for testing now:

```java
public class HelloWorldClient {
    public static void main(String[] args){
        HelloWorld helloWorld = new HelloWorld();
        log.info(helloWorld.sayHello());
    }
}
```

---

### <a id="q-35"></a>35. Can We Use Both Web MVC and WebFlux in the Same Application?

As of now, Spring Boot will only allow either Spring MVC or Spring WebFlux, as Spring Boot tries to auto-configure the context depending on the dependencies that exist in its classpath.

Also, Spring MVC cannot run on Netty. Moreover, MVC is a blocking paradigm and WebFlux is a non-blocking style. So, we shouldn’t be mixing both together because they serve different purposes.

---

### <a id="q-36"></a>36. What Is Spring Boot and What Are Its Main Features?

Spring Boot is essentially a framework for rapid application development built on top of the Spring Framework. With its auto-configuration and embedded application server support, combined with the extensive documentation and community support it enjoys, Spring Boot is one of the most popular technologies in the Java ecosystem as of date.

Here are a few salient features:

* Starters – a set of dependency descriptors to include relevant dependencies at a go
* Auto-configuration – a way to automatically configure an application based on the dependencies present on the classpath
* Actuator – to get production-ready features such as monitoring
* Security – to provide authentication and authorization
* Logging – to record events at certain points during program execution

---

### <a id="q-37"></a>37. What Are the Differences Between Spring and Spring Boot?

The Spring Framework provides multiple features that make the development of web applications easier. These features include dependency injection, data binding, aspect-oriented programming, data access and many more.

Over the years, Spring has been growing more and more complex, and the amount of configuration such an application requires can be intimidating. This is where Spring Boot comes in handy — it makes configuring a Spring application a breeze.

Essentially, while Spring is unopinionated, **Spring Boot takes an opinionated view of the platform and libraries, letting us get started quickly.**

Here are two of the most important benefits Spring Boot brings in:

* Auto-configure applications based on the artifacts it finds on the classpath
* Provide non-functional features common to applications in production, such as security or health checks

Please check out our other tutorial for a detailed comparison between vanilla Spring and Spring Boot.

---

### <a id="q-38"></a>38. How Can We Set Up a Spring Boot Application With Maven?

We can include Spring Boot in a Maven project just like we would any other library. However, the best way is to inherit from the *spring-boot-starter-parent*  project and declare dependencies to Spring Boot starters. Doing this lets our project reuse the default settings of Spring Boot.

Inheriting the *spring-boot-starter-parent*  project is straightforward — we only need to specify a *parent*  element in *pom.xml* :

```java
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.3</version>
</parent>
```

We can find the latest version of *spring-boot-starter-parent*  on Maven Central.

**Using the starter parent project is convenient but not always feasible.**  For instance, if our company requires all projects to inherit from a standard POM, we can still benefit from Spring Boot’s dependency management using a custom parent.

---

### <a id="q-39"></a>39. What Is Spring Initializr?

Spring Initializr is a convenient way to create a Spring Boot project.

We can go to the Spring Initializr site, choose a dependency management tool (either Maven or Gradle), a language (Java, Kotlin or Groovy), a packaging scheme (Jar or War), version and dependencies, and download the project.

This **creates a skeleton project for us**  and saves setup time so that we can concentrate on adding business logic.

Even when we use our IDE’s (such as STS or Eclipse with STS plugin) new project wizard to create a Spring Boot project, it uses Spring Initializr under the hood.

---

### <a id="q-40"></a>40. What Spring Boot Starters Are Available Out There?

Each starter plays a role as a one-stop shop for all the Spring technologies we need. Other required dependencies are then transitively pulled in and managed in a consistent way.

All starters are under the *org.springframework.boot*  group and their names start with *spring-boot-starter-* . **This naming pattern makes it easy to find starters, especially when working with IDEs that support searching dependencies by name.**

At the time of this writing, there are more than 50 starters at our disposal. Here, we’ll list the most common:

* *spring-boot-starter* : core starter, including auto-configuration support, logging and YAML
* *spring-boot-starter-aop* : for aspect-oriented programming with Spring AOP and AspectJ
* *spring-boot-starter-data-jpa:*  for using Spring Data JPA with Hibernate
* *spring-boot-starter-security* : for using Spring Security
* *spring-boot-starter-test* : for testing Spring Boot applications
* *spring-boot-starter-web* : for building web, including RESTful, applications using Spring MVC

For a complete list of starters, please see this repository.

To find more information about Spring Boot starters, take a look at Intro to Spring Boot Starters.

---

### <a id="q-41"></a>41. How to Disable a Specific Auto-Configuration?

If we want to disable a specific auto-configuration, we can indicate it using the *exclude*  attribute of the *@EnableAutoConfiguration*  annotation.

For instance, this code snippet neutralizes *DataSourceAutoConfiguration* :

```java
// other annotations
@EnableAutoConfiguration(exclude = DataSourceAutoConfiguration.class)
public class MyConfiguration { }
```

If we enabled auto-configuration with the *@SpringBootApplication*  annotation — which has *@EnableAutoConfiguration*  as a meta-annotation — we could disable auto-configuration with an attribute of the same name:

```java
// other annotations
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
public class MyConfiguration { }
```

We can also disable an auto-configuration with the *spring.autoconfigure.exclude*  environment property. This setting in the *application.properties*  file does the same thing as before:

```java
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

---

### <a id="q-42"></a>42. How to Register a Custom Auto-Configuration?

To register an auto-configuration class, we must have its fully qualified name listed under the *EnableAutoConfiguration*  key in the *META-INF/spring.factories*  file:

```java
org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.baeldung.autoconfigure.CustomAutoConfiguration
```

If we build a project with Maven, that file should be placed in the *resources/META-INF*  directory, which will end up in the mentioned location during the *package*  phase.

---

### <a id="q-43"></a>43. How to Tell an Auto-Configuration to Back Away When a Bean Exists?

To instruct an auto-configuration class to back off when a bean already exists, we can use the *@ConditionalOnMissingBean*  annotation.

The most noticeable attributes of this annotation are:

* *value*  – the types of beans to be checked
* *name*  – the names of beans to be checked

When placed on a method adorned with *@Bean* , the target type defaults to the method’s return type:

```java
@Configuration
public class CustomConfiguration {
    @Bean
    @ConditionalOnMissingBean
    public CustomService service() { ... }
}
```

---

### <a id="q-44"></a>44. How to Deploy Spring Boot Web Applications as Jar and War Files?

Traditionally, we package a web application as a WAR file and then deploy it into an external server. Doing this allows us to arrange multiple applications on the same server. When CPU and memory were scarce, this was a great way to save resources.

But things have changed. Computer hardware is fairly cheap now, and the attention has turned to server configuration. A small mistake in configuring the server during deployment may lead to catastrophic consequences.

**Spring tackles this problem by providing a plugin, namely *spring-boot-maven-plugin* , to package a web application as an executable JAR.**

To include this plugin, just add a *plugin*  element to *pom.xml* :

```java
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
</plugin>
```

With this plugin in place, we’ll get a fat JAR after executing the *package*  phase. This JAR contains all the necessary dependencies, including an embedded server. So, we no longer need to worry about configuring an external server.

We can then run the application just like we would an ordinary executable JAR.

Notice that the *packaging*  element in the *pom.xml*  file must be set to *jar*  to build a JAR file:

```java
<packaging>jar</packaging>
```

If we don’t include this element, it also defaults to *jar* .

To build a WAR file, we change the *packaging*  element to *war* :

```java
<packaging>war</packaging>
```

and leave the container dependency off the packaged file:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-tomcat</artifactId>
    <scope>provided</scope>
</dependency>
```

After executing the Maven *package*  phase, we’ll have a deployable WAR file.

---

### <a id="q-45"></a>45. How to Use Spring Boot for Command-Line Applications?

Just like any other Java program, a Spring Boot command-line application must have a *main*  method.

This method serves as an entry point, which invokes the *SpringApplication#run* method to bootstrap the application:

```java
@SpringBootApplication
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class);
        // other statements
    }
}
```

The *SpringApplication*  class then fires up a Spring container and auto-configures beans.

Notice we must pass a configuration class to the *run*  method to work as the primary configuration source. By convention, this argument is the entry class itself.

After calling the *run*  method, we can execute other statements as in a regular program.

---

### <a id="q-46"></a>46. What Are Possible Sources of External Configuration?

Spring Boot provides support for external configuration, allowing us to run the same application in various environments. **We can use properties files, YAML files, environment variables, system properties, and command-line option arguments to specify configuration properties.**

We can then gain access to those properties using the *@Value*  annotation, a bound object via the *@ConfigurationProperties*  annotation, or the *Environment*  abstraction.

---

### <a id="q-47"></a>47. What Does It Mean That Spring Boot Supports Relaxed Binding?

Relaxed binding in Spring Boot is applicable to the type-safe binding of configuration properties.

With relaxed binding, **the key of a property doesn’t need to be an exact match of a property name.**  Such an environment property can be written in camelCase, kebab-case, snake_case, or in uppercase with words separated by underscores.

For example, if a property in a bean class with the *@ConfigurationProperties*  annotation is named *myProp* , it can be bound to any of these environment properties: *myProp* , *my-prop* , *my_prop* , or *MY_PROP* .

---

### <a id="q-48"></a>48. What IsSpring Boot DevTools Used For?

Spring Boot Developer Tools, or DevTools, is a set of tools that make the development process easier.

To include these development-time features, we just need to add a dependency to the *pom.xml*  file:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
</dependency>
```

The *spring-boot-devtools*  module is automatically disabled if the application runs in production. The repackaging of archives also excludes this module by default. So, it won’t bring any overhead to our final product.

By default, DevTools applies properties suitable to a development environment. These properties disable template caching, enable debug logging for the web group, and so on. As a result, we have this sensible development-time configuration without setting any properties.

**Applications using DevTools restart whenever a file on the classpath changes.**  This is a very helpful feature in development, as it gives quick feedback for modifications.

By default, static resources, including view templates, don’t set off a restart. Instead, a resource change triggers a browser refresh. Notice this can only happen if the LiveReload extension is installed in the browser to interact with the embedded LiveReload server that DevTools contains.

For further information on this topic, please see Overview of Spring Boot DevTools.

---

### <a id="q-49"></a>49. How to Write Integration Tests?

When running integration tests for a Spring application, we must have an *ApplicationContext* .

To make our life easier, Spring Boot provides a special annotation for testing — *@SpringBootTest* . This annotation creates an *ApplicationContext*  from configuration classes indicated by its *classes*  attribute.

**In case the *classes*  attribute isn’t set, Spring Boot searches for the primary configuration class.**  The search starts from the package containing the test until it finds a class annotated with *@SpringBootApplication*  or *@SpringBootConfiguration* .

For detailed instructions, check out our tutorial on testing in Spring Boot.

---

### <a id="q-50"></a>50. What Is Spring Boot Actuator Used For?

Essentially, Actuator brings Spring Boot applications to life by enabling production-ready features. **These features allow us to monitor and manage applications when they’re running in production.**

Integrating Spring Boot Actuator into a project is very simple. All we need to do is include the *spring-boot-starter-actuator*  starter in the *pom.xml*  file:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Spring Boot Actuator can expose operational information using either HTTP or JMX endpoints. But most applications go for HTTP, where the identity of an endpoint and the */actuator*  prefix form a URL path.

Here are some of the most common built-in endpoints Actuator provides:

* *env*  exposes environment properties
* *health*  shows application health information
* *httptrace*  displays HTTP trace information
* *info*  displays arbitrary application information
* *metrics*  shows metrics information
* *loggers*  shows and modifies the configuration of loggers in the application
* *mappings*  displays a list of all *@RequestMapping*  paths

Please refer to our Spring Boot Actuator tutorial for a detailed rundown.

---

### <a id="q-51"></a>51. Which Is Better to Configure a Spring Boot Project — Properties or YAML?

YAML offers many advantages over properties files:

* More clarity and better readability
* Perfect for hierarchical configuration data, which is also represented in a better, more readable format
* Support for maps, lists, and scalar types
* Can include several profiles in the same file (since Spring Boot 2.4.0, this is possible for properties files too)

However, writing it can be a little difficult and error-prone due to its indentation rules.

For details and working samples, please refer to our Spring YAML vs Properties tutorial.

---

### <a id="q-52"></a>52. What Basic Annotations Does Spring Boot Offer?

The primary annotations that Spring Boot offers reside in its *org.springframework.boot.autoconfigure*  and its sub-packages.

Here are a couple of basic ones:

* *@EnableAutoConfiguration*  – to make Spring Boot look for auto-configuration beans on its classpath and automatically apply them
* *@SpringBootApplication*  – to denote the main class of a Boot Application. This annotation combines*@Configuration* , *@EnableAutoConfiguration*  and *@ComponentScan*  annotations with their default attributes.

Spring Boot Annotations offers more insight into the subject.

---

### <a id="q-53"></a>53. How to Change the Default Port in Spring Boot?

We can change the default port of a server embedded in Spring Boot using one of these ways:

* Using a properties file – We can define this in an *application.properties*  (or *application.yml* ) file using the property *server.port* .
* Programmatically – In our main *@SpringBootApplication*  class, we can set the *server.port*  on the *SpringApplication*  instance.
* Using the command line – When running the application as a jar file, we can set the server.port as a java command argument:

```properties
java -jar -Dserver.port=8081 myspringproject.jar
```

---

### <a id="q-54"></a>54. Which Embedded Servers Does Spring Boot Support, and How to Change the Default?

As of date, **Spring MVC supports Tomcat, Jetty, and Undertow.**  Tomcat is the default application server supported by Spring Boot’s *web*  starter.

**Spring WebFlux supports Reactor Netty, Tomcat, Jetty, and Undertow**  with Reactor Netty as default.

In Spring MVC, to change the default, let’s say to Jetty, we need to exclude Tomcat and include Jetty in the dependencies:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jetty</artifactId>
</dependency>
```

Similarly, to change the default in WebFlux to UnderTow, we need to exclude Reactor Netty and include UnderTow in the dependencies.

Comparing Embedded Servlet Containers in Spring Boot has more details on the different embedded servers we can use with Spring MVC.

---

### <a id="q-55"></a>55. Why Do We Need Spring Profiles?

When developing applications for the enterprise, we typically deal with multiple environments such as Dev, QA, and Prod. The configuration properties for these environments are different.

For example, we might be using an embedded H2 database for Dev, but Prod could have the proprietary Oracle or DB2. Even if the DBMS is the same across environments, the URLs would definitely be different.

To make this easy and clean, **Spring has the provision of profiles to help separate the configuration for each environment.**  So, instead of maintaining this programmatically, the properties can be kept in separate files such as *application-dev.properties*  and *application-prod.* *properties* . The default *application.propertie* s points to the currently active profile using *spring.profiles.active*  so that the correct configuration is picked up.

Spring Profiles gives a comprehensive view of this topic.

---

### <a id="q-56"></a>56. What are the bean scopes available in Spring?

The Spring Framework has five scope supports. They are:
- 
Singleton: The scope of bean definition while using this would be a single instance per IoC container.
- 
Prototype: Here, the scope for a single bean definition can be any number of object instances.
- 
Request: The scope of the bean definition is an HTTP request.
- 
Session: Here, the scope of the bean definition is HTTP-session.
- 
Global-session: The scope of the bean definition here is a Global HTTP session.
Note: The last three scopes are available only if the users use web-aware ApplicationContext containers.
[Create My Plan](https://www.interviewbit.com/interview-preparation-kit/)

---

### <a id="q-57"></a>57. What are the limitations of autowiring?

- 
Overriding possibility: Dependencies are specified using <constructor-arg> and <property>  settings that override autowiring.
- 
Data types restriction: Primitive data types, Strings, and Classes can’t be autowired.

```
<constructor-arg>
```

```
<property>
```

---

### <a id="q-58"></a>58. What is autowiring and name the different modes of it?

The IoC container autowires relationships between the application beans. Spring lets collaborators resolve which bean has to be wired automatically by inspecting the contents of the BeanFactory.Different modes of this process are:
- 
no: This means no autowiring and is the default setting. An explicit bean reference should be used for wiring.
- 
byName: The bean dependency is injected according to the name of the bean. This matches and wires its properties with the beans defined by the same names as per the configuration.
- 
byType: This injects the bean dependency based on type.
- 
constructor: Here, it injects the bean dependency by calling the constructor of the class. It has a large number of parameters.
- 
autodetect: First the container tries to wire using autowire by the constructor, if it isn't possible then it tries to autowire by byType.

[here](https://www.interviewbit.com/spring-interview-questions)

---

### <a id="q-59"></a>59. What do you understand by Bean Wiring.

- When beans are combined together within the Spring container, they are said to be wired or the phenomenon is called bean wiring.
- The Spring container should know what beans are needed and how the beans are dependent on each other while wiring beans. This is given by means of XML / Annotations / Java code-based configuration.

---

### <a id="q-60"></a>60. Explain Bean life cycle in Spring Bean Factory Container.

The Bean life cycle is as follows:
- The IoC container instantiates the bean from the bean’s definition in the XML file.
- Spring then populates all of the properties using the dependency injection as specified in the bean definition.
- The bean factory container calls setBeanName() which take the bean ID and the corresponding bean has to implement BeanNameAware interface.
- The factory then calls setBeanFactory() by passing an instance of itself (if BeanFactoryAware interface is implemented in the bean).
- If BeanPostProcessors is associated with a bean, then the preProcessBeforeInitialization() methods are invoked.
- If an init-method is specified, then it will be called.
- Lastly, postProcessAfterInitialization() methods will be called if there are any BeanPostProcessors associated with the bean that needs to be run post creation.

```
setBeanName()
```

```
BeanNameAware
```

```
setBeanFactory()
```

```
BeanPostProcessors
```

```
preProcessBeforeInitialization()
```

```
postProcessAfterInitialization()
```

- 
        [Software Dev](https://www.interviewbit.com/spring-interview-questions#sde_events)

- 
        [Data Science](https://www.interviewbit.com/spring-interview-questions#dsml_events)

- 
        [All Events](https://www.interviewbit.com/spring-interview-questions#all_events)

- 
        [My Events](https://www.interviewbit.com/spring-interview-questions#my_events)

[Software Dev](https://www.interviewbit.com/spring-interview-questions#sde_events)
[Data Science](https://www.interviewbit.com/spring-interview-questions#dsml_events)
[All Events](https://www.interviewbit.com/spring-interview-questions#all_events)
[My Events](https://www.interviewbit.com/spring-interview-questions#my_events)
[View All](https://www.interviewbit.com/events)
[View All](https://www.interviewbit.com/events)
[View All](https://www.interviewbit.com/events)
[View All](https://www.interviewbit.com/events)
[Register Now](https://www.interviewbit.com/spring-interview-questions)

---

### <a id="q-61"></a>61. How is the configuration meta data provided to the spring container?

There are 3 ways of providing the configuration metadata. They are as follows:
- 
XML-Based configuration: The bean configurations and their dependencies are specified in XML configuration files. This starts with a bean tag as shown below:

```
<bean id="interviewBitBean" class="org.intervuewBit.firstSpring.InterviewBitBean"> <property name="name" value="InterviewBit"></property> </bean>
```

```
<bean id="interviewBitBean" class="org.intervuewBit.firstSpring.InterviewBitBean"> <property name="name" value="InterviewBit"></property> </bean>
```

- 
Annotation-Based configuration: Instead of the XML approach, the beans can be configured into the component class itself by using annotations on the relevant class, method, or field declaration.Annotation wiring is not active in the Spring container by default. This has to be enabled in the Spring XML configuration file as shown below

- Annotation wiring is not active in the Spring container by default. This has to be enabled in the Spring XML configuration file as shown below
- Annotation wiring is not active in the Spring container by default. This has to be enabled in the Spring XML configuration file as shown below

```
<beans> <context:annotation-config/> <!-- bean definitions go here --> </beans>
```

```
<beans> <context:annotation-config/> <!-- bean definitions go here --> </beans>
```

- 
Java-based configuration: Spring Framework introduced key features as part of new Java configuration support. This makes use of the @Configuration annotated classes and @Bean annotated methods. Note that:
@Bean annotation has the same role as the <bean/> element.
Classes annotated with @Configuration allow to define inter-bean dependencies by simply calling other @Bean methods in the same class.

- @Bean annotation has the same role as the <bean/> element.
- Classes annotated with @Configuration allow to define inter-bean dependencies by simply calling other @Bean methods in the same class.
- @Bean annotation has the same role as the <bean/> element.
- Classes annotated with @Configuration allow to define inter-bean dependencies by simply calling other @Bean methods in the same class.

---

### <a id="q-62"></a>62. What are Spring Beans?

- They are the objects forming the backbone of the user’s application and are managed by the Spring IoC container.
- Spring beans are instantiated, configured, wired, and managed by IoC container.
- Beans are created with the configuration metadata that the users supply to the container (by means of XML or java annotations configurations.)
[View Tracks](https://www.interviewbit.com/practice/)

---

### <a id="q-63"></a>63. Explain the difference between constructor and setter injection?

- In constructor injection, partial injection is not allowed whereas it is allowed in setter injection.
- The constructor injection doesn’t override the setter property whereas the same is not true for setter injection.
- Constructor injection creates a new instance if any modification is done. The creation of a new instance is not possible in setter injection.
- In case the bean has many properties, then constructor injection is preferred. If it has few properties, then setter injection is preferred.

---

### <a id="q-64"></a>64. What do you understand by Dependency Injection?

The main idea in Dependency Injection is that you don’t have to create your objects but you just have to describe how they should be created.
- The components and services need not be connected by us in the code directly. We have to describe which services are needed by which components in the configuration file. The IoC container present in Spring will wire them up together.
- In Java, the 2 major ways of achieving dependency injection are:
Constructor injection: Here, the IoC container invokes the class constructor with a number of arguments where each argument represents a dependency on the other class.
Setter injection: Here, the spring container calls the setter methods on the beans after invoking a no-argument static factory method or default constructor to instantiate the bean.

- Constructor injection: Here, the IoC container invokes the class constructor with a number of arguments where each argument represents a dependency on the other class.
- Setter injection: Here, the spring container calls the setter methods on the beans after invoking a no-argument static factory method or default constructor to instantiate the bean.
- Constructor injection: Here, the IoC container invokes the class constructor with a number of arguments where each argument represents a dependency on the other class.
- Setter injection: Here, the spring container calls the setter methods on the beans after invoking a no-argument static factory method or default constructor to instantiate the bean.

---

### <a id="q-65"></a>65. What do you mean by IoC (Inversion of Control) Container?

Spring container forms the core of the Spring Framework. The Spring container uses Dependency Injection (DI) for managing the application components by creating objects, wiring them together along with configuring and managing their overall life cycles. The instructions for the spring container to do the tasks can be provided either by XML configuration, Java annotations, or Java code.

---

### <a id="q-66"></a>66. What is a Spring configuration file?

A Spring configuration file is basically an XML file that mainly contains the classes information and describes how those classes are configured and linked to each other. The XML configuration files are verbose and cleaner.

---

### <a id="q-67"></a>67. What are the features of Spring Framework?

- Spring framework follows layered architecture pattern that helps in the necessary components selection along with providing a robust and cohesive framework for J2EE applications development.
- The AOP (Aspect Oriented Programming) part of Spring supports unified development by ensuring separation of application’s business logic from other system services.
- Spring provides highly configurable MVC web application framework which has the ability to switch to other frameworks easily.
- Provides provision of creation and management of the configurations and defining the lifecycle of application objects.
- Spring has a special design principle which is known as IoC (Inversion of Control) that supports objects to give their dependencies rather than looking for creating dependent objects.
- Spring is a lightweight, java based, loosely coupled framework.
- Spring provides generic abstraction layer for transaction management that is also very useful for container-less environments.
- Spring provides a convenient API to translate technology-specific exceptions (thrown by JDBC, Hibernate or other frameworks) into consistent, unchecked exceptions. This introduces abstraction and greatly simplifies exception handling.

---

### <a id="q-68"></a>68. What is Spring Framework?

- Spring is a powerful open-source, loosely coupled, lightweight, [java framework](https://www.interviewbit.com/java-interview-questions/) meant for reducing the complexity of developing enterprise-level applications. This framework is also called the “framework of frameworks” as spring provides support to various other important frameworks like JSF, Hibernate, Structs, EJB, etc.
- There are around 20 modules which are generalized into the following types:
Core Container
Data Access/Integration
Web
AOP (Aspect Oriented Programming)
Instrumentation
Messaging
Test

- Core Container
- Data Access/Integration
- Web
- AOP (Aspect Oriented Programming)
- Instrumentation
- Messaging
- Test
[java framework](https://www.interviewbit.com/java-interview-questions/)
- Core Container
- Data Access/Integration
- Web
- AOP (Aspect Oriented Programming)
- Instrumentation
- Messaging
- Test
Spring handles all the infrastructure-related aspects which lets the programmer to focus mostly on application development.

---

### <a id="q-69"></a>69. What are the features of Spring Boot?

- 
Spring Boot CLI – This allows you to Groovy / Maven for writing Spring boot application and avoids boilerplate code.
- 
Starter Dependency – With the help of this feature, Spring Boot aggregates common dependencies together and eventually improves productivity and reduces the burden on
- 
Spring Initializer – This is a web application that helps a developer in creating an internal project structure. The developer does not have to manually set up the structure of the project while making use of this feature.
- 
Auto-Configuration – This helps in loading the default configurations according to the project you are working on. In this way, unnecessary WAR files can be avoided.
- 
Spring Actuator – Spring boot uses actuator to provide “Management EndPoints” which helps the developer in going through the Application Internals, Metrics etc.
- 
Logging and Security – This ensures that all the applications made using Spring Boot are properly secured without any hassle.

---

### <a id="q-70"></a>70. Differentiate between Spring and Spring Boot.

- The Spring Framework provides multiple features like dependency injection, data binding, aspect-oriented programming (AOP), data access, and many more that help easier development of web applications whereas Spring Boot helps in easier usage of the Spring Framework by simplifying or managing various loosely coupled blocks of Spring which are tedious and have a potential of becoming messy.
- Spring boot simplifies commonly used spring dependencies and runs applications straight from a command line. It also doesn’t require an application container and it helps in monitoring several components and configures them externally.

---

### <a id="q-71"></a>71. Explain the advantages of using Spring Boot for application development.

- Spring Boot helps to create stand-alone applications which can be started using java.jar (Doesn’t require configuring WAR files).
- Spring Boot also offers pinpointed ‘started’ POMs to Maven configuration.
- Has provision to embed Undertow, Tomcat, Jetty, or other web servers directly.
- Auto-Configuration: Provides a way to automatically configure an application based on the dependencies present on the classpath.
- Spring Boot was developed with the intention of lessening the lines of code.
- It offers production-ready support like monitoring and apps developed using spring boot are easier to launch.

---

### <a id="q-72"></a>72. What do you understand by the term ‘Spring Boot’?

Spring Boot is an open-source, java-based framework that provides support for Rapid Application Development and gives a platform for developing stand-alone and production-ready spring applications with a need for very few configurations.

---

### <a id="q-73"></a>73. What does @SpringBootApplication annotation do internally?

As per the Spring Boot documentation, the @SpringBootApplication annotation is one point replacement for using @Configuration, @EnableAutoConfiguration and @ComponentScan annotations alongside their default attributes.
This enables the developer to use a single annotation instead of using multiple annotations thus lessening the lines of code. However, Spring provides loosely coupled features which is why we can use these annotations as per our project needs.

---

### <a id="q-74"></a>74. What are the uses of @RequestMapping and @RestController annotations in Spring Boot?

- 
@RequestMapping:
This provides the routing information and informs Spring that any HTTP request matching the URL must be mapped to the respective method.

org.springframework.web.bind.annotation.RequestMapping has to be imported to use this annotation.

- This provides the routing information and informs Spring that any HTTP request matching the URL must be mapped to the respective method.
- 
org.springframework.web.bind.annotation.RequestMapping has to be imported to use this annotation.
- 
@RestController:
This is applied to a class to mark it as a request handler thereby creating RESTful web services using Spring MVC. This annotation adds the @ResponseBody and @Controller annotation to the class.

org.springframework.web.bind.annotation.RestController has to be imported to use this annotation.

- This is applied to a class to mark it as a request handler thereby creating RESTful web services using Spring MVC. This annotation adds the @ResponseBody and @Controller annotation to the class.
- 
org.springframework.web.bind.annotation.RestController has to be imported to use this annotation.
- This provides the routing information and informs Spring that any HTTP request matching the URL must be mapped to the respective method.
- 
org.springframework.web.bind.annotation.RequestMapping has to be imported to use this annotation.

```
org.springframework.web.bind.annotation.RequestMapping
```

- This is applied to a class to mark it as a request handler thereby creating RESTful web services using Spring MVC. This annotation adds the @ResponseBody and @Controller annotation to the class.
- 
org.springframework.web.bind.annotation.RestController has to be imported to use this annotation.

```
org.springframework.web.bind.annotation.RestController
```

Check out more Interview Questions on Spring Boot [here](https://www.interviewbit.com/spring-boot-interview-questions/).

---

### <a id="q-75"></a>75. Can the default web server in the Spring Boot application be disabled?

Yes! application.properties is used to configure the web application type, by mentioning spring.main.web-application-type=none.

```
application.properties
```

```
spring.main.web-application-type=none
```

---

### <a id="q-76"></a>76. How to disable specific auto-configuration class?

- You can use the exclude attribute of @EnableAutoConfiguration for this purpose as shown below:

```
exclude
```

```
@EnableAutoConfiguration
```

```
@EnableAutoConfiguration(exclude = {InterviewBitAutoConfiguration.class})
```

```
@EnableAutoConfiguration(exclude = {InterviewBitAutoConfiguration.class})
```

If the class is not specified on the classpath, we can specify the fully qualified name as the value for the excludeName.

```
excludeName
```

```
//By using "excludeName" @EnableAutoConfiguration(excludeName={Foo.class})
```

```
//By using "excludeName" @EnableAutoConfiguration(excludeName={Foo.class})
```

- You can add into the application.properties and multiple classes can be added by keeping it comma-separated.

---

### <a id="q-77"></a>77. Can you tell how to exclude any package without using the basePackages filter?

We can use the exclude attribute while using the annotation @SpringBootApplication as follows:

```
exclude
```

```
@SpringBootApplication
```

```
@SpringBootApplication(exclude= {Student.class}) public class InterviewBitAppConfiguration {}
```

```
@SpringBootApplication(exclude= {Student.class}) public class InterviewBitAppConfiguration {}
```

---

### <a id="q-78"></a>78. Can we change the default port of the embedded Tomcat server in Spring boot?

- Yes, we can change it by using the application properties file by adding a property of server.port and assigning it to any port you wish to.
- For example, if you want the port to be 8081, then you have to mention server.port=8081. Once the port number is mentioned, the application properties file will be automatically loaded by Spring Boot and the specified configurations will be applied to the application.

```
server.port
```

```
server.port=8081
```

---

### <a id="q-79"></a>79. What are the possible sources of external configuration?

- Spring Boot allows the developers to run the same application in different environments by making use of its feature of external configuration. This uses environment variables, properties files, command-line arguments, YAML files, and system properties to mention the required configuration properties for its corresponding environments. Following are the sources of external configuration:

Command-line properties – Spring Boot provides support for command-line arguments and converts these arguments to properties and then adds them to the set of environment properties.

Application Properties – By default, Spring Boot searches for the application properties file or its YAML file in the current directory of the application, classpath root, or config directory to load the properties.

Profile-specific properties – Properties are loaded from the application-{profile}.properties file or its YAML file. This file resides in the same location as that of the non-specific property files and the {profile} placeholder refers to an active profile or an environment.

- 
Command-line properties – Spring Boot provides support for command-line arguments and converts these arguments to properties and then adds them to the set of environment properties.
- 
Application Properties – By default, Spring Boot searches for the application properties file or its YAML file in the current directory of the application, classpath root, or config directory to load the properties.
- 
Profile-specific properties – Properties are loaded from the application-{profile}.properties file or its YAML file. This file resides in the same location as that of the non-specific property files and the {profile} placeholder refers to an active profile or an environment.
- 
Command-line properties – Spring Boot provides support for command-line arguments and converts these arguments to properties and then adds them to the set of environment properties.
- 
Application Properties – By default, Spring Boot searches for the application properties file or its YAML file in the current directory of the application, classpath root, or config directory to load the properties.
- 
Profile-specific properties – Properties are loaded from the application-{profile}.properties file or its YAML file. This file resides in the same location as that of the non-specific property files and the {profile} placeholder refers to an active profile or an environment.

```
application-{profile}.properties file
```

---

### <a id="q-80"></a>80. What is Spring Boot dependency management system?

- It is basically used to manage dependencies and configuration automatically without the need of specifying the version for any of that dependencies.

---

### <a id="q-81"></a>81. What are the effects of running Spring Boot Application as “Java Application”?

- The application automatically launches the tomcat server as soon as it sees that we are running a web application.

---

### <a id="q-82"></a>82. What is Spring AOP?

- Spring AOP (Aspect Oriented Programming) is similar to OOPs (Object Oriented Programming) as it also provides modularity.
- In AOP key unit is aspects or concerns which are nothing but stand-alone modules in the application. Some aspects have centralized code but other aspects may be scattered or tangled code like in the case of logging or transactions. These scattered aspects are called cross-cutting concern.A cross-cutting concern such as transaction management, authentication, logging, security etc is a concern that could affect the whole application and should be centralized in one location in code as much as possible for security and modularity purposes.

- A cross-cutting concern such as transaction management, authentication, logging, security etc is a concern that could affect the whole application and should be centralized in one location in code as much as possible for security and modularity purposes.
- AOP provides platform to dynamically add these cross-cutting concerns before, after or around the actual logic by using simple pluggable configurations.
- This results in easy maintainenance of code. Concerns can be added or removed simply by modifying configuration files and therefore without the need for recompiling complete sourcecode.
- There are 2 types of implementing Spring AOP:
Using XML configuration files
Using AspectJ annotation style

- Using XML configuration files
- Using AspectJ annotation style
- A cross-cutting concern such as transaction management, authentication, logging, security etc is a concern that could affect the whole application and should be centralized in one location in code as much as possible for security and modularity purposes.
- Using XML configuration files
- Using AspectJ annotation style

---

### <a id="q-83"></a>83. What is HibernateTemplate class?

- Prior to Hibernate 3.0.1, Spring provided 2 classes namely: HibernateDaoSupport to get the Session from Hibernate and HibernateTemplate for Spring transaction management purposes.
- However, from Hibernate 3.0.1 onwards, by using HibernateTemplate class we can use SessionFactory getCurrentSession() method to get the current session and then use it to get the transaction management benefits.
- 
HibernateTemplate has the benefit of exception translation but that can be achieved easily by using @Repository annotation with service classes.

```
HibernateDaoSupport
```

```
HibernateTemplate
```

```
HibernateTemplate
```

```
SessionFactory getCurrentSession()
```

```
HibernateTemplate
```

---

### <a id="q-84"></a>84. What is Hibernate Validator Framework?

- Data validation is a crucial part of any application. We can find data validation in:
UI layer before sending objects to the server
At the server-side before processing it
Before persisting data into the database

- UI layer before sending objects to the server
- At the server-side before processing it
- Before persisting data into the database
- Validation is a cross-cutting concern/task, so as good practice, we should try to keep it apart from our business logic. JSR303 and JSR349 provide specifications for bean validation by using annotations.
- This framework provides the reference implementation for JSR303 and JSR349 specifications.
- UI layer before sending objects to the server
- At the server-side before processing it
- Before persisting data into the database

---

### <a id="q-85"></a>85. What are the two ways of accessing Hibernate by using Spring.

- Inversion of Control approach by using Hibernate Template and Callback.
- Extending HibernateDAOSupport and Applying an AOP Interceptor node.

```
HibernateDAOSupport
```

---

### <a id="q-86"></a>86. What is Hibernate ORM Framework?

- Object-relational mapping (ORM) is the phenomenon of mapping application domain model objects to the relational database tables and vice versa.
- Hibernate is the most commonly used java based ORM framework.

---

### <a id="q-87"></a>87. How can you fetch records by Spring JdbcTemplate?

This can be done by using the query method of JdbcTemplate. There are two interfaces that help to do this:
- 
ResultSetExtractor:
It defines only one method extractData that accepts ResultSet instance as a parameter and returns the list.
Syntax:

- It defines only one method extractData that accepts ResultSet instance as a parameter and returns the list.
- Syntax:
- It defines only one method extractData that accepts ResultSet instance as a parameter and returns the list.
- Syntax:

```
extractData
```

```
ResultSet
```

```
public T extractData(ResultSet rs) throws SQLException,DataAccessException;
```

```
public T extractData(ResultSet rs) throws SQLException,DataAccessException;
```

- 
RowMapper:
This is an enhanced version of ResultSetExtractor that saves a lot of code.
It allows to map a row of the relations with the instance of the user-defined class.
It iterates the ResultSet internally and adds it into the result collection thereby saving a lot of code to fetch records.

- This is an enhanced version of ResultSetExtractor that saves a lot of code.
- It allows to map a row of the relations with the instance of the user-defined class.
- It iterates the ResultSet internally and adds it into the result collection thereby saving a lot of code to fetch records.
- This is an enhanced version of ResultSetExtractor that saves a lot of code.
- It allows to map a row of the relations with the instance of the user-defined class.
- It iterates the ResultSet internally and adds it into the result collection thereby saving a lot of code to fetch records.

---

### <a id="q-88"></a>88. What are some of the classes for Spring JDBC API?

- Following are the classes
JdbcTemplate
SimpleJdbcTemplate
NamedParameterJdbcTemplate
SimpleJdbcInsert
SimpleJdbcCall

- JdbcTemplate
- SimpleJdbcTemplate
- NamedParameterJdbcTemplate
- SimpleJdbcInsert
- SimpleJdbcCall
- The most commonly used one is JdbcTemplate. This internally uses the JDBC API and has the advantage that we don’t need to create connection, statement, start transaction, commit transaction, and close connection to execute different queries. All these are handled by JdbcTemplate itself. The developer can focus on executing the query directly.
- JdbcTemplate
- SimpleJdbcTemplate
- NamedParameterJdbcTemplate
- SimpleJdbcInsert
- SimpleJdbcCall

---

### <a id="q-89"></a>89. What is Spring AOP Proxy pattern?

- A proxy pattern is a well-used design pattern where a proxy is an object that looks like another object but adds special functionality to it behind the scenes.
- Spring AOP follows proxy-based pattern and this is created by the AOP framework to implement the aspect contracts in runtime.
- The standard JDK dynamic proxies are default AOP proxies that enables any interface(s) to be proxied. Spring AOP can also use CGLIB proxies that are required to proxy classes, rather than interfaces. In case a business object does not implement an interface, then CGLIB proxies are used by default.

An advice is the implementation of cross-cutting concerns can be applied to other modules of the spring application. Advices are of mainly 5 types:
- 
Before:
This advice executes before a join point, but it does not have the ability to prevent execution flow from proceeding to the join point (unless it throws an exception).
To use this, use @Before annotation.

- This advice executes before a join point, but it does not have the ability to prevent execution flow from proceeding to the join point (unless it throws an exception).
- To use this, use @Before annotation.
- 
AfterReturning:
This advice is to be executed after a join point completes normally i.e if a method returns without throwing an exception.
To use this, use @AfterReturning annotation.

- This advice is to be executed after a join point completes normally i.e if a method returns without throwing an exception.
- To use this, use @AfterReturning annotation.
- 
AfterThrowing:
This advice is to be executed if a method exits by throwing an exception.
To use this, use @AfterThrowing annotation.

- This advice is to be executed if a method exits by throwing an exception.
- To use this, use @AfterThrowing annotation.
- 
After:
This advice is to be executed regardless of the means by which a join point exits (normal return or exception encounter).
To use this, use @After annotation.

- This advice is to be executed regardless of the means by which a join point exits (normal return or exception encounter).
- To use this, use @After annotation.
- 
Around:
This is the most powerful advice surrounds a join point such as a method invocation.
To use this, use @Around annotation.

- This is the most powerful advice surrounds a join point such as a method invocation.
- To use this, use @Around annotation.
- This advice executes before a join point, but it does not have the ability to prevent execution flow from proceeding to the join point (unless it throws an exception).
- To use this, use @Before annotation.
- This advice is to be executed after a join point completes normally i.e if a method returns without throwing an exception.
- To use this, use @AfterReturning annotation.
- This advice is to be executed if a method exits by throwing an exception.
- To use this, use @AfterThrowing annotation.
- This advice is to be executed regardless of the means by which a join point exits (normal return or exception encounter).
- To use this, use @After annotation.
- This is the most powerful advice surrounds a join point such as a method invocation.
- To use this, use @Around annotation.

---

### <a id="q-90"></a>90. How can you achieve thread-safety in beans?

The thread safety can be achieved by changing the scope of the bean to request, session or prototype but at the cost of performance. This is purely based on the project requirements.

---

### <a id="q-91"></a>91. Is there any need to keepspring-mvc.jar on the classpath or is it already present as part of spring-core?

The spring-mv.jar does not belong to the spring-core. This means that the jar has to be included in the project’s classpath if we have to use the Spring MVC framework in our project. For Java applications, the spring-mvc.jar is placed inside /WEB-INF/lib folder.

```
spring-mv.jar
```

```
spring-mvc.jar
```

```
/WEB-INF/lib
```

---

### <a id="q-92"></a>92. What are Spring Interceptors?

Spring Interceptors are used to pre-handle and post-handle the web requests in Spring MVC which are handled by Spring Controllers. This can be achieved by the HandlerInterceptor interface. These handlers are used for manipulating the model attributes that are passed to the controllers or the views.The Spring handler interceptor can be registered for specific URL mappings so that it can intercept only those requests. The custom handler interceptor must implement the HandlerInterceptor interface that has 3 callback methods that can be implemented:

```
HandlerInterceptor
```

```
HandlerInterceptor
```

- preHandle()
- postHandle()
- afterCompletion()
The only problem with this interface is that all the methods of this interface need to be implemented irrespective of its requirements. This can be avoided if our handler class extends the HandlerInterceptorAdapter class that internally implements the HandlerInterceptor interface and provides default blank implementations.

```
HandlerInterceptorAdapter
```

```
HandlerInterceptor
```

---

### <a id="q-93"></a>93. Why do we need BindingResults?

BindingResults is an important Spring interface that is within the org.Springframework.validation package. This interface has a very simple and easy process of invocation and plays a vital role in detecting errors in the submitted forms. However, care has to be taken by the developer to use the BindingResult parameter just after the object that needs validation. For example:

```
org.Springframework.validation
```

```
@PostMapping("/interviewbit") public String registerCourse(@Valid RegisterUser registerUser, BindingResult bindingResult, Model model) { if (bindingResult.hasErrors()) { return "home"; } model.addAttribute("message", "Valid inputs"); return "home"; }
```

```
@PostMapping("/interviewbit") public String registerCourse(@Valid RegisterUser registerUser, BindingResult bindingResult, Model model) { if (bindingResult.hasErrors()) { return "home"; } model.addAttribute("message", "Valid inputs"); return "home"; }
```

The Spring will understand to find the corresponding validators by checking the @Valid annotation on the parameter.

---

### <a id="q-94"></a>94. Where does the access to the model from the view come from?

The view requires access to the model to render the output as the model contains the required data meant for rendering. The model is associated with the controller that processes the client requests and finally encapsulates the response into the Model object.

---

### <a id="q-95"></a>95. How does the Spring MVC flow look like? In other words, How does a DispatcherServlet know what Controller needs to be called when there is an incoming request to the Spring MVC?

A Dispatcher Servlet knows which controller to call by means of handler mappings. These mappings have the mapping between the controller and the requests. BeanNameUrlHandlerMapping and SimpleUrlHandlerMapping are the two most commonly used handler mappings.

```
BeanNameUrlHandlerMapping
```

```
SimpleUrlHandlerMapping
```

- BeanNameUrlHandlerMapping: When the URL request matches the bean name, the class corresponding to the bean definition is the actual controller that is responsible for processing the request.
- SimpleUrlHandlerMapping: Here, the mapping is very explicit. The number of URLs can be specified here and each URL is associated explicitly with a controller.
If the Spring MVC is configured using annotations, then @RequestMapping annotations are used for this purpose. The @RequestMapping annotation is configured by making use of the URI path, HTTP methods, query parameters, and the HTTP Headers.

---

### <a id="q-96"></a>96. How is the root application context in Spring MVC loaded?

The root application context is loaded using the ContextLoaderListener that belongs to the entire application. Spring MVC allows instantiating multiple DispatcherServlet and each of them have multiple contexts specific to them. They can have the same root context too.

---

### <a id="q-97"></a>97. How is the dispatcher servlet instantiated?

The dispatcher servlet is instantiated by means of servlet containers such as Tomcat. The Dispatcher Servlet should be defined in web.xml The DispatcherServlet is instantiated by Servlet containers like Tomcat. The Dispatcher Servlet can be defined in web.xml as shown below:

```
<?xml version="1.0" encoding="UTF-8"?> <web-app version="2.5" xmlns="http://java.sun.com/xml/ns/javaee" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://java.sun.com/xml/ns/javaee http://java.sun.com/xml/ns/javaee/web-app_2_5.xsd"> <!-- Define Dispatcher Servlet --> <servlet> <servlet-name>appServlet</servlet-name> <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class> <init-param> <param-name>contextConfigLocation</param-name> <param-value>/WEB-INF/spring/appServlet/servlet-context.xml</param-value> </init-param> <load-on-startup>1</load-on-startup> </servlet> <servlet-mapping> <servlet-name>InterviewBitServlet</servlet-name> <url-pattern>/</url-pattern> </servlet-mapping> </web-app>
```

```
<?xml version="1.0" encoding="UTF-8"?> <web-app version="2.5" xmlns="http://java.sun.com/xml/ns/javaee" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://java.sun.com/xml/ns/javaee http://java.sun.com/xml/ns/javaee/web-app_2_5.xsd"> <!-- Define Dispatcher Servlet --> <servlet> <servlet-name>appServlet</servlet-name> <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class> <init-param> <param-name>contextConfigLocation</param-name> <param-value>/WEB-INF/spring/appServlet/servlet-context.xml</param-value> </init-param> <load-on-startup>1</load-on-startup> </servlet> <servlet-mapping> <servlet-name>InterviewBitServlet</servlet-name> <url-pattern>/</url-pattern> </servlet-mapping> </web-app>
```

Here, the load-on-startup tag is 1 which indicates that the DispatcherServlet is instantiated whenever the Spring MVC application to the servlet container. During this process, it looks for the servlet-name-context.xml file and initializes beans that are defined in the file.

---

### <a id="q-98"></a>98. What is the significance of @Repository annotation?

@Repository annotation indicates that a component is used as the repository that acts as a means to store, search or retrieve data. These can be added to the DAO classes.

---

### <a id="q-99"></a>99. What are the differences between the <context:annotation-config> vs <context:component-scan> tags?

<context:annotation-config> is used for activating applied annotations in pre-registered beans in the application context. It also registers the beans defined in the config file and it scans the annotations within the beans and activates them.

```
<context:annotation-config>
```

The <context:component-scan> tag does the task of <context:annotation-config> along with scanning the packages and registering the beans in the application context.

```
<context:component-scan>
```

```
<context:annotation-config>
```

<context:annotation-config> = Scan and activate annotations in pre-registered beans.<context:component-scan> = Register Bean + Scan and activate annotations in package.

```
<context:annotation-config>
```

```
<context:component-scan>
```

---

### <a id="q-100"></a>100. Are singleton beans thread-safe?

No, the singleton beans are not thread-safe because the concept of thread-safety essentially deals with the execution of the program and the singleton is simply a design pattern meant for the creation of objects. Thread safety nature of a bean depends on the nature of its implementation.

---

### <a id="q-101"></a>101. What is the importance of @Required annotation?

The annotation is used for indicating that the property of the bean should be populated via autowiring or any explicit value during the bean definition at the configuration time. For example, consider a code snippet below where we need to have the values of age and the name:

```
import org.Springframework.beans.factory.annotation.Required; public class User { private int age; private String name; @Required public void setAge(int age) { this.age = age; } public Integer getAge() { return this.age; } @Required public void setName(String name) { this.name = name; } public String getName() { return this.name; } }
```

```
import org.Springframework.beans.factory.annotation.Required; public class User { private int age; private String name; @Required public void setAge(int age) { this.age = age; } public Integer getAge() { return this.age; } @Required public void setName(String name) { this.name = name; } public String getName() { return this.name; } }
```

---

### <a id="q-102"></a>102. What is the importance of session scope?

Session scopes are used to create bean instances for HTTP sessions. This would mean that a single bean can be used for serving multiple HTTP requests. The scope of the bean can be defined by means of using scope attribute or using @Scope or @SessionScope annotations.
- Using scope attribute:

```
<bean id="userBean" class="com.interviewbit.UserBean" scope="session"/>
```

```
<bean id="userBean" class="com.interviewbit.UserBean" scope="session"/>
```

- Using @Scope annotation:

```
@Component @Scope("session") public class UserBean { //some methods and properties }
```

```
@Component @Scope("session") public class UserBean { //some methods and properties }
```

- Using @SessionScope:

```
@Component @SessionScope public class UserBean { //some methods and properties }
```

```
@Component @SessionScope public class UserBean { //some methods and properties }
```

There are two types of DI (Dependency Injection):
- 
Construction-Based:
This type of DI is accomplished when the Spring IoC (Inversion of Control) container invokes parameterized constructor having a dependency on other classes.
This cannot instantiate the values partially and ensures that the dependency injection is done fully.
There are two possible ways of achieving this:

- This type of DI is accomplished when the Spring IoC (Inversion of Control) container invokes parameterized constructor having a dependency on other classes.
- This cannot instantiate the values partially and ensures that the dependency injection is done fully.
- There are two possible ways of achieving this:
- This type of DI is accomplished when the Spring IoC (Inversion of Control) container invokes parameterized constructor having a dependency on other classes.
- This cannot instantiate the values partially and ensures that the dependency injection is done fully.
- There are two possible ways of achieving this:
Annotation Configuration: This approach uses POJO objects and annotations for configuration. For example, consider the below code snippet:

```
@Configuration @ComponentScan("com.interviewbit.constructordi") public class SpringAppConfig { @Bean public Shape shapes() { return new Shapes("Rectangle"); } @Bean public Dimension dimensions() { return new Dimension(4,3); } }
```

```
@Configuration @ComponentScan("com.interviewbit.constructordi") public class SpringAppConfig { @Bean public Shape shapes() { return new Shapes("Rectangle"); } @Bean public Dimension dimensions() { return new Dimension(4,3); } }
```

Here, the annotations are used for notifying the Spring runtime that the class specified with @Bean annotation is the provider of beans and the process of context scan needs to be performed on the package com.interviewbit.constructordi by means of @ComponentScan annotation. Next, we will be defining a Figure class component as below:

```
@Bean
```

```
com.interviewbit.constructordi
```

```
@ComponentScan
```

```
@Component public class Figure { private Shape shape; private Dimension dimension; @Autowired public Figure(Shape shape, Dimension dimension) { this.shape = shape; this.dimension = dimension; } }
```

```
@Component public class Figure { private Shape shape; private Dimension dimension; @Autowired public Figure(Shape shape, Dimension dimension) { this.shape = shape; this.dimension = dimension; } }
```

Spring encounters this Figure class while performing context scan and it initializes the instance of this class by invoking the constructor annotated with @Autowired. The Shape and Dimension instances are obtained by calling the methods annotated with @Bean in the SpringAppConfig class. Instances of Engine and Transmission will be obtained by calling @Bean annotated methods of the Config class. Finally, we need to bootstrap an ApplicationContext using our POJO configuration:

```
@Autowired
```

```
@Bean
```

```
SpringAppConfig
```

```
ApplicationContext context = new AnnotationConfigApplicationContext(SpringAppConfig.class); Figure figure = context.getBean(Figure.class);
```

```
ApplicationContext context = new AnnotationConfigApplicationContext(SpringAppConfig.class); Figure figure = context.getBean(Figure.class);
```

XML Configuration: This is another way of configuring Spring runtime by using the XML configuration file. For example, consider the below code snippet in the springAppConfig.xml file:

```
<bean id="toyota" class="com.interviewbit.constructordi.Figure"> <constructor-arg index="0" ref="shape"/> <constructor-arg index="1" ref="dimension"/> </bean> <bean id="shape" class="com.interviewbit.constructordi.Shape"> <constructor-arg index="0" value="Rectangle"/> </bean> <bean id="dimension" class="com.interviewbit.constructordi.Dimension"> <constructor-arg index="0" value="4"/> <constructor-arg index="1" value="3"/> </bean>
```

```
<bean id="toyota" class="com.interviewbit.constructordi.Figure"> <constructor-arg index="0" ref="shape"/> <constructor-arg index="1" ref="dimension"/> </bean> <bean id="shape" class="com.interviewbit.constructordi.Shape"> <constructor-arg index="0" value="Rectangle"/> </bean> <bean id="dimension" class="com.interviewbit.constructordi.Dimension"> <constructor-arg index="0" value="4"/> <constructor-arg index="1" value="3"/> </bean>
```

---

### <a id="q-103"></a>103. What are the types of Spring MVC Dependency Injection?

The constructor-arg tag can accept either literal value or another bean’s reference and explicit index and type. The index and type arguments are used for resolving conflicts in cases of ambiguity.While bootstrapping this class, the Spring ApplicationContext needs to use ClassPathXmlApplicationContext as shown below:

```
constructor-arg
```

```
ApplicationContext
```

```
ClassPathXmlApplicationContext
```

```
ApplicationContext context = new ClassPathXmlApplicationContext("springAppConfig.xml"); Figure figure = context.getBean(Figure.class);
```

```
ApplicationContext context = new ClassPathXmlApplicationContext("springAppConfig.xml"); Figure figure = context.getBean(Figure.class);
```

- 
Setter-Based:
This form of DI is achieved when the Spring IoC container calls the bean’s setter method after a non-parameterized constructor is called to perform bean instantiation.
It is possible to achieve circular dependency using setter injection.
For achieving this type of DI, we need to configure it through the configuration file under the <property> tag. For example, consider a class InterviewBit that sets the property articles as shown below:

- This form of DI is achieved when the Spring IoC container calls the bean’s setter method after a non-parameterized constructor is called to perform bean instantiation.
- It is possible to achieve circular dependency using setter injection.
- For achieving this type of DI, we need to configure it through the configuration file under the <property> tag. For example, consider a class InterviewBit that sets the property articles as shown below:
- This form of DI is achieved when the Spring IoC container calls the bean’s setter method after a non-parameterized constructor is called to perform bean instantiation.
- It is possible to achieve circular dependency using setter injection.
- For achieving this type of DI, we need to configure it through the configuration file under the <property> tag. For example, consider a class InterviewBit that sets the property articles as shown below:

```
<property>
```

```
InterviewBit
```

```
articles
```

```
package com.interviewbit.model; import com.interviewbit.model.Article; public class InterviewBit { // Object of the Article interface Article article; public void setArticle(Article article) { this.article = article; } }
```

```
package com.interviewbit.model; import com.interviewbit.model.Article; public class InterviewBit { // Object of the Article interface Article article; public void setArticle(Article article) { this.article = article; } }
```

In the bean configuration file, we will be setting as below:

```
<beans xmlns="http://www.springframework.org/schema/beans" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-2.5.xsd"> <bean id="InterviewBit" class="com.interviewbit.model.InterviewBit"> <property name="article"> <ref bean="JsonArticle" /> </property> </bean> <bean id="JsonArticle" class="com.interviewbit.bean.JsonArticle" /> </beans>
```

```
<beans xmlns="http://www.springframework.org/schema/beans" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans-2.5.xsd"> <bean id="InterviewBit" class="com.interviewbit.model.InterviewBit"> <property name="article"> <ref bean="JsonArticle" /> </property> </bean> <bean id="JsonArticle" class="com.interviewbit.bean.JsonArticle" /> </beans>
```

The ‘JsonArticle’ bean is injected into the InterviewBit class object by means of the setArticle method.In cases where both types of dependencies are used, then the setter dependency injection has more preference by considering the specificity nature.

```
setArticle
```

---

### <a id="q-104"></a>104. What is the importance of the web.xml in Spring MVC?

web.xml is also known as the Deployment Descriptor which has definitions of the servlets and their mappings, filters, and lifecycle listeners. It is also used for configuring the ContextLoaderListener. Whenever the application is deployed, a ContextLoaderListener instance is created by Servlet container which leads to a load of WebApplicationContext.

```
web.xml
```

---

### <a id="q-105"></a>105. What is the role of @ModelAttribute annotation?

The annotation plays a very important role in binding method parameters to the respective attribute that corresponds to a model. Then it reflects the same on the presentation page. The role of the annotation also depends on what the developer is using that for. In case, it is used at the method level, then that method is responsible for adding attributes to it. When used at a parameter level, it represents that the parameter value is meant to be retrieved from the model layer.

---

### <a id="q-106"></a>106. What is the use of @Autowired annotation?

@Autowired annotation is meant for the injection of a bean by means of its type along with methods and fields. This helps the Spring framework to resolve dependencies by injecting and collaborating the beans into another bean. For example, consider the below code snippet:

```
@Autowired
```

```
import org.Springframework.beans.factory.annotation.Autowired; import java.util.*; public class InterviewBit { // Autowiring/Injecting FormatterUtil as dependency to InterviewBit class @Autowired private FormatterUtil formatterUtil; public Date something( String value ){ Date dateFormatted = formatterUtil.formatDate(value); return dateFormatted } } /** * Util class to format any string value to valid date format */ public class FormatterUtil { public Date formatDate(String value){ //code to format date } }
```

```
import org.Springframework.beans.factory.annotation.Autowired; import java.util.*; public class InterviewBit { // Autowiring/Injecting FormatterUtil as dependency to InterviewBit class @Autowired private FormatterUtil formatterUtil; public Date something( String value ){ Date dateFormatted = formatterUtil.formatDate(value); return dateFormatted } } /** * Util class to format any string value to valid date format */ public class FormatterUtil { public Date formatDate(String value){ //code to format date } }
```

---

### <a id="q-107"></a>107. What is the Model in Spring MVC?

- Model is a reference to have the data for rendering.
- It is always created and passed to the view in Spring MVC. If a mapped controller method has Model as a parameter, then that model instance is automatically injected to that method.
- Any attributes set on the injected model would be preserved and passed to the View.

---

### <a id="q-108"></a>108. What will be the selection state of a checkbox input if the user first checks the checkbox and gets validation errors in other fields and then unchecks the checkbox after getting the errors?

The validation is generally performed during HTTP POST requests. During HTTP requests, if the state of the checkbox is unchecked, then HTTP includes the request parameter for the checkbox thereby not picking up the updated selection. This can be fixed by making use of a hidden form field that starts with _ in the Spring MVC.

```
_
```

### Conclusion:
In this article, we have seen the most commonly asked Spring Interview Questions during an interview. Spring is a very powerful framework that allows building enterprise-level web applications. Applications developed using Spring are generally quick, scalable, and transparent. Due to this, Spring has been embraced by a huge Java Developer’s community thereby making it an inevitable part of any Java Developer’s Job Role. Knowing Spring ensures that an added advantage is with the developers to progress steadily in their careers too.
Tip: We also recommend reading guides posted [here](https://spring.io/guides).

---

### <a id="q-109"></a>109. How is it possible to use the Tomcat JNDI DataSource in the Spring applications?

To use the servlet container which is configured in the JNDI (Java Naming and Directory Interface) DataSource, the DataSource bean has to be configured in the spring bean config file and then injected into the beans as dependencies. Post this, the DataSource bean can be used for performing database operations by means of the JdbcTemplate. The syntax for registering a MySQL DataSource bean:

```
<bean id="dataSource" class="org.springframework.jndi.JndiObjectFactoryBean"> <property name="jndiName" value="java:comp/env/jdbc/MySQLDB"/> </bean>
```

```
<bean id="dataSource" class="org.springframework.jndi.JndiObjectFactoryBean"> <property name="jndiName" value="java:comp/env/jdbc/MySQLDB"/> </bean>
```

---

### <a id="q-110"></a>110. What do you understand by MultipartResolver?

The MultipartResolver is used for handling the file upload scenarios in the Spring web application. There are 2 concrete implementations of this in Spring, they are:
- CommonsMultipartResolver meant for Jakarta Commons FileUpload
- StandardServletMultipartResolver meant for for Servlet 3.0 Part API
To implement this, we need to create a bean with id=“multipartResolver” in the application context of DispatcherServlet. Doing this ensures that all the requests handled by the DispatcherServlet have this resolver applied whenever a multipart request is detected. If a multipart request is detected by the DispatcherServlet, it resolves the request by means of the already configured MultipartResolver, and the request is passed on as a wrapped/abstract HttpServletRequest. Controllers then cast this request as the MultipartHttpServletRequest interface to get access to the Multipart files. The following diagram illustrates the flow clearly:

```
MultipartHttpServletRequest
```

---

### <a id="q-111"></a>111. How are i18n and localization supported in Spring MVC?

Spring MVC has LocaleResolver that supports i18n and localization. for supporting both internationalization and localization. The following beans need to be configured in the application:

```
LocaleResolver
```

- 
SessionLocaleResolver: This bean plays a vital role to get and resolve the locales from the pre-defined attributes in the user session.
Syntax:

```
<bean id="localeResolver"class="org.Springframework.web.servlet.i18n.SessionLocaleResolver"> <property name="defaultLocale" value="en" /> </bean>
```

```
<bean id="localeResolver"class="org.Springframework.web.servlet.i18n.SessionLocaleResolver"> <property name="defaultLocale" value="en" /> </bean>
```

- 
LocaleChangeInterceptor: This bean is useful to resolve the parameter from the incoming request.
Syntax:

```
<bean id="localeChangeInterceptor"class="org.Springframework.web.servlet.i18n.LocaleChangeInterceptor"> <property name="paramName" value="lang" /> </bean>
```

```
<bean id="localeChangeInterceptor"class="org.Springframework.web.servlet.i18n.LocaleChangeInterceptor"> <property name="paramName" value="lang" /> </bean>
```

- 
DefaultAnnotationHandlerMapping: This refers to the HandlerMapping interface implementation which maps the handlers/interceptors based on the HTTP paths specified in the @RequestMapping at type or method level.
Syntax:

```
<bean class="org.Springframework.web.servlet.mvc.annotation.DefaultAnnotationHandlerMapping"> <property name="interceptors"> <list> <ref bean="localeChangeInterceptor" /> </list> </property> </bean>
```

```
<bean class="org.Springframework.web.servlet.mvc.annotation.DefaultAnnotationHandlerMapping"> <property name="interceptors"> <list> <ref bean="localeChangeInterceptor" /> </list> </property> </bean>
```

---

### <a id="q-112"></a>112. Differentiate between a Bean Factory and an Application Context.

BeanFactory and the ApplicationContext are both Java interfaces. The difference is that the ApplicationContext extends the BeanFactory. BeanFactory provides both IoC and DI basic features whereas the ApplicationContext provides more advanced features. Following are the differences between these two:

---

### <a id="q-113"></a>113. How to get ServletConfig and ServletContext objects in spring bean?

This can be done by either implementing the spring-aware interfaces or by using the @Autowired annotation.

```
@Autowired private ServletContext servletContext; @Autowired private ServletConfig servletConfig;
```

```
@Autowired private ServletContext servletContext; @Autowired private ServletConfig servletConfig;
```

---

### <a id="q-114"></a>114. How is the form data validation done in Spring Web MVC Framework?

Spring MVC does the task of data validation using the validator object which implements the Validator interface. In the custom validator class that we have created, we can use the utility methods of the ValidationUtils class like rejectIfEmptyOrWhitespace() or rejectIfEmpty() to perform validation of the form fields.

```
rejectIfEmptyOrWhitespace()
```

```
rejectIfEmpty()
```

```
@Component public class UserValidator implements Validator { public boolean supports(Class clazz) { return UserVO.class.isAssignableFrom(clazz); } public void validate(Object target, Errors errors) { ValidationUtils.rejectIfEmptyOrWhitespace(errors, "name", "error.name", "Name is required."); ValidationUtils.rejectIfEmptyOrWhitespace(errors, "age", "error.age", "Age is required."); ValidationUtils.rejectIfEmptyOrWhitespace(errors, "phone", "error.phone", "Phone is required."); } }
```

```
@Component public class UserValidator implements Validator { public boolean supports(Class clazz) { return UserVO.class.isAssignableFrom(clazz); } public void validate(Object target, Errors errors) { ValidationUtils.rejectIfEmptyOrWhitespace(errors, "name", "error.name", "Name is required."); ValidationUtils.rejectIfEmptyOrWhitespace(errors, "age", "error.age", "Age is required."); ValidationUtils.rejectIfEmptyOrWhitespace(errors, "phone", "error.phone", "Phone is required."); } }
```

In the fields that are subject to validation, in case of errors, the validator methods would create field error and bind that to the field.
To activate the custom validator as spring bean, then:
- We have to add the @Component annotation on the custom validator class and initiate the component scanning of the package containing the validator declarations by adding the below change:

```
<context:component-scan base-package="com.interviewbit.validators"/>
```

```
<context:component-scan base-package="com.interviewbit.validators"/>
```

OR
The validator class can be registered in the context file directly as a bean as shown:

```
<bean id="userValidator" class="com.interviewbit.validators.UserValidator" />
```

```
<bean id="userValidator" class="com.interviewbit.validators.UserValidator" />
```

---

### <a id="q-115"></a>115. What are the differences between @RequestParam and @PathVariable annotations?

- Even though both these annotations are used to extract some data from URL, there is a key difference between them.
The @RequestParam is used to extract query parameters that is anything after “?” in the URL.
The @PathVariable is used to extract the data present as part of the URI itself.]
For example, if the given URL is http://localhost:8080/InterviewBit/Spring/SpringMVC/?format=json, then you can access the query parameter “format” using the @RequestParam annotation and /Spring/{type} using the @PathVariable, which will give you SpringMVC.

- The @RequestParam is used to extract query parameters that is anything after “?” in the URL.
- The @PathVariable is used to extract the data present as part of the URI itself.]
- For example, if the given URL is http://localhost:8080/InterviewBit/Spring/SpringMVC/?format=json, then you can access the query parameter “format” using the @RequestParam annotation and /Spring/{type} using the @PathVariable, which will give you SpringMVC.
- The @RequestParam is used to extract query parameters that is anything after “?” in the URL.
- The @PathVariable is used to extract the data present as part of the URI itself.]
- For example, if the given URL is http://localhost:8080/InterviewBit/Spring/SpringMVC/?format=json, then you can access the query parameter “format” using the @RequestParam annotation and /Spring/{type} using the @PathVariable, which will give you SpringMVC.

```
@RequestMapping("/Spring/{type}") public void getQuestions(@PathVariable("type") String type, @RequestParam(value = "format", required = false) String format){ /* Some code */ }
```

```
@RequestMapping("/Spring/{type}") public void getQuestions(@PathVariable("type") String type, @RequestParam(value = "format", required = false) String format){ /* Some code */ }
```

---

### <a id="q-116"></a>116. What is ContextLoaderListener and what does it do?

- The ContextLoaderListener loads and creates the ApplicationContext, so a developer need not write explicit code to do create it. In short, it is a listener that aids to bootstrap Spring MVC.The application context is where Spring bean resides. For a web application, there is a subclass called WebAppliationContext.

- The application context is where Spring bean resides. For a web application, there is a subclass called WebAppliationContext.
- The lifecycle of the ApplicationContext is tied to the lifecycle of the ServletContext by using ContextLoaderListener. The ServletContext from the WebApplicationContext can be obtained using the getServletContext() method.
- The application context is where Spring bean resides. For a web application, there is a subclass called WebAppliationContext.

---

### <a id="q-117"></a>117. Can you create a controller without using @Controller or @RestController annotations?

- Yes! You can create a controller without @Controller or @RestController annotations by annotating the Spring MVC Controller classes using the @Component annotation. In this case, the real job of request mapping to handler method is done using the @RequestMapping annotation.

```
@Component
```

---

### <a id="q-118"></a>118. What is the @Controller annotation used for?

- The @Controller is a stereotype Spring MVC annotation to define a Controller.

---

### <a id="q-119"></a>119. What is a View Resolver pattern and explain its significance in Spring MVC?

- It is a J2EE pattern that allows the applications to dynamically choose technology for rendering the data on the browser (View).Any technology like HTML, JSP, XSLT, JSF, or any other such technology can be used as View.

- Any technology like HTML, JSP, XSLT, JSF, or any other such technology can be used as View.
- The View Resolver has the information of different views. The Controller returns the name of the View which is then passed to View Resolver by the DispatcherServlet for selecting the appropriate View technology and then the data is displayed.
- The default ViewResolver used in Spring MVC is InternalResourceViewResolver.
- Any technology like HTML, JSP, XSLT, JSF, or any other such technology can be used as View.

```
InternalResourceViewResolver
```

---

### <a id="q-120"></a>120. What is DispatcherServlet in Spring MVC? In other words, can you explain the Spring MVC architecture?

Spring MVC framework is built around a central servlet called DispatcherServlet that handles all the HTTP requests and responses. The DispatcherServlet does a lot more than that:
- It seamlessly integrates with the IoC container and allows you to use each feature of Spring in an easier manner.
- The DispatcherServlet contacts HandlerMapping to call the appropriate Controller for processing the request on receiving it. Then, the controller calls appropriate service methods to set or process the Model data. The service processes the data and returns the view name to DispatcherServlet. DispatcherServlet then takes the help of ViewResolver and picks up the defined view for the request. Once the view is decided, the DispatcherServlet passes the Model data to View where it is finally rendered on the browser.

---

### <a id="q-121"></a>121. What are the benefits of Spring MVC framework over other MVC frameworks?

- Clear separation of roles – There is a specialised dedicated object for every role.
- Reusable business code logic – With Spring MVC, there is no need for duplicating the code. Existing objects can be used as commands instead of replicating them in order to extend a particular framework base class.
- Spring MVC framework provides customizable binding and validation.
- Also provides customizable locale and theme resolution.
- Spring MVC supports customizable handler mapping and view resolution too.

---

### <a id="q-122"></a>122. What is the Spring MVC framework?

- Spring MVC is a request driven framework and one of the core components of the Spring framework.
- It comes with ready to use loosely coupled components and elements that greatly aid developers in building flexible and robust web applications.
- The [MVC (Model - View - Controller) architecture](https://www.interviewbit.com/mvc-interview-questions/) separates and provides loose coupling between the different aspects of the application – input logic (Model), business logic (Controller), and UI logic (View).
[MVC (Model - View - Controller) architecture](https://www.interviewbit.com/mvc-interview-questions/)

What advice is run once joint-point execution is complete?
What is used to notify the completion of the session processing?
What annotation is used for finding transaction and failing it by complaining no Hibernate session is bound to thread?
What are the types of autowire in Spring? Choose the correct option.
Which among the below classes is used for mapping database row to java object in Spring?
Which among the below annotation represents that a field can't be null?
Which among the below options needs to be registered for loading the application’s root context at start time?
Which among the ViewResolvers resolves the view name to the application’s directory?
Which of the below statements are correct about Spring?
What method arguments are used in handler methods using @RequestMapping?
What annotation receives values in the form of regular expression?
What does the byName type of autowiring do?
Which among the below is the Handler method annotation in Spring?
Which method allows to start a new transaction in Spring?
What is the output of the below code?

```
import org.aspectj.lang.annotation.Aspect; import org.aspectj.lang.annotation.AfterThrowing; @Aspect public class SampleAspectClass { @AfterThrowing(pointcut="com.interviewbit.Operations.someOperation()", throwing="ex") public void doRecoveryActions(DataAccessException e){ throw new IllegalArgumentException(); } }
```

```
import org.aspectj.lang.annotation.Aspect; import org.aspectj.lang.annotation.AfterThrowing; @Aspect public class SampleAspectClass { @AfterThrowing(pointcut="com.interviewbit.Operations.someOperation()", throwing="ex") public void doRecoveryActions(DataAccessException e){ throw new IllegalArgumentException(); } }
```

Which method gives warning from the compiler resulting from List to List unchecked conversion?
What property is used for loading hibernate configuration files by the factory bean?
Which method is used for shutting down IoC container in Spring?
What attribute is used for handling web request flow?
What class is used for giving a class behaviour of DispatcherServlet?
[Register Now For FREE!](https://www.interviewbit.com/spring-interview-questions)
- [Blog](https://www.interviewbit.com/blog/)
- https://www.interviewbit.com/blog/[Community](https://www.interviewbit.com/discussion/)
- https://www.interviewbit.com/discussion/[About Us](https://www.interviewbit.com/pages/about_us/)
- https://www.interviewbit.com/pages/about_us/[FAQ](https://www.interviewbit.com/pages/faq/)
- https://www.interviewbit.com/pages/faq/[Contact Us](https://www.interviewbit.com/pages/contact_us/)
- https://www.interviewbit.com/pages/contact_us/[Terms](https://www.interviewbit.com/pages/terms/)
- https://www.interviewbit.com/pages/terms/[Privacy Policy](https://www.interviewbit.com/pages/privacy/)
[Blog](https://www.interviewbit.com/blog/)
[Community](https://www.interviewbit.com/discussion/)
[About Us](https://www.interviewbit.com/pages/about_us/)
[FAQ](https://www.interviewbit.com/pages/faq/)
[Contact Us](https://www.interviewbit.com/pages/contact_us/)
[Terms](https://www.interviewbit.com/pages/terms/)
[Privacy Policy](https://www.interviewbit.com/pages/privacy/)
- 

                      [Practice Questions](https://www.interviewbit.com/practice/)

                      [Programming](https://www.interviewbit.com/courses/programming/)

                      [Scripting](https://www.interviewbit.com/courses/shell/)

                      [System Design](https://www.interviewbit.com/courses/system-design/)

                      [Databases](https://www.interviewbit.com/courses/databases/)

                      [Puzzle](https://www.interviewbit.com/puzzles/)

- 
                      [Practice Questions](https://www.interviewbit.com/practice/)

- 
                      [Programming](https://www.interviewbit.com/courses/programming/)

- 
                      [Scripting](https://www.interviewbit.com/courses/shell/)

- 
                      [System Design](https://www.interviewbit.com/courses/system-design/)

- 
                      [Databases](https://www.interviewbit.com/courses/databases/)

- 
                      [Puzzle](https://www.interviewbit.com/puzzles/)

- 

                      [Fast Track Courses](https://www.interviewbit.com/courses/fast-track/)

                      [Python](https://www.interviewbit.com/courses/fast-track-python/)

                      [Java](https://www.interviewbit.com/courses/fast-track-java/)

[C++](https://www.interviewbit.com/courses/fast-track-cpp/)

                      [Javascript](https://www.interviewbit.com/courses/fast-track-js/)

- 
                      [Fast Track Courses](https://www.interviewbit.com/courses/fast-track/)

- 
                      [Python](https://www.interviewbit.com/courses/fast-track-python/)

- 
                      [Java](https://www.interviewbit.com/courses/fast-track-java/)

- 
                      [C++](https://www.interviewbit.com/courses/fast-track-cpp/)

- 
                      [Javascript](https://www.interviewbit.com/courses/fast-track-js/)

- 
                      [Practice Questions](https://www.interviewbit.com/practice/)

- 
                      [Programming](https://www.interviewbit.com/courses/programming/)

- 
                      [Scripting](https://www.interviewbit.com/courses/shell/)

- 
                      [System Design](https://www.interviewbit.com/courses/system-design/)

- 
                      [Databases](https://www.interviewbit.com/courses/databases/)

- 
                      [Puzzle](https://www.interviewbit.com/puzzles/)

[Practice Questions](https://www.interviewbit.com/practice/)
[Programming](https://www.interviewbit.com/courses/programming/)
[Scripting](https://www.interviewbit.com/courses/shell/)
[System Design](https://www.interviewbit.com/courses/system-design/)
[Databases](https://www.interviewbit.com/courses/databases/)
[Puzzle](https://www.interviewbit.com/puzzles/)
- 
                      [Fast Track Courses](https://www.interviewbit.com/courses/fast-track/)

- 
                      [Python](https://www.interviewbit.com/courses/fast-track-python/)

- 
                      [Java](https://www.interviewbit.com/courses/fast-track-java/)

- 
                      [C++](https://www.interviewbit.com/courses/fast-track-cpp/)

- 
                      [Javascript](https://www.interviewbit.com/courses/fast-track-js/)

[Fast Track Courses](https://www.interviewbit.com/courses/fast-track/)
[Python](https://www.interviewbit.com/courses/fast-track-python/)
[Java](https://www.interviewbit.com/courses/fast-track-java/)
[C++](https://www.interviewbit.com/courses/fast-track-cpp/)
[Javascript](https://www.interviewbit.com/courses/fast-track-js/)
- Online Interviewbit Compilers
- 
                  [Online C Compiler](https://www.interviewbit.com/online-c-compiler/)

- 
                  [Online C++ Compiler](https://www.interviewbit.com/online-cpp-compiler/)

- 

- 
                  [Online Javascript Compiler](https://www.interviewbit.com/online-javascript-compiler/)

- 
                  [Online Python Compiler](https://www.interviewbit.com/online-python-compiler/)

[Online C Compiler](https://www.interviewbit.com/online-c-compiler/)
[Online C++ Compiler](https://www.interviewbit.com/online-cpp-compiler/)
[Online Javascript Compiler](https://www.interviewbit.com/online-javascript-compiler/)
[Online Python Compiler](https://www.interviewbit.com/online-python-compiler/)
- Interview Preparation
- 
      [Java Interview Questions](https://www.interviewbit.com/java-interview-questions/)

- 
      [Sql Interview Questions](https://www.interviewbit.com/sql-interview-questions/)

- 
      [Python Interview Questions](https://www.interviewbit.com/python-interview-questions/)

- 
      [Javascript Interview Questions](https://www.interviewbit.com/javascript-interview-questions/)

- 
      [Angular Interview Questions](https://www.interviewbit.com/angular-interview-questions/)

- 
      [Networking Interview Questions](https://www.interviewbit.com/networking-interview-questions/)

- 
      [Selenium Interview Questions](https://www.interviewbit.com/selenium-interview-questions/)

- 
      [Data Structure Interview Questions](https://www.interviewbit.com/data-structure-interview-questions/)

- 
      [Data Science Interview Questions](https://www.interviewbit.com/data-science-interview-questions/)

- 
      [System Design Interview Questions](https://www.interviewbit.com/system-design-interview-questions/)

- 
      [Hr Interview Questions](https://www.interviewbit.com/hr-interview-questions/)

- 
      [Html Interview Questions](https://www.interviewbit.com/html-interview-questions/)

-

[C Interview Questions](https://www.interviewbit.com/c-interview-questions/)

- 
      [View All](https://www.interviewbit.com/technical-interview-questions/)

[Java Interview Questions](https://www.interviewbit.com/java-interview-questions/)
[Sql Interview Questions](https://www.interviewbit.com/sql-interview-questions/)
[Python Interview Questions](https://www.interviewbit.com/python-interview-questions/)
[Javascript Interview Questions](https://www.interviewbit.com/javascript-interview-questions/)
[Angular Interview Questions](https://www.interviewbit.com/angular-interview-questions/)
[Networking Interview Questions](https://www.interviewbit.com/networking-interview-questions/)
[Selenium Interview Questions](https://www.interviewbit.com/selenium-interview-questions/)
[Data Structure Interview Questions](https://www.interviewbit.com/data-structure-interview-questions/)
[Data Science Interview Questions](https://www.interviewbit.com/data-science-interview-questions/)
[System Design Interview Questions](https://www.interviewbit.com/system-design-interview-questions/)
[Hr Interview Questions](https://www.interviewbit.com/hr-interview-questions/)
[Html Interview Questions](https://www.interviewbit.com/html-interview-questions/)
[C Interview Questions](https://www.interviewbit.com/c-interview-questions/)
[View All](https://www.interviewbit.com/technical-interview-questions/)
- 
      [Amazon Interview Questions](https://www.interviewbit.com/amazon-interview-questions/)

- 
      [Facebook Interview Questions](https://www.interviewbit.com/facebook-interview-questions/)

- 
      [Google Interview Questions](https://www.interviewbit.com/google-interview-questions/)

- 
      [Tcs Interview Questions](https://www.interviewbit.com/tcs-interview-questions/)

- 
      [Accenture Interview Questions](https://www.interviewbit.com/accenture-interview-questions/)

- 
      [Infosys Interview Questions](https://www.interviewbit.com/infosys-interview-questions/)

- 
      [Capgemini Interview Questions](https://www.interviewbit.com/capgemini-interview-questions/)

- 
      [Wipro Interview Questions](https://www.interviewbit.com/wipro-interview-questions/)

- 
      [Cognizant Interview Questions](https://www.interviewbit.com/cognizant-interview-questions/)

- 
      [Deloitte Interview Questions](https://www.interviewbit.com/deloitte-interview-questions/)

- 
      [Zoho Interview Questions](https://www.interviewbit.com/zoho-interview-questions/)

- 
      [Hcl Interview Questions](https://www.interviewbit.com/hcl-interview-questions/)

- 
      [View All](https://www.interviewbit.com/technical-interview-questions/)

[Amazon Interview Questions](https://www.interviewbit.com/amazon-interview-questions/)
[Facebook Interview Questions](https://www.interviewbit.com/facebook-interview-questions/)
[Google Interview Questions](https://www.interviewbit.com/google-interview-questions/)
[Tcs Interview Questions](https://www.interviewbit.com/tcs-interview-questions/)
[Accenture Interview Questions](https://www.interviewbit.com/accenture-interview-questions/)
[Infosys Interview Questions](https://www.interviewbit.com/infosys-interview-questions/)
[Capgemini Interview Questions](https://www.interviewbit.com/capgemini-interview-questions/)
[Wipro Interview Questions](https://www.interviewbit.com/wipro-interview-questions/)
[Cognizant Interview Questions](https://www.interviewbit.com/cognizant-interview-questions/)
[Deloitte Interview Questions](https://www.interviewbit.com/deloitte-interview-questions/)
[Zoho Interview Questions](https://www.interviewbit.com/zoho-interview-questions/)
[Hcl Interview Questions](https://www.interviewbit.com/hcl-interview-questions/)
[View All](https://www.interviewbit.com/technical-interview-questions/)
- 
      [Highest Paying Jobs In India](https://www.interviewbit.com/blog/highest-paying-jobs-in-india/)

- 
      [Exciting C Projects Ideas With Source Code](https://www.interviewbit.com/blog/c-projects/)

- 
      [Top Java 8 Features](https://www.interviewbit.com/blog/java-8-features/)

- 
      [Angular Vs React](https://www.interviewbit.com/blog/angular-vs-react/)

- 
      [10 Best Data Structures And Algorithms Books](https://www.interviewbit.com/blog/data-structures-and-algorithms-books/)

- 
      [Exciting C Projects Ideas With Source Code](https://www.interviewbit.com/blog/c-projects/)

-

[Best Full Stack Developer Courses](https://www.interviewbit.com/blog/best-full-stack-developer-courses/)

- 
      [Best Data Science Courses](https://www.interviewbit.com/blog/best-data-science-courses/)

- 
      [Python Commands List](https://www.interviewbit.com/blog/python-commands/)

- 
      [Data Scientist Salary](https://www.interviewbit.com/blog/data-scientist-salary/)

- 
      [Maximum Subarray Sum   Kadane’s Algorithm](https://www.interviewbit.com/blog/maximum-subarray-sum/)

- 
      [View All](https://www.interviewbit.com/blog/)

[Highest Paying Jobs In India](https://www.interviewbit.com/blog/highest-paying-jobs-in-india/)
[Exciting C Projects Ideas With Source Code](https://www.interviewbit.com/blog/c-projects/)
[Top Java 8 Features](https://www.interviewbit.com/blog/java-8-features/)
[Angular Vs React](https://www.interviewbit.com/blog/angular-vs-react/)
[10 Best Data Structures And Algorithms Books](https://www.interviewbit.com/blog/data-structures-and-algorithms-books/)
[Exciting C Projects Ideas With Source Code](https://www.interviewbit.com/blog/c-projects/)
[Best Full Stack Developer Courses](https://www.interviewbit.com/blog/best-full-stack-developer-courses/)
[Best Data Science Courses](https://www.interviewbit.com/blog/best-data-science-courses/)
[Python Commands List](https://www.interviewbit.com/blog/python-commands/)
[Data Scientist Salary](https://www.interviewbit.com/blog/data-scientist-salary/)
[Maximum Subarray Sum   Kadane’s Algorithm](https://www.interviewbit.com/blog/maximum-subarray-sum/)
[View All](https://www.interviewbit.com/blog/)
- 
      [Python Cheat Sheet](https://www.interviewbit.com/python-cheat-sheet/)

- 
      [C++ Cheat Sheet](https://www.interviewbit.com/cpp-cheat-sheet/)

- 
      [Javascript Cheat Sheet](https://www.interviewbit.com/javascript-cheat-sheet/)

- 
      [Git Cheat Sheet](https://www.interviewbit.com/git-cheat-sheet/)

- 
      [Java Cheat Sheet](https://www.interviewbit.com/java-cheat-sheet/)

- 
      [View All](https://www.interviewbit.com/technical-interview-questions/)

[Python Cheat Sheet](https://www.interviewbit.com/python-cheat-sheet/)
[C++ Cheat Sheet](https://www.interviewbit.com/cpp-cheat-sheet/)
[Javascript Cheat Sheet](https://www.interviewbit.com/javascript-cheat-sheet/)
[Git Cheat Sheet](https://www.interviewbit.com/git-cheat-sheet/)
[Java Cheat Sheet](https://www.interviewbit.com/java-cheat-sheet/)
[View All](https://www.interviewbit.com/technical-interview-questions/)
- 
      [Java Mcq](https://www.interviewbit.com/java-mcq/)

- 
      [Data Structure Mcq](https://www.interviewbit.com/data-structure-mcq/)

- 
      [Dbms Mcq](https://www.interviewbit.com/dbms-mcq/)

- 
      [C Programming Mcq](https://www.interviewbit.com/c-programming-mcq/)

- 
      [C++ Mcq](https://www.interviewbit.com/cpp-mcq/)

- 
      [Python Mcq](https://www.interviewbit.com/python-mcq/)

- 
      [Javascript Mcq](https://www.interviewbit.com/javascript-mcq/)

- 
      [View All](https://www.interviewbit.com/technical-interview-questions/)

[Java Mcq](https://www.interviewbit.com/java-mcq/)
[Data Structure Mcq](https://www.interviewbit.com/data-structure-mcq/)
[Dbms Mcq](https://www.interviewbit.com/dbms-mcq/)
[C Programming Mcq](https://www.interviewbit.com/c-programming-mcq/)
[C++ Mcq](https://www.interviewbit.com/cpp-mcq/)
[Python Mcq](https://www.interviewbit.com/python-mcq/)
[Javascript Mcq](https://www.interviewbit.com/javascript-mcq/)
[View All](https://www.interviewbit.com/technical-interview-questions/)
1 Million +
500 +
100 +
[Change Number](https://www.interviewbit.com/spring-interview-questions)

---
