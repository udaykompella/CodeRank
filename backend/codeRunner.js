const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Configurable execution constraints
const TIMEOUT_LIMIT = 4000; // 4 seconds max execution
const MEMORY_LIMIT = '128m'; // 128 Megabytes RAM limit for Docker
const CPU_LIMIT = '0.5'; // 0.5 CPU Core quota for Docker

// Checks if Docker is running and available
function isDockerAvailable() {
  return new Promise((resolve) => {
    exec('docker info', (error) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// Language Configuration Map
const LANGUAGE_CONFIG = {
  javascript: {
    extension: '.js',
    dockerImage: 'node:18-alpine',
    compileCmd: null,
    runCmd: (filePath) => `node ${filePath}`,
    dockerRunCmd: (containerFile) => `node ${containerFile}`
  },
  python: {
    extension: '.py',
    dockerImage: 'python:3.10-alpine',
    compileCmd: null,
    runCmd: (filePath) => `python ${filePath}`,
    dockerRunCmd: (containerFile) => `python ${containerFile}`
  },
  cpp: {
    extension: '.cpp',
    dockerImage: 'gcc:12-alpine',
    compileCmd: (filePath, binaryPath) => `g++ -O3 ${filePath} -o ${binaryPath}`,
    runCmd: (filePath, binaryPath) => `${binaryPath}`,
    dockerRunCmd: (containerFile, containerBinary) => `${containerBinary}`
  },
  java: {
    extension: '.java',
    dockerImage: 'openjdk:17-alpine',
    compileCmd: (filePath) => `javac ${filePath}`,
    runCmd: (filePath) => {
      const dir = path.dirname(filePath);
      return `java -cp ${dir} Solution`;
    },
    dockerRunCmd: (containerFile) => {
      const dir = path.dirname(containerFile);
      return `java -cp ${dir} Solution`;
    }
  }
};

// Generates Assertion Wrappers for specific problem grading
function appendWrapper(code, language, problem) {
  if (!problem) return code;

  const problemId = typeof problem === 'object' ? problem.id : problem;

  // ----------------------------------------------------
  // Dynamic JavaScript Evaluator
  // ----------------------------------------------------
  if (language === 'javascript') {
    const functionName = problem.function_name || 'solution';
    const paramNames = JSON.parse(problem.param_names || '[]');

    return `${code}
\nconst fs = require('fs');
const path = require('path');
const testCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'tests.json'), 'utf8'));
const results = [];
for (const tc of testCases) {
    const input = JSON.parse(tc.input);
    const expected = JSON.parse(tc.expected);
    try {
        const args = ${JSON.stringify(paramNames)}.map(name => input[name]);
        let result = typeof ${functionName} !== 'undefined' ? ${functionName}(...args) : undefined;
        
        // Handle in-place array/string modifications (where return value is undefined, but inputs are mutated)
        if (result === undefined && args.length > 0) {
            result = args[0];
        }
        
        const passed = JSON.stringify(result) === JSON.stringify(expected) || 
                       String(result) === String(expected) ||
                       (Array.isArray(result) && JSON.stringify(result.reverse()) === JSON.stringify(expected));
        results.push({ passed, actual: result, expected, error: null });
    } catch (e) {
        results.push({ passed: false, actual: null, expected, error: e.message });
    }
}
console.log('---TESTS_START---' + JSON.stringify(results) + '---TESTS_END---');`;
  }

  // ----------------------------------------------------
  // Dynamic Python Evaluator
  // ----------------------------------------------------
  if (language === 'python') {
    const functionName = problem.function_name || 'solution';
    const paramNames = JSON.parse(problem.param_names || '[]');

    return `${code}
\nimport json, os
test_cases = json.loads(open(os.path.join(os.path.dirname(__file__), 'tests.json')).read())
results = []
for tc in test_cases:
    inp = json.loads(tc['input'])
    expected = json.loads(tc['expected'])
    try:
        param_names = ${JSON.stringify(paramNames)}
        args = [inp[name] for name in param_names]
        
        func_name = "${functionName}"
        # Convert camelCase to snake_case if Python standards are used in workspace
        if func_name == "twoSum" and "two_sum" in globals(): func_name = "two_sum"
        elif func_name == "reverseString" and "reverse_string" in globals(): func_name = "reverse_string"
        elif func_name == "isPrime" and "is_prime" in globals(): func_name = "is_prime"
        
        target_func = globals()[func_name]
        res = target_func(*args)
        
        # Handle in-place Python mutations
        if res is None and len(args) > 0:
            res = args[0]
            
        passed = json.dumps(res) == json.dumps(expected) or str(res) == str(expected) or json.dumps(res) == json.dumps(expected[::-1] if isinstance(expected, list) else expected)
        results.append({"passed": passed, "actual": res, "expected": expected, "error": None})
    except Exception as e:
        results.append({"passed": False, "actual": None, "expected": expected, "error": str(e)})
print('---TESTS_START---' + json.dumps(results) + '---TESTS_END---')`;
  }

  // ----------------------------------------------------
  // Static Fallbacks for Default C++ and Java Sets
  // ----------------------------------------------------
  if (problemId === 1) { // Two Sum
    if (language === 'cpp') {
      return `${code}
\n#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

int main(int argc, char* argv[]) {
    Solution solver;
    std::cout << "---TESTS_START---";
    std::vector<int> n1 = {2, 7, 11, 15};
    std::vector<int> res1 = solver.twoSum(n1, 9);
    bool p1 = (res1.size() == 2 && ((res1[0] == 0 && res1[1] == 1) || (res1[0] == 1 && res1[1] == 0)));
    std::cout << "[{\\"passed\\":" << (p1 ? "true" : "false") << ",\\"actual\\":\\"[" << (res1.size() > 1 ? std::to_string(res1[0]) + "," + std::to_string(res1[1]) : "") << "]\\",\\"expected\\":\\"[0,1]\\",\\"error\\":null}";
    
    std::vector<int> n2 = {3, 2, 4};
    std::vector<int> res2 = solver.twoSum(n2, 6);
    bool p2 = (res2.size() == 2 && ((res2[0] == 1 && res2[1] == 2) || (res2[0] == 2 && res2[1] == 1)));
    std::cout << ",{\\"passed\\":" << (p2 ? "true" : "false") << ",\\"actual\\":\\"[" << (res2.size() > 1 ? std::to_string(res2[0]) + "," + std::to_string(res2[1]) : "") << "]\\",\\"expected\\":\\"[1,2]\\",\\"error\\":null}]";
    std::cout << "---TESTS_END---" << std::endl;
    return 0;
}`;
    } else if (language === 'java') {
      return `import java.util.*;\n${code}
\npublic class SolutionMain {
    public static void main(String[] args) {
        Solution solver = new Solution();
        System.out.print("---TESTS_START---");
        int[] n1 = {2, 7, 11, 15};
        int[] res1 = solver.twoSum(n1, 9);
        boolean p1 = res1.length == 2 && ((res1[0] == 0 && res1[1] == 1) || (res1[0] == 1 && res1[1] == 0));
        System.out.print("[{\\"passed\\":" + p1 + ",\\"actual\\":\\"[0,1]\\",\\"expected\\":\\"[0,1]\\",\\"error\\":null}");
        
        int[] n2 = {3, 2, 4};
        int[] res2 = solver.twoSum(n2, 6);
        boolean p2 = res2.length == 2 && ((res2[0] == 1 && res2[1] == 2) || (res2[0] == 2 && res2[1] == 1));
        System.out.print(",{\\"passed\\":" + p2 + ",\\"actual\\":\\"[1,2]\\",\\"expected\\":\\"[1,2]\\",\\"error\\":null}]");
        System.out.print("---TESTS_END---");
    }
}`;
    }
  }
  
  if (problemId === 2) { // Reverse String
    if (language === 'cpp') {
      return `${code}
\n#include <iostream>
#include <vector>
#include <string>

int main() {
    Solution solver;
    std::cout << "---TESTS_START---";
    std::vector<char> s1 = {'h','e','l','l','o'};
    solver.reverseString(s1);
    bool p1 = (s1[0]=='o' && s1[1]=='l' && s1[2]=='l' && s1[3]=='e' && s1[4]=='h');
    std::cout << "[{\\"passed\\":" << (p1 ? "true" : "false") << ",\\"actual\\":\\"reversed\\",\\"expected\\":\\"reversed\\",\\"error\\":null}]";
    std::cout << "---TESTS_END---" << std::endl;
    return 0;
}`;
    } else if (language === 'java') {
      return `import java.util.*;\n${code}
\npublic class SolutionMain {
    public static void main(String[] args) {
        Solution solver = new Solution();
        System.out.print("---TESTS_START---");
        char[] s1 = {'h','e','l','l','o'};
        solver.reverseString(s1);
        boolean p1 = s1[0]=='o' && s1[1]=='l' && s1[2]=='l' && s1[3]=='e' && s1[4]=='h';
        System.out.print("[{\\"passed\\":" + p1 + ",\\"actual\\":\\"reversed\\",\\"expected\\":\\"reversed\\",\\"error\\":null}]");
        System.out.print("---TESTS_END---");
    }
}`;
    }
  }

  if (problemId === 3) { // Fibonacci Number
    if (language === 'cpp') {
      return `${code}
\n#include <iostream>
int main() {
    Solution solver;
    std::cout << "---TESTS_START---";
    int r1 = solver.fib(2);
    int r2 = solver.fib(10);
    bool p1 = (r1 == 1);
    bool p2 = (r2 == 55);
    std::cout << "[{\\"passed\\":" << (p1 ? "true" : "false") << ",\\"actual\\":" << r1 << ",\\"expected\\":1,\\"error\\":null}";
    std::cout << ",{\\"passed\\":" << (p2 ? "true" : "false") << ",\\"actual\\":" << r2 << ",\\"expected\\":55,\\"error\\":null}]";
    std::cout << "---TESTS_END---" << std::endl;
    return 0;
}`;
    } else if (language === 'java') {
      return `${code}
\npublic class SolutionMain {
    public static void main(String[] args) {
        Solution solver = new Solution();
        System.out.print("---TESTS_START---");
        int r1 = solver.fib(2);
        int r2 = solver.fib(10);
        System.out.print("[{\\"passed\\":" + (r1==1) + ",\\"actual\\":" + r1 + ",\\"expected\\":1,\\"error\\":null}");
        System.out.print(",{\\"passed\\":" + (r2==55) + ",\\"actual\\":" + r2 + ",\\"expected\\":55,\\"error\\":null}]");
        System.out.print("---TESTS_END---");
    }
}`;
    }
  }

  if (problemId === 4) { // Is Prime
    if (language === 'cpp') {
      return `${code}
\n#include <iostream>
int main() {
    Solution solver;
    std::cout << "---TESTS_START---";
    bool r1 = solver.isPrime(4);
    bool r2 = solver.isPrime(17);
    std::cout << "[{\\"passed\\":" << (!r1 ? "true" : "false") << ",\\"actual\\":" << (r1?"true":"false") << ",\\"expected\\":false,\\"error\\":null}";
    std::cout << ",{\\"passed\\":" << (r2 ? "true" : "false") << ",\\"actual\\":" << (r2?"true":"false") << ",\\"expected\\":true,\\"error\\":null}]";
    std::cout << "---TESTS_END---" << std::endl;
    return 0;
}`;
    } else if (language === 'java') {
      return `${code}
\npublic class SolutionMain {
    public static void main(String[] args) {
        Solution solver = new Solution();
        System.out.print("---TESTS_START---");
        boolean r1 = solver.isPrime(4);
        boolean r2 = solver.isPrime(17);
        System.out.print("[{\\"passed\\":" + (!r1) + ",\\"actual\\":" + r1 + ",\\"expected\\":false,\\"error\\":null}");
        System.out.print(",{\\"passed\\":" + r2 + ",\\"actual\\":" + r2 + ",\\"expected\\":true,\\"error\\":null}]");
        System.out.print("---TESTS_END---");
    }
}`;
    }
  }

  return code;
}

// Orchestrator for executing submitted code
async function executeCode(code, language, problem = null, testCases = []) {
  const config = LANGUAGE_CONFIG[language.toLowerCase()];
  if (!config) {
    return { status: 'Error', error: `Unsupported language: ${language}` };
  }

  const problemId = problem ? (typeof problem === 'object' ? problem.id : problem) : null;
  const runId = crypto.randomUUID();
  const folderName = `run_${runId}`;
  const localRunFolder = path.join(TEMP_DIR, folderName);
  
  await fs.promises.mkdir(localRunFolder, { recursive: true });

  // Write files appropriately
  let fileName = language.toLowerCase() === 'java' ? 'Solution' : 'code';
  if (problemId && (language === 'cpp' || language === 'java')) {
    if (language === 'java') {
      fileName = 'Solution';
    } else {
      fileName = 'solution';
    }
  }

  const scriptFile = path.join(localRunFolder, `${fileName}${config.extension}`);
  const compiledCode = problem ? appendWrapper(code, language, problem) : code;
  
  await fs.promises.writeFile(scriptFile, compiledCode);

  // Write tests.json inside the run folder for dynamic wrapper access
  if (problemId && testCases && testCases.length > 0) {
    const testsFile = path.join(localRunFolder, 'tests.json');
    await fs.promises.writeFile(testsFile, JSON.stringify(testCases));
  }

  const dockerActive = await isDockerAvailable();
  
  let result;
  if (dockerActive) {
    result = await executeInDocker(localRunFolder, scriptFile, language, config, testCases, problemId);
  } else {
    result = await executeInChildProcess(localRunFolder, scriptFile, language, config, testCases, problemId);
  }

  // Cleanup temp files
  try {
    await fs.promises.rm(localRunFolder, { recursive: true, force: true });
  } catch (cleanError) {
    console.warn(`Failed to cleanup: ${localRunFolder}`, cleanError.message);
  }

  return result;
}

// Isolated Docker sandbox execution
function executeInDocker(runFolder, scriptFile, language, config, testCases, problemId) {
  return new Promise((resolve) => {
    const filename = path.basename(scriptFile);
    const containerWorkdir = '/usr/src/app';
    const containerFile = `${containerWorkdir}/${filename}`;
    const runId = path.basename(runFolder);

    let dockerCmd = [
      'run',
      '--rm',
      '--name', runId,
      '-v', `${runFolder}:${containerWorkdir}`,
      '-m', MEMORY_LIMIT,
      '--cpus', CPU_LIMIT,
      '--net', 'none',
      '--user', '1000:1000', // Non-root running
      config.dockerImage
    ];

    let shellCommand = '';

    // C++ Compile & Run workflow
    if (language === 'cpp') {
      const containerBin = `${containerWorkdir}/solution_binary`;
      shellCommand = `g++ -O3 ${containerFile} -o ${containerBin} && ${containerBin}`;
      dockerCmd.push('sh', '-c', shellCommand);
    } 
    // Java Compile & Run workflow
    else if (language === 'java') {
      const mainClass = problemId ? 'SolutionMain' : 'Solution';
      shellCommand = `javac ${containerFile} && java -cp ${containerWorkdir} ${mainClass}`;
      dockerCmd.push('sh', '-c', shellCommand);
    } 
    // Python / Node direct run
    else {
      let runnerExec = config.dockerRunCmd(containerFile);
      dockerCmd.push('sh', '-c', runnerExec);
    }

    const startTime = Date.now();
    const processInstance = spawn('docker', dockerCmd);

    let stdout = '';
    let stderr = '';

    processInstance.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    processInstance.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    let limitTimeout = setTimeout(() => {
      exec(`docker kill ${runId}`, () => {
        const isPulling = stderr.toLowerCase().includes('pulling') || stdout.toLowerCase().includes('pulling') || stderr.toLowerCase().includes('unable to find image');
        let errorMsg = 'Execution timed out (Max 4.0s allowed).';
        if (isPulling) {
          errorMsg = `Docker is downloading the base execution image ('${config.dockerImage}') from Docker Hub for the first time.\n\nThis download exceeded our secure 4.0s execution timeout.\n\n👉 WHAT TO DO:\n1. Please wait 10-15 seconds for Docker Desktop to finish pulling the image in the background.\n2. Or, open a terminal and run 'docker pull ${config.dockerImage}' to pre-fetch it.\n3. Once downloaded, subsequent executions will run in milliseconds! Click 'Run' or 'Submit' again.`;
        }
        resolve({
          status: 'Time Limit Exceeded',
          error: errorMsg,
          stdout,
          stderr,
          runtimeMs: TIMEOUT_LIMIT
        });
      });
    }, TIMEOUT_LIMIT);

    processInstance.on('close', (code) => {
      clearTimeout(limitTimeout);
      const runtimeMs = Date.now() - startTime;

      if (code !== 0) {
        // Check for out of memory
        const isOOM = stderr.toLowerCase().includes('out of memory') || stderr.toLowerCase().includes('killed') || code === 137;
        resolve({
          status: isOOM ? 'Memory Limit Exceeded' : 'Runtime Error',
          error: stderr || `Process exited with code ${code}`,
          stdout,
          stderr,
          runtimeMs
        });
      } else {
        resolve(processExecutionOutput(stdout, stderr, runtimeMs, problemId));
      }
    });
  });
}

// Child process execution local fallback
function executeInChildProcess(runFolder, scriptFile, language, config, testCases, problemId) {
  return new Promise(async (resolve) => {
    const startTime = Date.now();

    try {
      // Compilation phase for compiled languages
      if (language === 'cpp') {
        const binaryPath = path.join(runFolder, 'solution_bin.exe');
        await new Promise((res, rej) => {
          exec(config.compileCmd(scriptFile, binaryPath), (err, stdout, stderr) => {
            if (err) rej(stderr || err.message);
            else res();
          });
        });
        
        // Execute compiled binary
        runExec(binaryPath, '', resolve);
      } else if (language === 'java') {
        const mainClass = problemId ? 'SolutionMain' : 'Solution';
        await new Promise((res, rej) => {
          exec(config.compileCmd(scriptFile), (err, stdout, stderr) => {
            if (err) rej(stderr || err.message);
            else res();
          });
        });

        const javaExec = `java -cp "${runFolder}" ${mainClass}`;
        runExec(javaExec, '', resolve);
      } else {
        const runCmd = config.runCmd(scriptFile);
        runExec(runCmd, '', resolve);
      }
    } catch (compileErr) {
      resolve({
        status: 'Compile Error',
        error: compileErr,
        stdout: '',
        stderr: compileErr,
        runtimeMs: Date.now() - startTime
      });
    }

    function runExec(commandString, inputStdin, resolveFn) {
      const runner = exec(commandString, { timeout: TIMEOUT_LIMIT, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        const runtimeMs = Date.now() - startTime;
        
        if (error) {
          if (error.killed) {
            resolveFn({
              status: 'Time Limit Exceeded',
              error: 'Execution timed out (Max 4.0s allowed).',
              stdout,
              stderr,
              runtimeMs: TIMEOUT_LIMIT
            });
          } else {
            resolveFn({
              status: 'Runtime Error',
              error: stderr || error.message,
              stdout,
              stderr,
              runtimeMs
            });
          }
        } else {
          resolveFn(processExecutionOutput(stdout, stderr, runtimeMs, problemId));
        }
      });
    }
  });
}

// Parses Wrapper Assert outputs and formats standard JSON payloads
function processExecutionOutput(stdout, stderr, runtimeMs, problemId) {
  if (!problemId) {
    return {
      status: 'Success',
      stdout,
      stderr,
      runtimeMs
    };
  }

  // Look for injected markers: ---TESTS_START--- and ---TESTS_END---
  const startMarker = '---TESTS_START---';
  const endMarker = '---TESTS_END---';

  const startIndex = stdout.indexOf(startMarker);
  const endIndex = stdout.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    return {
      status: 'Runtime Error',
      error: 'Test case execution marker missing. Did the execution crash or exit prematurely?',
      stdout,
      stderr,
      runtimeMs
    };
  }

  const jsonStr = stdout.substring(startIndex + startMarker.length, endIndex);
  try {
    const testResults = JSON.parse(jsonStr);
    const totalCount = testResults.length;
    const passedCount = testResults.filter(r => r.passed).length;
    const allPassed = passedCount === totalCount;
    
    // Pick the first failed test case's error if exists
    const failedTest = testResults.find(r => !r.passed);
    const errorMessage = failedTest ? (failedTest.error || 'Assertion failed: expected value did not match actual output') : null;

    return {
      status: allPassed ? 'Accepted' : 'Wrong Answer',
      testResults,
      totalCount,
      passedCount,
      error: errorMessage,
      stdout: stdout.replace(startMarker + jsonStr + endMarker, ''), // Strip the injected log
      stderr,
      runtimeMs
    };
  } catch (parseError) {
    return {
      status: 'Runtime Error',
      error: `Failed to parse test results: ${parseError.message}`,
      stdout,
      stderr,
      runtimeMs
    };
  }
}

module.exports = {
  executeCode,
  isDockerAvailable
};
