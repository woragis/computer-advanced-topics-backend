# ☕ FakeRadar Main Server — Spring Boot Skeleton Guide

> Java 17 + Spring Boot 3 server handling auth, user management, persistence, and orchestration. Communicates internally with the FastAPI AI server.

---

## 📁 Project Structure

```
fakeradar-api/
├── src/main/java/com/fakeradar/
│   ├── FakeradarApplication.java
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── WebClientConfig.java      # HttpClient for FastAPI calls
│   │   └── JwtConfig.java
│   ├── controller/
│   │   ├── AnalysisController.java
│   │   ├── AuthController.java
│   │   └── UserController.java
│   ├── service/
│   │   ├── AnalysisService.java
│   │   ├── AiServerClient.java       # Calls FastAPI internally
│   │   ├── AuthService.java
│   │   └── UserService.java
│   ├── repository/
│   │   ├── AnalysisRepository.java
│   │   ├── ClaimRepository.java
│   │   └── UserRepository.java
│   ├── model/
│   │   ├── Analysis.java
│   │   ├── Claim.java
│   │   └── User.java
│   ├── dto/
│   │   ├── request/
│   │   │   ├── AnalysisRequestDto.java
│   │   │   ├── LoginRequestDto.java
│   │   │   └── RegisterRequestDto.java
│   │   └── response/
│   │       ├── AnalysisResponseDto.java
│   │       ├── ClaimResponseDto.java
│   │       └── AuthResponseDto.java
│   └── exception/
│       ├── GlobalExceptionHandler.java
│       └── ResourceNotFoundException.java
├── src/main/resources/
│   └── application.yml
└── pom.xml
```

---

## ⚡ Quickstart

### Prerequisites

- Java 17+
- Maven 3.9+
- PostgreSQL 15 running locally (or via Docker)

### 1. Create the database

```sql
CREATE DATABASE fakeradar;
CREATE USER fakeradar_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE fakeradar TO fakeradar_user;
```

### 2. Configure application.yml

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/fakeradar
    username: ${DB_USER:fakeradar_user}
    password: ${DB_PASS:yourpassword}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update # use 'validate' in production
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect

ai:
  server:
    url: ${AI_SERVER_URL:http://localhost:8000}

jwt:
  secret: ${JWT_SECRET:change-me-in-production-use-long-random-string}
  expiration: 86400000 # 24 hours in ms

server:
  port: 8080
```

### 3. Run

```bash
cd fakeradar-api
mvn spring-boot:run
```

---

## 📦 pom.xml — Key Dependencies

```xml
<dependencies>
    <!-- Spring Boot -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Database -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- JWT -->
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.12.5</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>0.12.5</version>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>0.12.5</version>
        <scope>runtime</scope>
    </dependency>

    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>

    <!-- Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## 🗄️ Models (Entities)

### model/User.java

```java
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Analysis> analyses = new ArrayList<>();
}
```

---

### model/Analysis.java

```java
@Entity
@Table(name = "analyses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Analysis {

    public enum Verdict { RELIABLE, SUSPICIOUS, FAKE }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String inputUrl;

    @Column(columnDefinition = "TEXT")
    private String inputText;

    private Float credibilityScore;

    @Enumerated(EnumType.STRING)
    private Verdict verdict;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @OneToMany(mappedBy = "analysis", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Claim> claims = new ArrayList<>();

    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

---

### model/Claim.java

```java
@Entity
@Table(name = "claims")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Claim {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private Analysis analysis;

    @Column(columnDefinition = "TEXT")
    private String text;

    private Boolean isVerified;
    private Float confidence;
    private String sourceUrl;
}
```

---

## 📬 DTOs

### dto/request/AnalysisRequestDto.java

```java
@Data
public class AnalysisRequestDto {

    @Pattern(regexp = "https?://.*", message = "Must be a valid URL")
    private String url;

    @Size(min = 50, message = "Text must be at least 50 characters")
    private String text;

    // Validated at service level: at least one must be present
}
```

---

### dto/response/AnalysisResponseDto.java

```java
@Data
@Builder
public class AnalysisResponseDto {
    private UUID id;
    private String inputUrl;
    private Float credibilityScore;
    private String verdict;
    private String explanation;
    private List<ClaimResponseDto> claims;
    private LocalDateTime createdAt;
}
```

---

### dto/response/ClaimResponseDto.java

```java
@Data
@Builder
public class ClaimResponseDto {
    private UUID id;
    private String text;
    private Boolean isVerified;
    private Float confidence;
    private String sourceUrl;
}
```

---

## 🛣️ Controllers

### controller/AnalysisController.java

```java
@RestController
@RequestMapping("/api/analyses")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

    // POST /api/analyses — Submit article for analysis
    @PostMapping
    public ResponseEntity<AnalysisResponseDto> createAnalysis(
            @Valid @RequestBody AnalysisRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        AnalysisResponseDto result = analysisService.analyze(request, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // GET /api/analyses/{id} — Get a single analysis
    @GetMapping("/{id}")
    public ResponseEntity<AnalysisResponseDto> getAnalysis(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {

        AnalysisResponseDto result = analysisService.getById(id, userDetails.getUsername());
        return ResponseEntity.ok(result);
    }

    // GET /api/analyses — List current user's analyses
    @GetMapping
    public ResponseEntity<List<AnalysisResponseDto>> listAnalyses(
            @AuthenticationPrincipal UserDetails userDetails) {

        List<AnalysisResponseDto> results = analysisService.listByUser(userDetails.getUsername());
        return ResponseEntity.ok(results);
    }

    // DELETE /api/analyses/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnalysis(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {

        analysisService.delete(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }
}
```

---

### controller/AuthController.java

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // POST /api/auth/register
    @PostMapping("/register")
    public ResponseEntity<AuthResponseDto> register(
            @Valid @RequestBody RegisterRequestDto request) {

        AuthResponseDto response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public ResponseEntity<AuthResponseDto> login(
            @Valid @RequestBody LoginRequestDto request) {

        AuthResponseDto response = authService.login(request);
        return ResponseEntity.ok(response);
    }
}
```

---

### controller/UserController.java

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // GET /api/users/me
    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {

        UserResponseDto profile = userService.getProfile(userDetails.getUsername());
        return ResponseEntity.ok(profile);
    }
}
```

---

## ⚙️ Services

### service/AnalysisService.java

```java
@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisRepository analysisRepository;
    private final UserRepository userRepository;
    private final ClaimRepository claimRepository;
    private final AiServerClient aiServerClient;

    public AnalysisResponseDto analyze(AnalysisRequestDto request, String email) {
        if (request.getUrl() == null && request.getText() == null) {
            throw new IllegalArgumentException("Provide 'url' or 'text'");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Call the AI server
        AiAnalysisResult aiResult = aiServerClient.analyze(request);

        // Persist analysis
        Analysis analysis = Analysis.builder()
                .user(user)
                .inputUrl(request.getUrl())
                .inputText(aiResult.getRawText())
                .credibilityScore(aiResult.getCredibilityScore())
                .verdict(Analysis.Verdict.valueOf(aiResult.getVerdict()))
                .explanation(aiResult.getExplanation())
                .build();

        Analysis saved = analysisRepository.save(analysis);

        // Persist claims
        List<Claim> claims = aiResult.getClaims().stream()
                .map(c -> Claim.builder()
                        .analysis(saved)
                        .text(c.getText())
                        .isVerified(c.getIsVerified())
                        .confidence(c.getConfidence())
                        .sourceUrl(c.getSourceUrl())
                        .build())
                .toList();

        claimRepository.saveAll(claims);
        saved.setClaims(claims);

        return toDto(saved);
    }

    public AnalysisResponseDto getById(UUID id, String email) {
        Analysis analysis = analysisRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis not found"));

        if (!analysis.getUser().getEmail().equals(email)) {
            throw new AccessDeniedException("Not your analysis");
        }

        return toDto(analysis);
    }

    public List<AnalysisResponseDto> listByUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return analysisRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(this::toDto).toList();
    }

    public void delete(UUID id, String email) {
        Analysis analysis = analysisRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis not found"));

        if (!analysis.getUser().getEmail().equals(email)) {
            throw new AccessDeniedException("Not your analysis");
        }

        analysisRepository.delete(analysis);
    }

    private AnalysisResponseDto toDto(Analysis a) {
        return AnalysisResponseDto.builder()
                .id(a.getId())
                .inputUrl(a.getInputUrl())
                .credibilityScore(a.getCredibilityScore())
                .verdict(a.getVerdict() != null ? a.getVerdict().name() : null)
                .explanation(a.getExplanation())
                .claims(a.getClaims().stream().map(c ->
                        ClaimResponseDto.builder()
                                .id(c.getId())
                                .text(c.getText())
                                .isVerified(c.getIsVerified())
                                .confidence(c.getConfidence())
                                .sourceUrl(c.getSourceUrl())
                                .build()
                ).toList())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
```

---

### service/AiServerClient.java

```java
@Service
public class AiServerClient {

    private final RestTemplate restTemplate;
    private final String aiServerUrl;

    public AiServerClient(RestTemplateBuilder builder,
                          @Value("${ai.server.url}") String aiServerUrl) {
        this.restTemplate = builder.build();
        this.aiServerUrl = aiServerUrl;
    }

    public AiAnalysisResult analyze(AnalysisRequestDto request) {
        String url = aiServerUrl + "/ai/analyze";

        try {
            ResponseEntity<AiAnalysisResult> response = restTemplate.postForEntity(
                    url, request, AiAnalysisResult.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("AI server returned error: " + response.getStatusCode());
            }

            return response.getBody();

        } catch (Exception e) {
            throw new RuntimeException("Failed to reach AI server: " + e.getMessage(), e);
        }
    }
}
```

---

## 🔐 Security Skeleton

### config/SecurityConfig.java

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/ai/**").permitAll()      // internal only — add IP filter in prod
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}
```

---

## 🚨 Exception Handler

### exception/GlobalExceptionHandler.java

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Access denied"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Internal server error"));
    }
}
```

---

## 🐳 Dockerfile

```dockerfile
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 📋 Quick Checklist

- [ ] PostgreSQL running and credentials set in `application.yml`
- [ ] FastAPI AI server running on port `8000`
- [ ] `AI_SERVER_URL` env var configured
- [ ] `JWT_SECRET` set (min 32 chars in production)
- [ ] Tables auto-created on first run (`ddl-auto: update`)
- [ ] Test auth endpoints with Postman: register → login → get token → use token
- [ ] Test analysis flow: POST `/api/analyses` with a valid news URL
