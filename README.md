# 🔍 FakeRadar — AI-Powered Fake News Detector

> A full-stack application that analyzes articles and web content for misinformation, credibility scoring, and fact-checking using AI/NLP.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                        │
│              Paste URL / Text → View Results                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST
┌──────────────────────────▼──────────────────────────────────┐
│              MAIN SERVER — Java Spring Boot                  │
│  - Auth, Users, History, Orchestration, DB (PostgreSQL)      │
│  - Calls AI Server internally via REST                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST (internal)
┌──────────────────────────▼──────────────────────────────────┐
│               AI SERVER — Python FastAPI                     │
│  - NLP Pipeline, Claim Extraction, Credibility Scoring       │
│  - LLM Integration (Claude / OpenAI), Fact-Check API         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Repository Structure

```
fakeradar/
├── fakeradar-api/          # Spring Boot main server
│   ├── src/
│   │   └── main/java/com/fakeradar/
│   │       ├── controller/
│   │       ├── service/
│   │       ├── repository/
│   │       ├── model/
│   │       ├── dto/
│   │       └── config/
│   ├── pom.xml
│   └── application.yml
│
├── fakeradar-ai/           # FastAPI AI server
│   ├── app/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── models/
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── fakeradar-frontend/     # React frontend
│   ├── src/
│   └── package.json
│
└── docker-compose.yml
```

---

## 🔁 Request Flow

1. User submits a URL or raw article text via the React frontend.
2. Frontend sends a `POST /api/analyses` to the **Spring Boot** server.
3. Spring Boot validates the request, saves a pending record, then calls the **FastAPI** AI server at `POST /ai/analyze`.
4. FastAPI:
   - Scrapes the URL (if provided)
   - Extracts key claims via NLP
   - Scores credibility via LLM
   - Fact-checks claims against external APIs
5. FastAPI returns an `AnalysisResult` JSON to Spring Boot.
6. Spring Boot persists the result and returns it to the frontend.
7. Frontend renders the dashboard with scores, claims, and verdict.

---

## 🧩 Core Entities

### `Analysis`

| Field              | Type         | Description                      |
| ------------------ | ------------ | -------------------------------- |
| `id`               | UUID         | Primary key                      |
| `userId`           | UUID         | FK to User                       |
| `inputUrl`         | String       | Source URL (nullable)            |
| `inputText`        | String       | Raw article text                 |
| `credibilityScore` | Float        | 0.0 – 1.0                        |
| `verdict`          | Enum         | `RELIABLE`, `SUSPICIOUS`, `FAKE` |
| `claims`           | List<Claim>  | Extracted factual claims         |
| `sources`          | List<Source> | Cross-referenced sources         |
| `createdAt`        | Timestamp    | Analysis timestamp               |

### `Claim`

| Field        | Type    | Description                 |
| ------------ | ------- | --------------------------- |
| `id`         | UUID    | Primary key                 |
| `analysisId` | UUID    | FK to Analysis              |
| `text`       | String  | The claim sentence          |
| `isVerified` | Boolean | Whether verified            |
| `confidence` | Float   | Confidence score            |
| `sourceUrl`  | String  | Supporting/debunking source |

### `User`

| Field          | Type      | Description       |
| -------------- | --------- | ----------------- |
| `id`           | UUID      | Primary key       |
| `email`        | String    | Unique email      |
| `passwordHash` | String    | Bcrypt hash       |
| `createdAt`    | Timestamp | Registration date |

---

## 🌐 API Contracts

### Spring Boot → Frontend

| Method   | Endpoint             | Description                 |
| -------- | -------------------- | --------------------------- |
| `POST`   | `/api/analyses`      | Submit article for analysis |
| `GET`    | `/api/analyses/{id}` | Get analysis by ID          |
| `GET`    | `/api/analyses`      | List user's analyses        |
| `DELETE` | `/api/analyses/{id}` | Delete analysis             |
| `POST`   | `/api/auth/register` | Register user               |
| `POST`   | `/api/auth/login`    | Login, return JWT           |
| `GET`    | `/api/users/me`      | Get current user profile    |

### Spring Boot → FastAPI (internal)

| Method | Endpoint      | Description                |
| ------ | ------------- | -------------------------- |
| `POST` | `/ai/analyze` | Run full analysis pipeline |
| `GET`  | `/ai/health`  | Health check               |

---

## ⚙️ Environment Variables

### Spring Boot (`application.yml`)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/fakeradar
    username: ${DB_USER}
    password: ${DB_PASS}

ai:
  server:
    url: ${AI_SERVER_URL:http://localhost:8000}

jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000
```

### FastAPI (`.env`)

```env
LLM_PROVIDER=anthropic         # or openai
LLM_API_KEY=your_key_here
FACT_CHECK_API_KEY=your_key
SERPER_API_KEY=your_key        # for web search
MAIN_SERVER_SECRET=shared_secret
```

---

## 🐳 Running with Docker Compose

```bash
docker-compose up --build
```

Services:

- `fakeradar-api` → port `8080`
- `fakeradar-ai` → port `8000`
- `postgres` → port `5432`
- `fakeradar-frontend` → port `3000`

---

## 👥 Team Responsibilities

| Member   | Area                                                      |
| -------- | --------------------------------------------------------- |
| Person 1 | React frontend — UI, dashboard, results visualization     |
| Person 2 | Spring Boot — Auth, user management, DB, orchestration    |
| Person 3 | FastAPI — NLP pipeline, LLM integration, claim extraction |
| Person 4 | FastAPI — Fact-check engine, source reputation, scoring   |

---

## 🛠️ Tech Stack

| Layer            | Technology                                   |
| ---------------- | -------------------------------------------- |
| Frontend         | React, TailwindCSS, Axios                    |
| Main Server      | Java 17, Spring Boot 3, Spring Security, JPA |
| AI Server        | Python 3.11, FastAPI, LangChain, spaCy       |
| Database         | PostgreSQL 15                                |
| LLM              | Anthropic Claude API / OpenAI                |
| Fact-Check       | Google Fact Check Tools API                  |
| Web Search       | Serper API / SerpAPI                         |
| Scraping         | BeautifulSoup4, httpx                        |
| Containerization | Docker, Docker Compose                       |
