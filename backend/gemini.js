const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let genAI = null;
let geminiModel = null;

// Initialize Gemini if key is present
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Gemini AI successfully initialized.');
  } catch (err) {
    console.error('Failed to initialize Gemini Client:', err.message);
  }
}

// Log loaded status
if (OPENAI_API_KEY) {
  console.log('OpenAI API support loaded (Using gpt-4o-mini).');
} else if (!GEMINI_API_KEY) {
  console.log('No AI API keys detected in .env. Running in High-Fidelity AI Simulation mode.');
}

// ----------------------------------------------------
// OpenAI Native Request Helper (Zero Dependencies)
// ----------------------------------------------------
async function callOpenAI(systemPrompt, userPrompt, jsonMode = false) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const body = {
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.7
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ----------------------------------------------------
// Mock / Simulation Fallbacks
// ----------------------------------------------------
function getMockErrorExplanation(code, language, errorText) {
  let explanation = `### 💡 AI Tutor Analysis\n\nIt looks like your code encountered a runtime assertion or functional error. Here is a breakdown of what happened and how to address it:\n\n`;
  
  const lowerCode = code.toLowerCase();
  
  if (lowerCode.includes('twosum') || lowerCode.includes('two_sum')) {
    explanation += `#### 🔍 The Problem: "Two Sum"
1. **Logical Traps**: Are you using the same element twice? For example, if the target is \`6\` and \`nums = [3, 2, 4]\`, doing \`nums[0] + nums[0] (3 + 3)\` would give \`6\`, but you are not allowed to reuse the same index \`0\`.
2. **Index Alignment**: If your loops search for pairs, make sure your inner loop starts at \`i + 1\` (e.g., \`for (let j = i + 1; ...)\`), otherwise you might check the same index or do redundant calculations.
3. **Optimized Lookups**: Currently, your approach might be $O(N^2)$ using nested loops. Consider using a **Hash Map** (or a Python dictionary) to store numbers as keys and their indices as values. This will allow you to find the complement (\`target - nums[i]\`) in $O(1)$ time, reducing your overall time to $O(N)$!

**💡 Actionable Tip:**  
Try keeping track of previously visited numbers in a dictionary/map as you iterate through the list.`;
  } else if (lowerCode.includes('reverse') || lowerCode.includes('reverse_string') || lowerCode.includes('reversestring')) {
    explanation += `#### 🔍 The Problem: "Reverse String"
1. **In-place Modifications**: The problem statement explicitly requires you to modify the input array in-place, meaning you cannot allocate another array and return it.
2. **Two Pointer Technique**:
   - Initialize two trackers: \`left = 0\` and \`right = len(s) - 1\`.
   - Swap the characters: \`s[left], s[right] = s[right], s[left]\`.
   - Increment \`left\` and decrement \`right\` until they meet in the middle.
3. **Boundary Pitfalls**: Make sure your loop condition is \`left < right\`. If you loop over the entire length of the string, you will end up swapping them twice, leaving the string in its original state!

**💡 Actionable Tip:**  
Check your loop termination condition. Make sure you stop as soon as the pointers cross!`;
  } else if (lowerCode.includes('fib')) {
    explanation += `#### 🔍 The Problem: "Fibonacci Number"
1. **Recursive Redundancy**: If you implemented this using simple recursion (\`return fib(n-1) + fib(n-2)\`), your time complexity grows exponentially ($O(2^N)$). This causes a timeout for larger values of $N$ (like $N=40$).
2. **Dynamic Programming**: Store calculations in an array (Memoization) or iterate from bottom-up:
   - Initialize \`a = 0\`, \`b = 1\`.
   - Loop up to $N$ times, updating \`a, b = b, a + b\`.
3. **Edge Cases**: Ensure you return the correct base cases: \`n=0\` should return \`0\`, and \`n=1\` should return \`1\`.

**💡 Actionable Tip:**  
Try rewriting your function with a simple loop rather than recursive calls to achieve $O(N)$ time and $O(1)$ space.`;
  } else {
    explanation += `#### 🔍 General Debugging Tips
1. **Check Variable Initialization**: Ensure all variables used in computations or loops are initialized correctly.
2. **Infinite Loops**: Check if your loop variables are correctly incremented/decremented to prevent timeouts.
3. **Console Logs**: Use print/log statements to inspect the arguments on each iteration.

*The raw execution error was:*
\`\`\`
${errorText || 'Assertion mismatch'}
\`\`\``;
  }
  
  return explanation;
}

function getMockComplexity(code) {
  const lowerCode = code.toLowerCase();
  let timeC = 'O(N^2)';
  let spaceC = 'O(1)';
  let optimalT = 'O(N)';
  let optimalS = 'O(N)';
  let explanation = '';
  let suggestions = [];

  if (lowerCode.includes('twosum') || lowerCode.includes('two_sum')) {
    if (lowerCode.includes('map') || lowerCode.includes('dict') || lowerCode.includes('hash')) {
      timeC = 'O(N)';
      spaceC = 'O(N)';
      explanation = 'Your code uses a Hash Map/dictionary to store visited numbers. This allows lookup of the complement (`target - num`) in average $O(1)$ time, yielding an overall linear traversal time.';
      suggestions = ['Excellent job! You implemented the optimal solution.', 'Ensure to check for edge cases like empty arrays or targets that cannot be made.'];
    } else {
      timeC = 'O(N^2)';
      spaceC = 'O(1)';
      explanation = 'Your code uses nested loops to check every possible pair of numbers in the array. While memory-efficient, this double-iteration results in a quadratic execution duration.';
      suggestions = ['Refactor using a Hash Map/dictionary to perform $O(1)$ lookups and drop runtime complexity to $O(N)$.', 'Store numbers as keys and their index as values.'];
    }
  } else if (lowerCode.includes('reverse') || lowerCode.includes('reverse_string') || lowerCode.includes('reversestring')) {
    timeC = 'O(N)';
    spaceC = 'O(1)';
    optimalT = 'O(N)';
    optimalS = 'O(1)';
    explanation = 'Your code uses two pointers swapping elements in-place from outer edges towards the center. It traverses half the string length, giving a linear runtime and constant memory usage.';
    suggestions = ['Superb in-place execution!', 'This is the most optimal implementation possible.'];
  } else if (lowerCode.includes('fib')) {
    if (lowerCode.includes('recursive') || (lowerCode.includes('fib(') && !lowerCode.includes('for') && !lowerCode.includes('while'))) {
      timeC = 'O(2^N)';
      spaceC = 'O(N)';
      optimalT = 'O(N)';
      optimalS = 'O(1)';
      explanation = 'Your solution uses native double recursion. Each call splits into two further branches, generating an exponential recursion tree of redundant recalculations.';
      suggestions = ['Use dynamic programming (iteration or memoization) to avoid solving the same subproblems repeatedly.', 'An iterative loop tracks values in $O(1)$ memory.'];
    } else {
      timeC = 'O(N)';
      spaceC = 'O(1)';
      optimalT = 'O(N)';
      optimalS = 'O(1)';
      explanation = 'You implemented iterative bottom-up tracking. You calculate each number exactly once, maintaining only the two previous states in memory.';
      suggestions = ['Perfect execution! Linear time and constant space are highly optimal.', 'For extremely large N, matrix exponentiation can reduce time further to $O(\\log N)$.'];
    }
  } else {
    explanation = 'Your code traverses the input and computes the target output. Standard operations are clean.';
    suggestions = ['Review algorithms to see if duplicate checks or memory buffers can be avoided.'];
  }

  return {
    timeComplexity: timeC,
    spaceComplexity: spaceC,
    explanation,
    optimalTimeComplexity: optimalT,
    optimalSpaceComplexity: optimalS,
    suggestions
  };
}

function getMockChatResponse(code, message) {
  const lowerMsg = message.toLowerCase();
  const lowerCode = code.toLowerCase();

  if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
    return "Hi there! I am your AI Code Architect. I'm connected to your editor and can help you optimize, debug, or write solutions for this problem. What would you like to discuss?";
  }

  if (lowerMsg.includes('optimize') || lowerMsg.includes('faster') || lowerMsg.includes('time')) {
    if (lowerCode.includes('twosum') || lowerCode.includes('two_sum')) {
      return "To optimize Two Sum to $O(N)$:\n\n```javascript\n// JavaScript Example using Map:\nfunction twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}\n```\nThis eliminates the nested loops by doing $O(1)$ checks!";
    }
    return "To optimize your runtime, look for nested loops and replace them with hash tables (Maps) or two pointers (if sorted). If recursion is slow, implement dynamic programming (memoization) or standard loops!";
  }

  if (lowerMsg.includes('code') || lowerMsg.includes('write') || lowerMsg.includes('give') || lowerMsg.includes('show') || lowerMsg.includes('syntax') || lowerMsg.includes('implement')) {
    if (lowerCode.includes('addnumbers') || lowerCode.includes('add_numbers') || lowerCode.includes('addnumbers') || code.includes('addNumbers')) {
      return "Here is the JavaScript implementation of the parameter validation and addition function as we discussed:\n\n```javascript\nfunction addNumbers(a, b) {\n    // Parameter validation check\n    if (typeof a !== 'number' || typeof b !== 'number') {\n        throw new Error('Both parameters must be numbers');\n    }\n    return a + b;\n}\n```\nClick the 'Apply to Editor' button at the top right of the code block above to instantly inject this solution into your workspace editor!";
    }
    if (lowerCode.includes('twosum') || lowerCode.includes('two_sum') || code.includes('twoSum')) {
      return "Here is the JavaScript implementation of the Two Sum algorithm using a Map:\n\n```javascript\nfunction twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}\n```\nClick the 'Apply to Editor' button at the top right of the code block above to instantly inject this solution into your workspace editor!";
    }
    return "Here is a starter structure matching your active workspace:\n\n```javascript\nfunction solution() {\n    // Write your solution logic here\n    console.log('Sandbox solution running');\n}\n```\nClick 'Apply to Editor' above to try it!";
  }

  return "That is a great question! Based on your current editor contents, I recommend checking if you have set your index boundaries correctly and handling the edge cases. Let me know if you would like me to write a sample test case structure or explain a specific concept!";
}

// ----------------------------------------------------
// Public API Methods
// ----------------------------------------------------

async function explainError(code, language, errorText, stdout = '', stderr = '') {
  const systemPrompt = `You are a supportive, high-competency AI programming tutor assisting a student in an "AI First Software Engineering" sandbox.
Their code failed to compile, run, or pass the test assertions. Make sure to identify error hotspots and highlight structural changes without revealing the full corrected code.`;

  const userPrompt = `Analyze the code, language, and execution telemetry below:

--- LANGUAGE ---
${language}

--- STUDENT CODE ---
${code}

--- ERROR RECEIVED ---
${errorText}

--- STDOUT ---
${stdout}

--- STDERR ---
${stderr}

--- INSTRUCTIONS ---
1. Explain clearly WHY the code failed or which line is likely causing the error.
2. Maintain an encouraging, educational tone.
3. DO NOT output the complete, corrected solution. Provide logical hints, pseudocode, or highlight 2-3 specific lines for adjustment.
4. Format using Markdown.`;

  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(systemPrompt, userPrompt);
    } catch (err) {
      console.error('OpenAI error explain failed, falling back:', err.message);
    }
  }

  if (geminiModel) {
    try {
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const result = await geminiModel.generateContent(fullPrompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini error explain failed, falling back:', error.message);
    }
  }

  return getMockErrorExplanation(code, language, errorText || stderr);
}

async function analyzeComplexity(code, language) {
  const systemPrompt = `You are an expert algorithm consultant. Evaluate the computational Big-O time and space complexity of the code.`;
  const userPrompt = `Analyze the student's code and evaluate its computational complexity.
Return your evaluation STRICTLY as a valid JSON object matching the schema below. Do not wrap in markdown guards.

--- LANGUAGE ---
${language}

--- CODE ---
${code}

--- JSON SCHEMA ---
{
  "timeComplexity": "e.g., O(N^2)",
  "spaceComplexity": "e.g., O(1)",
  "explanation": "Brief text explaining why.",
  "optimalTimeComplexity": "e.g., O(N)",
  "optimalSpaceComplexity": "e.g., O(1)",
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ]
}
`;

  if (OPENAI_API_KEY) {
    try {
      const reply = await callOpenAI(systemPrompt, userPrompt, true);
      return JSON.parse(reply);
    } catch (err) {
      console.error('OpenAI complexity check failed, falling back:', err.message);
    }
  }

  if (geminiModel) {
    try {
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const result = await geminiModel.generateContent(fullPrompt);
      let text = result.response.text().trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini complexity check failed, falling back:', error.message);
    }
  }

  return getMockComplexity(code);
}

async function chatCopilot(code, language, chatHistory = [], userMessage = '') {
  const systemPrompt = `You are the AI Code Architect pair-programming with the user on an online IDE platform.
Act as a helpful guide. Do not give complete answers instantly unless asked. Help them figure out algorithmic strategies. Keep answers reasonably concise.`;

  // Format thread context
  const contextHeader = `Here is the code currently written in their editor:
\`\`\`${language}
${code}
\`\`\`

Here is the conversation history:
${chatHistory.map(msg => `${msg.role === 'user' ? 'Developer' : 'Architect'}: ${msg.content}`).join('\n')}

Developer: ${userMessage}
Architect:`;

  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(systemPrompt, contextHeader);
    } catch (err) {
      console.error('OpenAI copilot chat failed, falling back:', err.message);
    }
  }

  if (geminiModel) {
    try {
      const context = `You are the AI Code Architect pair-programming with the user on an online IDE platform.
Here is the code currently written in their editor:
\`\`\`${language}
${code}
\`\`\`

Act as a helpful guide. Do not give complete answers instantly unless asked for specific snippets. Help them figure out algorithmic strategies. Keep answers reasonably concise.`;

      const historyPayload = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const chatSession = geminiModel.startChat({
        history: [
          { role: 'user', parts: [{ text: context }] },
          { role: 'model', parts: [{ text: 'Understood. I am ready to pair-program on this codebase.' }] },
          ...historyPayload
        ]
      });

      const result = await chatSession.sendMessage(userMessage);
      return result.response.text();
    } catch (error) {
      console.error('Gemini copilot chat failed, falling back:', error.message);
    }
  }

  return getMockChatResponse(code, userMessage);
}

module.exports = {
  explainError,
  analyzeComplexity,
  chatCopilot
};
