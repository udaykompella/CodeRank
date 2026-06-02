const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'coderank.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to CodeRank SQLite database.');
  }
});

// Run a query and return a Promise
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Get all rows
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get a single row
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Initialize tables and seed challenges
async function initDb() {
  // Users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Problems table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      starter_code TEXT NOT NULL, -- JSON formatted starter templates
      test_cases TEXT NOT NULL,   -- JSON formatted array of {input, expected}
      function_name TEXT,
      param_names TEXT
    )
  `);

  // Auto-Migration: safely add columns if existing database exists
  try {
    await dbRun('ALTER TABLE problems ADD COLUMN function_name TEXT');
    console.log('Migrated columns: added function_name');
  } catch (e) { /* Column already exists */ }

  try {
    await dbRun('ALTER TABLE problems ADD COLUMN param_names TEXT');
    console.log('Migrated columns: added param_names');
  } catch (e) { /* Column already exists */ }

  // Submissions table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS submissions (
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
    )
  `);

  console.log('Database tables successfully checked/created.');
  await seedProblems();
}

async function seedProblems() {
  const count = await dbGet('SELECT COUNT(*) as count FROM problems');
  if (count.count > 0) {
    // Check if the current seeded rows have function_name populated.
    // If not, let's clean seed tables to upgrade them.
    const sample = await dbGet('SELECT function_name FROM problems LIMIT 1');
    if (sample && sample.function_name) {
      console.log('Problems already seeded with dynamic metadata. Skipping seed.');
      return;
    } else {
      console.log('Database schema migration detected. Upgrading seeding structures...');
      await dbRun('DELETE FROM problems');
    }
  }

  console.log('Seeding default coding challenges...');

  const problems = [
    {
      title: 'Two Sum',
      difficulty: 'Easy',
      function_name: 'twoSum',
      param_names: JSON.stringify(['nums', 'target']),
      description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

### Example 1
**Input:** nums = [2, 7, 11, 15], target = 9  
**Output:** [0, 1]  
**Explanation:** Because nums[0] + nums[1] == 9, we return [0, 1].`,
      starter_code: JSON.stringify({
        javascript: `function twoSum(nums, target) {\n    // Write your code here\n    \n}`,
        python: `def two_sum(nums: list[int], target: int) -> list[int]:\n    # Write your code here\n    pass`,
        cpp: `#include <vector>\n\nclass Solution {\npublic:\n    std::vector<int> twoSum(std::vector<int>& nums, int target) {\n        // Write your code here\n        return {};\n    }\n};`,
        java: `import java.util.*;\n\npublic class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[0];\n    }\n}`
      }),
      test_cases: JSON.stringify([
        { input: JSON.stringify({ nums: [2, 7, 11, 15], target: 9 }), expected: JSON.stringify([0, 1]) },
        { input: JSON.stringify({ nums: [3, 2, 4], target: 6 }), expected: JSON.stringify([1, 2]) },
        { input: JSON.stringify({ nums: [3, 3], target: 6 }), expected: JSON.stringify([0, 1]) }
      ])
    },
    {
      title: 'Reverse String',
      difficulty: 'Easy',
      function_name: 'reverseString',
      param_names: JSON.stringify(['s']),
      description: `Write a function that reverses a string. The input string is given as an array of characters \`s\`.

You must do this by modifying the input array in-place with O(1) extra memory.

### Example 1
**Input:** s = ["h","e","l","l","o"]  
**Output:** ["o","l","l","e","h"]`,
      starter_code: JSON.stringify({
        javascript: `function reverseString(s) {\n    // Write your code here (modify in place)\n    \n}`,
        python: `def reverse_string(s: list[str]) -> None:\n    # Write your code here (modify in place)\n    pass`,
        cpp: `#include <vector>\n\nclass Solution {\npublic:\n    void reverseString(std::vector<char>& s) {\n        // Write your code here (modify in place)\n        \n    }\n};`,
        java: `import java.util.*;\n\npublic class Solution {\n    public void reverseString(char[] s) {\n        // Write your code here (modify in place)\n        \n    }\n}`
      }),
      test_cases: JSON.stringify([
        { input: JSON.stringify({ s: ["h","e","l","l","o"] }), expected: JSON.stringify(["o","l","l","e","h"]) },
        { input: JSON.stringify({ s: ["H","a","n","n","a","h"] }), expected: JSON.stringify(["h","a","n","n","a","H"]) }
      ])
    },
    {
      title: 'Fibonacci Number',
      difficulty: 'Easy',
      function_name: 'fib',
      param_names: JSON.stringify(['n']),
      description: `The Fibonacci numbers, commonly denoted F(n) form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1. 

F(0) = 0, F(1) = 1
F(n) = F(n - 1) + F(n - 2), for n > 1.

Given n, calculate F(n).

### Example 1
**Input:** n = 2  
**Output:** 1  
**Explanation:** F(2) = F(1) + F(0) = 1 + 0 = 1.`,
      starter_code: JSON.stringify({
        javascript: `function fib(n) {\n    // Write your code here\n    \n}`,
        python: `def fib(n: int) -> int:\n    # Write your code here\n    pass`,
        cpp: `class Solution {\npublic:\n    int fib(int n) {\n        // Write your code here\n        return 0;\n    }\n};`,
        java: `public class Solution {\n    public int fib(int n) {\n        // Write your code here\n        return 0;\n    }\n}`
      }),
      test_cases: JSON.stringify([
        { input: JSON.stringify({ n: 2 }), expected: JSON.stringify(1) },
        { input: JSON.stringify({ n: 3 }), expected: JSON.stringify(2) },
        { input: JSON.stringify({ n: 4 }), expected: JSON.stringify(3) },
        { input: JSON.stringify({ n: 10 }), expected: JSON.stringify(55) }
      ])
    },
    {
      title: 'Is Prime',
      difficulty: 'Medium',
      function_name: 'isPrime',
      param_names: JSON.stringify(['n']),
      description: `Write a function that determines if a given positive integer \`n\` is a prime number. 

A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself.

Return \`true\` if it is prime, and \`false\` otherwise.

### Example 1
**Input:** n = 17  
**Output:** true  

### Example 2
**Input:** n = 4  
**Output:** false`,
      starter_code: JSON.stringify({
        javascript: `function isPrime(n) {\n    // Write your code here\n    \n}`,
        python: `def is_prime(n: int) -> bool:\n    # Write your code here\n    pass`,
        cpp: `class Solution {\npublic:\n    bool isPrime(int n) {\n        // Write your code here\n        return false;\n    }\n};`,
        java: `public class Solution {\n    public boolean isPrime(int n) {\n        // Write your code here\n        return false;\n    }\n}`
      }),
      test_cases: JSON.stringify([
        { input: JSON.stringify({ n: 4 }), expected: JSON.stringify(false) },
        { input: JSON.stringify({ n: 17 }), expected: JSON.stringify(true) },
        { input: JSON.stringify({ n: 1 }), expected: JSON.stringify(false) },
        { input: JSON.stringify({ n: 97 }), expected: JSON.stringify(true) }
      ])
    }
  ];

  for (const prob of problems) {
    await dbRun(
      'INSERT INTO problems (title, difficulty, description, starter_code, test_cases, function_name, param_names) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [prob.title, prob.difficulty, prob.description, prob.starter_code, prob.test_cases, prob.function_name, prob.param_names]
    );
  }

  console.log('Challenges seeded successfully.');
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDb
};
