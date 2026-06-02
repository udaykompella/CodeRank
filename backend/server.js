const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { initDb, dbRun, dbAll, dbGet } = require('./database');
const { hashPassword, comparePassword, generateToken, authenticateToken } = require('./auth');
const { executeCode } = require('./codeRunner');
const { explainError, analyzeComplexity, chatCopilot } = require('./gemini');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing and JSON Body Parsing
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// Security Rate Limiters
// ----------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' }
});

const executionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Limit executions to 15 per minute to prevent system resource abuse
  message: { error: 'Rate limit exceeded. You can only execute code 15 times per minute.' }
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit AI questions to 10 per minute
  message: { error: 'AI limit exceeded. You can query the AI assistant 10 times per minute.' }
});

app.use('/api/', apiLimiter);

// ----------------------------------------------------
// Authentication Routes
// ----------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields (username, email, password) are required.' });
  }

  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already registered.' });
    }

    const passwordHash = hashPassword(password);
    const result = await dbRun(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const token = generateToken({ id: result.lastID, username, email });
    res.status(201).json({ token, username, email });
  } catch (err) {
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !comparePassword(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({ token, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

// Returns authentication verify status
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// Coding Challenge catalog Routes
// ----------------------------------------------------
app.get('/api/problems', async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, title, difficulty FROM problems');
    // Map them for clean JSON deliveries
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve problems: ${err.message}` });
  }
});

app.get('/api/problems/:id', async (req, res) => {
  try {
    const row = await dbGet('SELECT id, title, description, difficulty, starter_code, function_name, param_names FROM problems WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).json({ error: 'Coding challenge not found.' });
    }
    
    // Parse the JSON string of starter templates
    row.starter_code = JSON.parse(row.starter_code);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve problem: ${err.message}` });
  }
});

// Admin Route: Add a custom coding challenge dynamically
app.post('/api/problems', authenticateToken, async (req, res) => {
  const { title, description, difficulty, functionName, paramNames, starterCode, testCases } = req.body;

  if (!title || !description || !difficulty || !functionName || !paramNames || !starterCode || !testCases) {
    return res.status(400).json({ error: 'All fields (title, description, difficulty, functionName, paramNames, starterCode, testCases) are required.' });
  }

  try {
    const starterStr = typeof starterCode === 'string' ? starterCode : JSON.stringify(starterCode);
    const testCasesStr = typeof testCases === 'string' ? testCases : JSON.stringify(testCases);
    const paramsStr = typeof paramNames === 'string' ? paramNames : JSON.stringify(paramNames);

    await dbRun(
      'INSERT INTO problems (title, description, difficulty, starter_code, test_cases, function_name, param_names) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, difficulty, starterStr, testCasesStr, functionName, paramsStr]
    );

    res.status(201).json({ message: 'Coding challenge published dynamically!' });
  } catch (err) {
    res.status(500).json({ error: `Failed to create challenge: ${err.message}` });
  }
});

// ----------------------------------------------------
// Secure Isolated Execution Engines
// ----------------------------------------------------
app.post('/api/execute', executionLimiter, async (req, res) => {
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Code content and programming language are required.' });
  }

  try {
    const executionResult = await executeCode(code, language);
    res.json(executionResult);
  } catch (err) {
    res.status(500).json({ error: `Sandboxed execution failed: ${err.message}` });
  }
});

app.post('/api/submit', authenticateToken, executionLimiter, async (req, res) => {
  const { problemId, code, language } = req.body;
  const userId = req.user.id;

  if (!problemId || !code || !language) {
    return res.status(400).json({ error: 'Problem ID, code content, and programming language are required.' });
  }

  try {
    // Retrieve target problem structure
    const problem = await dbGet('SELECT * FROM problems WHERE id = ?', [problemId]);
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const testCases = JSON.parse(problem.test_cases);
    const executionResult = await executeCode(code, language, problem, testCases);

    const status = executionResult.status;
    const runtimeMs = executionResult.runtimeMs || 0;
    const errorMsg = executionResult.error || null;

    // Log the submission history inside SQLite relational database
    await dbRun(
      'INSERT INTO submissions (user_id, problem_id, language, code, status, runtime_ms, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, problemId, language, code, status, runtimeMs, errorMsg]
    );

    res.json({
      submissionStatus: status,
      runtimeMs,
      error: errorMsg,
      passedCount: executionResult.passedCount || 0,
      totalCount: executionResult.totalCount || 0,
      testResults: executionResult.testResults || []
    });
  } catch (err) {
    res.status(500).json({ error: `Submission evaluation crashed: ${err.message}` });
  }
});

// Retrieves submission histories for dashboard
app.get('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT s.id, s.problem_id, p.title as problem_title, s.language, s.status, s.runtime_ms, s.created_at 
      FROM submissions s 
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ? 
      ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: `Retrieval failed: ${err.message}` });
  }
});

// Gamified Leaderboard metrics
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT u.username, COUNT(DISTINCT s.problem_id) as solved_count, MAX(s.created_at) as last_active
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'Accepted'
      GROUP BY u.id
      ORDER BY solved_count DESC, last_active ASC
      LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: `Failed to construct leaderboard: ${err.message}` });
  }
});

// ----------------------------------------------------
// AI Assistance Routes
// ----------------------------------------------------
app.post('/api/ai/explain', aiLimiter, async (req, res) => {
  const { code, language, error, stdout, stderr } = req.body;
  
  if (!code || !language) {
    return res.status(400).json({ error: 'Code contents and language are required to prompt the AI Tutor.' });
  }

  try {
    const aiExplanation = await explainError(code, language, error, stdout, stderr);
    res.json({ explanation: aiExplanation });
  } catch (err) {
    res.status(500).json({ error: `AI Tutor failed to analyze: ${err.message}` });
  }
});

app.post('/api/ai/complexity', aiLimiter, async (req, res) => {
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Code content and language are required.' });
  }

  try {
    const evaluation = await analyzeComplexity(code, language);
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ error: `AI Complexity analyst failed: ${err.message}` });
  }
});

app.post('/api/ai/chat', aiLimiter, async (req, res) => {
  const { code, language, chatHistory, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  try {
    const responseText = await chatCopilot(code || '', language || 'javascript', chatHistory || [], message);
    res.json({ reply: responseText });
  } catch (err) {
    res.status(500).json({ error: `AI Copilot failed to reply: ${err.message}` });
  }
});

// ----------------------------------------------------
// Production Static File Serving
// ----------------------------------------------------
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Fallback all non-API wildcard routes to index.html for React SPA Router
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ----------------------------------------------------
// Master Startup Sequences
// ----------------------------------------------------
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 CodeRank Backend API is live on: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}).catch(dbErr => {
  console.error('Critical database boot crash:', dbErr.message);
});
