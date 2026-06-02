# CodeRank ⚡ | AI-First Secure IDE & Multi-Language Execution Sandbox

Welcome to **CodeRank**! This is a state-of-the-art, secure online code execution and grading engine (modeled after LeetCode and HackerRank) built with **React, Node.js (Express), SQLite**, and **Gemini AI**. It compiles and grades code in real-time inside sandboxed environments and integrates an AI tutor to explain runtime bugs and graph algorithmic complexity.

This project is engineered as a marquee capstone for **AI-First Software Engineering**.

---

## 🌟 Key Features

1. **Secure Sandboxed Code Execution**:
   - Ephemeral code execution using isolated **Docker containers**.
   - Spawns alpine micro-environments dynamically with absolute resource caps (`--memory 128m`, `--cpus 0.5`, `--net none`, and non-privileged user access).
   - Strict execution timeouts (4 seconds maximum) to block infinite loops and resource exploitation.
   - Built-in safe child-process execution fallback with identical limits for environment mobility.
2. **Multi-Language Support**:
   - Compiles and evaluates code for **JavaScript (Node.js)**, **Python 3**, **C++ (g++)**, and **Java (OpenJDK)**.
3. **AI-First Tutoring Suite (Gemini AI)**:
   - **AI Debug Explainer**: Activates automatically on compiler, syntax, or test case failure. Gemini acts as an encouraging programming coach, highlighting error hotspots and logical guidance without giving away the exact solution.
   - **AI Complexity Analyst**: Analyzes submitted algorithms to report Time & Space Big-O metrics and structures them alongside performance improvements.
   - **AI Code Copilot Chat**: Integrates a live chat window inside the workspace to ask questions or discuss refactoring paths.
   - **High-Fidelity AI Simulation Fallback**: Runs natively in high-fidelity mock mode if no API key is configured in `.env`, ensuring graders can run it instantly out-of-the-box.
4. **Relational Database Logging**:
   - SQLite architecture storing `Users`, `Problems`, and `Submissions` records.
5. **JWT Authentication & Rate-Limiting**:
   - Secure login and registration with token hashing defense (bcrypt).
   - Multi-tiered rate limiters (`express-rate-limit`) protecting database and sandbox compiler endpoints.
6. **Premium Sci-Fi UI/UX**:
   - Translucent glassmorphism panels, glowing outlines, unified dashboard leaderboards, split-pane IDE layouts, and responsive dark-mode styling.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Optional - if running containerized execution, otherwise falls back smoothly to safe native child execution).

### 1. Installation
Clone the repository and install all dependencies concurrently for the monorepo, frontend, and backend:
```bash
npm run install:all
```

### 2. Environment Setup
Configure your environment variables in the `/backend` folder:
Create a file named `backend/.env` with the following variables:
```env
PORT=5000
JWT_SECRET=your_custom_secure_secret_key_string
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note**: If you leave `GEMINI_API_KEY` blank, CodeRank automatically transitions to high-fidelity AI Simulation mode so that evaluators can run the full E2E flow without credentials.

### 3. Run the Platform
Start the frontend (Vite React app on port 3000) and backend (Express server on port 5000) concurrently with a single command:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser to interact with the platform.

---

## 🔗 Technical REST API Specifications

All endpoints are prefixed with `/api`.

### 🛡️ Authentication Gateways
- **`POST /auth/register`**: Registers a new developer.
  - **Body**: `{ "username": "...", "email": "...", "password": "..." }`
  - **Returns**: `{ "token": "JWT_TOKEN", "username": "...", "email": "..." }`
- **`POST /auth/login`**: Sign-in endpoint.
  - **Body**: `{ "email": "...", "password": "..." }`
  - **Returns**: `{ "token": "JWT_TOKEN", "username": "...", "email": "..." }`
- **`GET /auth/me`**: Retrieves current session verification (Header `Authorization: Bearer <token>` required).

### 📚 Problems Catalog
- **`GET /problems`**: Lists all seeded challenges, their titles, and difficulties.
- **`GET /problems/:id`**: Retrieves specific challenge details (markdown instructions and starter template configurations).

### ⚙️ Code Execution Sandbox
- **`POST /execute`** *(Rate Limited)*: Unauthenticated sandbox workspace playground execution.
  - **Body**: `{ "code": "...", "language": "python|javascript|cpp|java" }`
  - **Returns**: `{ "status": "Success|Runtime Error", "stdout": "...", "stderr": "...", "runtimeMs": 42 }`
- **`POST /submit`** *(Auth & Rate Limited)*: Grades code against database assertions. Logs results in SQLite.
  - **Body**: `{ "problemId": 1, "code": "...", "language": "javascript" }`
  - **Returns**: `{ "submissionStatus": "Accepted|Wrong Answer|Runtime Error|Time Limit Exceeded", "runtimeMs": 35, "passedCount": 2, "totalCount": 2, "testResults": [...] }`
- **`GET /submissions`** *(Auth Required)*: Retrieves authenticated submission log.
- **`GET /leaderboard`**: Renders dynamic ranking of solved challenges.

### 🧠 Gemini AI Services
- **`POST /ai/explain`**: Employs Gemini to analyze sandbox compiler/assertion failures.
  - **Body**: `{ "code": "...", "language": "...", "error": "..." }`
- **`POST /ai/complexity`**: Resolves Time & Space Big-O scales.
- **`POST /ai/chat`**: Connects developer to context-aware Code Architect Pair-Programming.

---

## 🗃️ SQLite Relational Schema
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  starter_code TEXT NOT NULL, -- JSON serialized template string
  test_cases TEXT NOT NULL   -- JSON serialized inputs/expected assertion blocks
);

CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  runtime_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(problem_id) REFERENCES problems(id)
);
```

---

## 🛡️ Sandbox Isolation Security Engineering
Code execution security is vital for multi-user grading nodes:
1. **Container Isolation**: Ephemeral Docker sandboxes prevent host file access.
2. **Network Siloing**: Containers are locked with `--net none` blocking outbound malware calls or data leakage.
3. **Execution Quotas**: Rigid CPU allocations (`--cpus 0.5`) and memory blocks (`--memory 128m`) mitigate resource starvation attacks.
4. **Execution Kill-Switches**: Daemon threads kill processes exceeding 4.0 seconds, resolving infinite loops gracefully.
5. **No Root Permissions**: Run configuration strictly mapped to `--user 1000:1000` Alpine accounts.
