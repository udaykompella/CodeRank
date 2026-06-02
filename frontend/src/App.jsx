import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Play, Send, Brain, Cpu, Database, Award, 
  User as UserIcon, LogOut, ChevronRight, MessageSquare, 
  HelpCircle, RefreshCw, X, ShieldAlert, Sparkles, BookOpen, Clock, PlusCircle
} from 'lucide-react';

export default function App() {
  // Navigation & User Session
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'auth' | 'dashboard' | 'workspace' | 'admin'
  
  // Auth state
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Data
  const [problems, setProblems] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Workspace / IDE state
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('description'); // 'description' | 'history'
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [submissionHistory, setSubmissionHistory] = useState([]);
  
  // Execution Console State
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleStatus, setConsoleStatus] = useState(''); // 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compile Error' | 'Tle'
  const [consoleStdout, setConsoleStdout] = useState('');
  const [consoleStderr, setConsoleStderr] = useState('');
  const [consoleRuntime, setConsoleRuntime] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [totalTestCases, setTotalTestCases] = useState(0);
  const [passedTestCases, setPassedTestCases] = useState(0);

  // AI Drawer State
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiActiveTab, setAiActiveTab] = useState('tutor'); // 'tutor' | 'complexity' | 'chat'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTutorExplanation, setAiTutorExplanation] = useState('');
  
  // Complexity analysis
  const [complexityData, setComplexityData] = useState(null);

  // Copilot Chat state
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', content: "Hi! I'm your AI Code Architect. Stuck on this challenge? Click a Quick-Action chip below to optimize or generate code instantly, or type your question below!" }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Admin / Challenge Creator State
  const [adminTitle, setAdminTitle] = useState('');
  const [adminDifficulty, setAdminDifficulty] = useState('Easy');
  const [adminDescription, setAdminDescription] = useState('');
  const [adminFunctionName, setAdminFunctionName] = useState('');
  const [adminParamNames, setAdminParamNames] = useState('');
  const [adminStarterJs, setAdminStarterJs] = useState('');
  const [adminStarterPy, setAdminStarterPy] = useState('');
  const [adminTestCases, setAdminTestCases] = useState([{ input: '', expected: '' }]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  // Local helper for API headers
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // ----------------------------------------------------
  // Authentication Actions
  // ----------------------------------------------------
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUserProfile();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/auth/me', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setToken('');
      }
    } catch {
      setToken('');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = authMode === 'login' 
      ? { email: emailInput, password: passwordInput }
      : { username: usernameInput, email: emailInput, password: passwordInput };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
      } else {
        setToken(data.token);
        setCurrentScreen('dashboard');
        // Clear forms
        setUsernameInput('');
        setEmailInput('');
        setPasswordInput('');
      }
    } catch (err) {
      setAuthError('Connection server error. Is backend running?');
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentScreen('dashboard');
  };

  // ----------------------------------------------------
  // Dashboard & Challenges Loading
  // ----------------------------------------------------
  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      const probRes = await fetch('/api/problems');
      const probs = await probRes.json();
      setProblems(probs);

      const leadRes = await fetch('/api/leaderboard');
      const leads = await leadRes.json();
      setLeaderboard(leads);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (currentScreen === 'dashboard') {
      fetchDashboardData();
    }
  }, [currentScreen]);

  // ----------------------------------------------------
  // IDE & Code execution
  // ----------------------------------------------------
  const openWorkspace = async (problem) => {
    setConsoleStdout('');
    setConsoleStderr('');
    setConsoleStatus('');
    setConsoleRuntime(null);
    setTestResults([]);
    setComplexityData(null);
    setAiTutorExplanation('');
    setAiDrawerOpen(false);

    try {
      const res = await fetch(`/api/problems/${problem.id}`);
      const data = await res.json();
      setSelectedProblem(data);
      setCurrentScreen('workspace');
      
      // Auto-set code based on selected language
      const lang = selectedLanguage.toLowerCase();
      setCode(data.starter_code[lang] || '');
      
      if (token) {
        fetchSubmissionHistory(problem.id);
      }
    } catch (err) {
      console.error('Failed to load problem:', err);
    }
  };

  const fetchSubmissionHistory = async (problemId) => {
    try {
      const res = await fetch('/api/submissions', { headers: getHeaders() });
      if (res.ok) {
        const history = await res.json();
        const filtered = history.filter(h => h.problem_id === problemId);
        setSubmissionHistory(filtered);
      }
    } catch (err) {
      console.error('Failed to load submission history:', err);
    }
  };

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    if (selectedProblem) {
      setCode(selectedProblem.starter_code[lang.toLowerCase()] || '');
    }
  };

  const runCode = async () => {
    if (consoleLoading) return;
    setConsoleLoading(true);
    setConsoleStatus('');
    setConsoleStdout('Running playground environment execution...');
    setConsoleStderr('');
    setConsoleRuntime(null);
    setTestResults([]);

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: selectedLanguage })
      });
      const data = await res.json();
      if (!res.ok) {
        setConsoleStatus('Runtime Error');
        setConsoleStderr(data.error || 'Server error during playground run.');
      } else {
        setConsoleStatus(data.status);
        setConsoleStdout(data.stdout || '');
        setConsoleStderr(data.stderr || data.error || '');
        setConsoleRuntime(data.runtimeMs);
      }
    } catch (err) {
      setConsoleStatus('Runtime Error');
      setConsoleStderr('Failed to connect to executor socket. Verify backend.');
    } finally {
      setConsoleLoading(false);
    }
  };

  const submitCode = async () => {
    if (!token) {
      setAuthMode('login');
      setCurrentScreen('auth');
      return;
    }
    if (consoleLoading) return;
    setConsoleLoading(true);
    setConsoleStatus('');
    setConsoleStdout('Compiling and submitting to isolated sandbox engine...');
    setConsoleStderr('');
    setConsoleRuntime(null);
    setTestResults([]);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          problemId: selectedProblem.id, 
          code, 
          language: selectedLanguage 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setConsoleStatus('Runtime Error');
        setConsoleStderr(data.error || 'Server assertion error.');
      } else {
        setConsoleStatus(data.submissionStatus);
        setConsoleStdout(data.stdout || '');
        setConsoleStderr(data.error || data.stderr || '');
        setConsoleRuntime(data.runtimeMs);
        setTestResults(data.testResults || []);
        setTotalTestCases(data.totalCount || 0);
        setPassedTestCases(data.passedCount || 0);

        // Fetch refreshed history logs
        fetchSubmissionHistory(selectedProblem.id);

        // If code execution failed, automatically prompt the AI Tutor in the background!
        if (data.submissionStatus !== 'Accepted') {
          triggerAiTutor(data.error || data.stderr, data.stdout);
        }
      }
    } catch (err) {
      setConsoleStatus('Runtime Error');
      setConsoleStderr('Connection lost to code grading core.');
    } finally {
      setConsoleLoading(false);
    }
  };

  // ----------------------------------------------------
  // Gemini AI Operations
  // ----------------------------------------------------
  const triggerAiTutor = async (errorText, stdoutText = '') => {
    setAiLoading(true);
    setAiTutorExplanation('AI Tutor is analyzing your codebase structure and errors...');
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
          error: errorText,
          stdout: stdoutText,
          stderr: errorText
        })
      });
      const data = await res.json();
      setAiTutorExplanation(data.explanation || 'Failed to generate tutor review.');
    } catch (err) {
      setAiTutorExplanation('AI tutor offline. Verify API configurations.');
    } finally {
      setAiLoading(false);
    }
  };

  const triggerComplexityCheck = async () => {
    setAiLoading(true);
    setComplexityData(null);
    try {
      const res = await fetch('/api/ai/complexity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: selectedLanguage })
      });
      const data = await res.json();
      setComplexityData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const triggerCopilotChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setAiLoading(true);

    try {
      // package last 5 messages to preserve thread structure
      const history = chatMessages.slice(-5);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
          chatHistory: history,
          message: userMsg
        })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'model', content: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', content: 'Connection failed with AI Architect.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendSuggestedPrompt = async (promptText) => {
    if (aiLoading) return;
    setChatMessages(prev => [...prev, { role: 'user', content: promptText }]);
    setAiLoading(true);

    try {
      const history = chatMessages.slice(-5);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
          chatHistory: history,
          message: promptText
        })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'model', content: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', content: 'Connection failed with AI Architect.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const parseMessageContent = (content) => {
    if (!content) return null;
    const parts = content.split('```');
    return parts.map((part, index) => {
      if (index % 2 === 0) {
        // Regular text
        return (
          <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
            {part}
          </span>
        );
      } else {
        // Code block
        const lines = part.split('\n');
        let lang = '';
        let codeLines = lines;
        if (lines.length > 0) {
          const firstLine = lines[0].trim().toLowerCase();
          if (['javascript', 'js', 'python', 'py', 'cpp', 'c++', 'java', 'html', 'css', 'json'].includes(firstLine)) {
            lang = firstLine;
            codeLines = lines.slice(1);
          }
        }
        const rawCode = codeLines.join('\n').trim();
        
        return (
          <div key={index} className="chat-code-block-container" style={{ margin: '12px 0' }}>
            <div className="chat-code-block-header">
              <span className="chat-code-block-lang">{lang.toUpperCase() || 'CODE'}</span>
              <button 
                className="chat-code-block-apply-btn"
                onClick={() => {
                  setCode(rawCode);
                  setAiDrawerOpen(false);
                }}
              >
                <Sparkles size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Apply to Editor
              </button>
            </div>
            <pre className="chat-code-block-pre">
              <code>{rawCode}</code>
            </pre>
          </div>
        );
      }
    });
  };

  // ----------------------------------------------------
  // Challenge Creator Desk (Admin Actions)
  // ----------------------------------------------------
  const handleAddTestCase = () => {
    setAdminTestCases([...adminTestCases, { input: '', expected: '' }]);
  };

  const handleRemoveTestCase = (index) => {
    setAdminTestCases(adminTestCases.filter((_, idx) => idx !== index));
  };

  const handleTestCaseChange = (index, field, value) => {
    const updated = [...adminTestCases];
    updated[index][field] = value;
    setAdminTestCases(updated);
  };

  // Auto-generate starter templates based on typed inputs
  useEffect(() => {
    if (adminFunctionName) {
      const params = adminParamNames ? adminParamNames.split(',').map(p => p.trim()).filter(Boolean) : [];
      const paramStr = params.join(', ');
      
      setAdminStarterJs(`function ${adminFunctionName}(${paramStr}) {\n    // Write your code here\n    \n}`);
      
      const snakeName = adminFunctionName.replace(/([A-Z])/g, "_$1").toLowerCase();
      setAdminStarterPy(`def ${snakeName}(${paramStr}):\n    # Write your code here\n    pass`);
    } else {
      setAdminStarterJs('');
      setAdminStarterPy('');
    }
  }, [adminFunctionName, adminParamNames]);

  const handlePublishChallenge = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');

    if (!adminTitle || !adminDescription || !adminFunctionName || !adminParamNames) {
      setAdminError('All primary problem metadata fields are required.');
      return;
    }

    // Verify test cases format
    for (let idx = 0; idx < adminTestCases.length; idx++) {
      const tc = adminTestCases[idx];
      if (!tc.input || !tc.expected) {
        setAdminError(`Test case #${idx + 1} must have both Input JSON and Expected Output JSON.`);
        return;
      }
      try {
        JSON.parse(tc.input);
      } catch (jsonErr) {
        setAdminError(`Test case #${idx + 1} Input is invalid JSON. Use standard quote-encapsulations like {"nums":[1,2],"target":3}.`);
        return;
      }
    }

    setAdminLoading(true);
    try {
      const params = adminParamNames.split(',').map(p => p.trim()).filter(Boolean);
      const starterCode = {
        javascript: adminStarterJs,
        python: adminStarterPy,
        cpp: `class Solution {\npublic:\n    // C++ template\n};`,
        java: `public class Solution {\n    // Java template\n}`
      };

      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: adminTitle,
          description: adminDescription,
          difficulty: adminDifficulty,
          functionName: adminFunctionName,
          paramNames: params,
          starterCode,
          testCases: adminTestCases
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAdminError(data.error || 'Failed to create challenge.');
      } else {
        setAdminSuccess('Challenge published successfully! Redirecting to dashboard...');
        
        // Refresh dashboard challenge list
        fetchDashboardData();
        
        // Reset form variables
        setAdminTitle('');
        setAdminDescription('');
        setAdminFunctionName('');
        setAdminParamNames('');
        setAdminTestCases([{ input: '', expected: '' }]);

        setTimeout(() => {
          setCurrentScreen('dashboard');
          setAdminSuccess('');
        }, 1500);
      }
    } catch (err) {
      setAdminError('Server connection error. Is backend API online?');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic Embedded SVG Gradient to style Lucide Icons via CSS Variables */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="cyan-purple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="100%" stopColor="#9d4edd" />
          </linearGradient>
        </defs>
      </svg>

      {/* Navigation Bar */}
      <header className="nav-header">
        <div className="brand" onClick={() => setCurrentScreen('dashboard')}>
          <Sparkles className="pulse-glow" size={24} />
          <span>CodeRank</span>
        </div>
        
        <div className="nav-links">
          {currentScreen !== 'dashboard' && (
            <button className="nav-button" onClick={() => setCurrentScreen('dashboard')}>
              Dashboard
            </button>
          )}

          {user && (
            <button className={`nav-button ${currentScreen === 'admin' ? 'active' : ''}`} onClick={() => setCurrentScreen('admin')}>
              <PlusCircle size={16} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline' }} />
              Creator Desk
            </button>
          )}

          {user ? (
            <div className="user-identity">
              <div className="avatar">{user.username[0].toUpperCase()}</div>
              <span>{user.username}</span>
              <button className="nav-button" onClick={handleLogout} title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => { setAuthMode('login'); setCurrentScreen('auth'); }}>
              <UserIcon size={16} />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* SCREEN 1: Authentication */}
      {currentScreen === 'auth' && (
        <div className="auth-wrapper">
          <div className="glass-panel auth-card">
            <h2 className="auth-title">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="auth-subtitle">
              {authMode === 'login' ? 'Sign in to execute and grade submissions' : 'Register to unlock leaderboards & AI reviews'}
            </p>

            {authError && (
              <div className="status-banner wrong">
                <ShieldAlert size={16} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={usernameInput} 
                    onChange={e => setUsernameInput(e.target.value)} 
                    placeholder="Enter your username"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={emailInput} 
                  onChange={e => setEmailInput(e.target.value)} 
                  placeholder="name@domain.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)} 
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                {authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-toggle">
              {authMode === 'login' ? (
                <>Don't have an account? <span onClick={() => setAuthMode('register')}>Sign Up</span></>
              ) : (
                <>Already have an account? <span onClick={() => setAuthMode('login')}>Sign In</span></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: Dashboard */}
      {currentScreen === 'dashboard' && (
        <main className="dashboard-wrapper">
          <div className="dashboard-hero">
            <div className="hero-title">
              <h2>Challenges Arena</h2>
              <p>Explore coding problems. Compile securely in isolated Docker containers with Gemini AI tutor backups.</p>
            </div>
            
            {!user && (
              <button className="btn-secondary" onClick={() => { setAuthMode('register'); setCurrentScreen('auth'); }}>
                Create profile to track progress
              </button>
            )}
          </div>

          <div className="home-grid">
            {/* Problems list */}
            <div>
              <div className="panel-title">
                <Database size={18} />
                <span>Problem Sets</span>
              </div>
              
              {loadingDashboard ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="loader-spinner"></div>
                </div>
              ) : (
                <div className="challenge-list">
                  {problems.map(prob => (
                    <div className="glass-panel challenge-card" key={prob.id}>
                      <div className="challenge-info">
                        <h3>{prob.title}</h3>
                        <div className="tag-container">
                          <span className={`tag ${prob.difficulty.toLowerCase()}`}>
                            {prob.difficulty}
                          </span>
                        </div>
                      </div>
                      <button className="btn-primary" onClick={() => openWorkspace(prob)}>
                        Solve
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Leaderboards */}
            <div>
              <div className="glass-panel sidebar-panel">
                <div className="panel-title">
                  <Award size={18} />
                  <span>Leaderboard</span>
                </div>
                
                <div className="leaderboard-list">
                  {leaderboard.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                      No correct submissions recorded yet. Be the first to solve!
                    </p>
                  ) : (
                    leaderboard.map((lead, idx) => (
                      <div className="leader-item" key={idx}>
                        <span className="leader-rank">#{idx + 1}</span>
                        <span className="leader-name">{lead.username}</span>
                        <span className="leader-score">{lead.solved_count} Solved</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* SCREEN 3: Workspace IDE & Split Editor */}
      {currentScreen === 'workspace' && selectedProblem && (
        <div className="workspace-wrapper">
          
          {/* Left Panel: Description and History */}
          <div className="problem-pane">
            <div className="pane-tabs">
              <button 
                className={`pane-tab ${activeWorkspaceTab === 'description' ? 'active' : ''}`}
                onClick={() => setActiveWorkspaceTab('description')}
              >
                Description
              </button>
              <button 
                className={`pane-tab ${activeWorkspaceTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  if (token) {
                    setActiveWorkspaceTab('history');
                  } else {
                    setAuthMode('login');
                    setCurrentScreen('auth');
                  }
                }}
              >
                Submission History
              </button>
            </div>

            <div className="pane-content">
              {activeWorkspaceTab === 'description' ? (
                <div className="problem-markdown">
                  <h1>{selectedProblem.title}</h1>
                  <span className={`tag ${selectedProblem.difficulty.toLowerCase()}`} style={{ marginBottom: '20px', display: 'inline-block' }}>
                    {selectedProblem.difficulty}
                  </span>
                  
                  {/* Standard rendering of linebreaks since it represents markdown seeded DB */}
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#cbd5e1' }}>
                    {selectedProblem.description}
                  </div>
                </div>
              ) : (
                <div className="submissions-history">
                  <div className="panel-title">
                    <Clock size={16} />
                    <span>Your Submissions</span>
                  </div>
                  
                  {submissionHistory.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '14px' }}>No submissions logged yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {submissionHistory.map((sub, idx) => (
                        <div className="leader-item" key={idx} style={{ flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <span className="leader-name" style={{ display: 'block' }}>{sub.language}</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {new Date(sub.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{sub.runtime_ms} ms</span>
                            <span className={`tag ${sub.status === 'Accepted' ? 'easy' : 'hard'}`}>
                              {sub.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Editor and Terminal Console */}
          <div className="editor-pane">
            
            {/* Editor Action Controls */}
            <div className="editor-controls">
              <div className="control-group">
                <select 
                  className="selector" 
                  value={selectedLanguage} 
                  onChange={e => handleLanguageChange(e.target.value)}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
              </div>

              <div className="control-group">
                <button className="btn-secondary" onClick={runCode} disabled={consoleLoading}>
                  <Play size={16} />
                  Run
                </button>
                <button className="btn-primary" onClick={submitCode} disabled={consoleLoading}>
                  <Send size={16} />
                  Submit
                </button>
                <button className="btn-secondary" style={{ borderColor: 'var(--accent-cyan)', background: 'rgba(0, 229, 255, 0.05)' }} onClick={() => { setAiDrawerOpen(true); setAiActiveTab('tutor'); }}>
                  <Brain size={16} style={{ color: 'var(--accent-cyan)' }} />
                  AI Assist
                </button>
              </div>
            </div>

            {/* Custom Monospace code text area */}
            <div className="editor-workspace">
              <textarea
                className="code-textarea"
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck="false"
                placeholder="// Write your algorithm here..."
              />
            </div>

            {/* Terminal Console outputs */}
            <div className="console-pane">
              <div className="console-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={16} />
                  <span>Execution Output Console</span>
                </div>
                {consoleRuntime !== null && (
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Runtime: <strong style={{ color: '#fff' }}>{consoleRuntime} ms</strong>
                  </span>
                )}
              </div>

              <div className="console-body">
                {consoleLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="loader-spinner" style={{ width: '20px', height: '20px' }}></div>
                    <span>Isolated executor compiling script...</span>
                  </div>
                ) : (
                  <>
                    {consoleStatus && (
                      <div className={`status-banner ${consoleStatus === 'Accepted' ? 'accepted' : consoleStatus === 'Wrong Answer' ? 'wrong' : 'error'}`}>
                        {consoleStatus === 'Accepted' ? (
                          <>🎉 <strong>Accepted!</strong> All {passedTestCases}/{totalTestCases} test cases passed.</>
                        ) : consoleStatus === 'Wrong Answer' ? (
                          <>❌ <strong>Wrong Answer</strong> - Passed {passedTestCases}/{totalTestCases} assertions.</>
                        ) : (
                          <>⚠️ <strong>{consoleStatus}</strong></>
                        )}
                      </div>
                    )}
                    
                    {consoleStdout && (
                      <div>
                        <span className="console-success">Standard Output (stdout):</span>
                        <pre>{consoleStdout}</pre>
                      </div>
                    )}

                    {consoleStderr && (
                      <div style={{ marginTop: '10px' }}>
                        <span className="console-error">Error logs / Assert failures (stderr):</span>
                        <pre>{consoleStderr}</pre>
                      </div>
                    )}

                    {!consoleStatus && !consoleStdout && !consoleStderr && (
                      <div style={{ color: '#475569', fontStyle: 'italic', textAlign: 'center', marginTop: '30px' }}>
                        Console is clear. Click 'Run' to verify output, or 'Submit' to evaluate database assertions.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>

          {/* SLIDING AI DRAWER */}
          <div className={`ai-drawer ${aiDrawerOpen ? 'open' : ''}`}>
            <div className="ai-drawer-header">
              <h3>
                <Brain size={20} />
                <span>AI Tutor Desk</span>
              </h3>
              <button className="btn-close" onClick={() => setAiDrawerOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="pane-tabs">
              <button 
                className={`pane-tab ${aiActiveTab === 'tutor' ? 'active' : ''}`}
                onClick={() => setAiActiveTab('tutor')}
              >
                Error Explainer
              </button>
              <button 
                className={`pane-tab ${aiActiveTab === 'complexity' ? 'active' : ''}`}
                onClick={() => {
                  setAiActiveTab('complexity');
                  triggerComplexityCheck();
                }}
              >
                Complexity Analyst
              </button>
              <button 
                className={`pane-tab ${aiActiveTab === 'chat' ? 'active' : ''}`}
                onClick={() => setAiActiveTab('chat')}
              >
                Copilot Chat
              </button>
            </div>

            <div className="ai-drawer-body">
              {aiLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '40px 0' }}>
                  <div className="loader-spinner"></div>
                  <span style={{ fontSize: '14px', color: '#94a3b8' }}>Gemini is processing active workspace...</span>
                </div>
              )}

              {!aiLoading && aiActiveTab === 'tutor' && (
                <div>
                  {aiTutorExplanation ? (
                    <div>{parseMessageContent(aiTutorExplanation)}</div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
                      <HelpCircle size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }} />
                      <p>Your code execution is fully healthy!</p>
                      <p style={{ fontSize: '13px', marginTop: '6px' }}>If you encounter a runtime error or failed test case during a 'Submit', the AI Tutor automatically explains the bug here.</p>
                    </div>
                  )}
                </div>
              )}

              {!aiLoading && aiActiveTab === 'complexity' && complexityData && (
                <div>
                  <div className="complexity-grid">
                    <div className="complexity-card">
                      <h5>Time Complexity</h5>
                      <div className="complexity-value">{complexityData.timeComplexity}</div>
                      <div className="complexity-optimal">Optimal: {complexityData.optimalTimeComplexity}</div>
                    </div>
                    <div className="complexity-card">
                      <h5>Space Complexity</h5>
                      <div className="complexity-value">{complexityData.spaceComplexity}</div>
                      <div className="complexity-optimal">Optimal: {complexityData.optimalSpaceComplexity}</div>
                    </div>
                  </div>

                  <h4>🔍 Structural Analysis</h4>
                  <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '20px' }}>
                    {complexityData.explanation}
                  </p>

                  {complexityData.suggestions && complexityData.suggestions.length > 0 && (
                    <>
                      <h4>🚀 Code Optimizations</h4>
                      <ul style={{ paddingLeft: '0', listStyleType: 'none' }}>
                        {complexityData.suggestions.map((sug, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', marginBottom: '10px' }}>
                            <ChevronRight size={16} style={{ color: 'var(--accent-cyan)', marginTop: '2px', flexShrink: 0 }} />
                            <span>{sug}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {aiActiveTab === 'chat' && (
                <div className="chat-tab-container">
                  <div className="chat-messages">
                    {chatMessages.map((msg, i) => (
                      <div className={`chat-bubble ${msg.role}`} key={i}>
                        {parseMessageContent(msg.content)}
                      </div>
                    ))}
                  </div>

                  {/* Suggestion Prompt Chips */}
                  <div className="chat-suggestion-chips">
                    <button 
                      type="button" 
                      className="chat-chip"
                      onClick={() => handleSendSuggestedPrompt("Can you write the complete code for this challenge?")}
                    >
                      ⚡ Write Code
                    </button>
                    <button 
                      type="button" 
                      className="chat-chip"
                      onClick={() => handleSendSuggestedPrompt("Optimize my current solution's complexity")}
                    >
                      🚀 Optimize
                    </button>
                    <button 
                      type="button" 
                      className="chat-chip"
                      onClick={() => handleSendSuggestedPrompt("Explain the best approach for this problem")}
                    >
                      🔍 Explain
                    </button>
                  </div>
                  
                  <form onSubmit={triggerCopilotChat} className="chat-input-area">
                    <input 
                      type="text" 
                      className="chat-input"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask the AI Code Architect..."
                      disabled={aiLoading}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '10px' }} disabled={aiLoading}>
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* SCREEN 4: Challenge Creator Desk (Admin Panel) */}
      {currentScreen === 'admin' && (
        <main className="dashboard-wrapper">
          <div className="glass-panel" style={{ padding: '40px', maxWidth: '850px', margin: '0 auto' }}>
            <div className="panel-title" style={{ fontSize: '24px', borderBottom: 'none', paddingBottom: '0', marginBottom: '8px' }}>
              <Sparkles size={24} style={{ color: 'var(--accent-cyan)', display: 'inline', marginRight: '8px' }} />
              <span>Challenge Creator Console</span>
            </div>
            
            <p style={{ color: '#94a3b8', marginBottom: '30px', fontSize: '15px' }}>
              Design a brand new custom coding challenge. It will instantly publish to the Arena and be fully evaluate-able in the Docker/Local Sandboxes using our dynamic grader engine!
            </p>

            {adminError && (
              <div className="status-banner wrong" style={{ marginBottom: '24px' }}>
                <ShieldAlert size={16} />
                <span>{adminError}</span>
              </div>
            )}

            {adminSuccess && (
              <div className="status-banner accepted" style={{ marginBottom: '24px' }}>
                <span>{adminSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePublishChallenge}>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Challenge Title</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={adminTitle}
                    onChange={e => setAdminTitle(e.target.value)}
                    placeholder="e.g., Add Two Numbers"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Difficulty Scale</label>
                  <select 
                    className="selector" 
                    style={{ width: '100%', padding: '12px' }}
                    value={adminDifficulty}
                    onChange={e => setAdminDifficulty(e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Problem Instructions / Constraints (Markdown Supported)</label>
                <textarea 
                  className="code-textarea"
                  style={{ height: '180px', border: '1px solid var(--border-light)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', padding: '16px' }}
                  value={adminDescription}
                  onChange={e => setAdminDescription(e.target.value)}
                  placeholder="Explain what the developer needs to do, sample parameters, and expected returns..."
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Target Function Name (camelCase)</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={adminFunctionName}
                    onChange={e => setAdminFunctionName(e.target.value)}
                    placeholder="e.g., addNumbers"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Function Parameter Names (Comma-separated)</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={adminParamNames}
                    onChange={e => setAdminParamNames(e.target.value)}
                    placeholder="e.g., num1, num2"
                    required
                  />
                </div>
              </div>

              {/* Starter Templates Previews */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">JavaScript Template (Auto-Generated)</label>
                  <pre style={{ background: '#0a0b12', padding: '12px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--border-light)', color: '#a78bfa', fontFamily: 'var(--font-mono)', minHeight: '80px', overflowX: 'auto' }}>
                    {adminStarterJs || '// Specify function name to preview...'}
                  </pre>
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Python Template (Auto-Generated)</label>
                  <pre style={{ background: '#0a0b12', padding: '12px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--border-light)', color: '#38bdf8', fontFamily: 'var(--font-mono)', minHeight: '80px', overflowX: 'auto' }}>
                    {adminStarterPy || '# Specify function name to preview...'}
                  </pre>
                </div>
              </div>

              {/* Secret Test Cases harness */}
              <div style={{ marginBottom: '30px' }}>
                <div className="panel-title" style={{ fontSize: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '16px' }}>
                  <Database size={16} />
                  <span>Grading Assertions (Secret Test Cases)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {adminTestCases.map((tc, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '15px', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <label className="form-label" style={{ fontSize: '12px', color: '#94a3b8' }}>Input Parameters JSON</label>
                        <input 
                          type="text" 
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                          value={tc.input}
                          onChange={e => handleTestCaseChange(idx, 'input', e.target.value)}
                          placeholder='e.g., {"num1": 5, "num2": 10}'
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <label className="form-label" style={{ fontSize: '12px', color: '#94a3b8' }}>Expected Return JSON</label>
                        <input 
                          type="text" 
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                          value={tc.expected}
                          onChange={e => handleTestCaseChange(idx, 'expected', e.target.value)}
                          placeholder="e.g., 15"
                          required
                        />
                      </div>
                      {adminTestCases.length > 1 && (
                        <button 
                          type="button" 
                          className="btn-close" 
                          style={{ marginTop: '20px', color: 'var(--accent-red)' }}
                          onClick={() => handleRemoveTestCase(idx)}
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ marginTop: '14px' }}
                  onClick={handleAddTestCase}
                >
                  + Add Test Case
                </button>
              </div>

              {/* Form Action Controls */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setCurrentScreen('dashboard')}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={adminLoading}
                >
                  {adminLoading ? 'Publishing...' : 'Publish Challenge'}
                </button>
              </div>
            </form>
          </div>
        </main>
      )}
    </div>
  );
}
