import { useState } from 'react';
import { apiClient } from '../api/client'; // Make sure this is imported at the top!


export default function ParticipantDashboard({ onSubmitAssessment }) {
  // Theme and UI State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [activeQuestion, setActiveQuestion] = useState(1);
  
  // Assessment State
  const [language, setLanguage] = useState('Python 3');
  const [code, setCode] = useState('def getTripletCount(arr, d):\n    n = len(arr)\n    count = 0\n    \n    # Write your logic here\n    \n    return count');
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Mock Question List (matching the S1, S2, S3 flow)
  const questions = [1, 2, 3];

  const normalizeTestCases = (details) => {
    if (Array.isArray(details)) return details;
    if (details && Array.isArray(details.cases)) return details.cases;
    if (details && Array.isArray(details.test_cases)) return details.test_cases;
    return [];
  };

  // Mock Problem Data
  const problem = {
    title: "Counting Triplets",
    description: "Given an integer array arr[n] and an integer d, count the number of distinct triplets (i, j, k) where:",
    bullets: [
      "0 ≤ i < j < k < n",
      "The sum arr[i] + arr[j] + arr[k] is divisible by d"
    ],
    example: {
      input: "arr = [3, 3, 4, 7, 8]\nd = 5",
      output: "3",
      explanation: "(0, 1, 2): 3 + 3 + 4 = 10 (divisible by 5)\n(0, 2, 4): 3 + 4 + 8 = 15 (divisible by 5)\n(1, 2, 4): 3 + 4 + 8 = 15 (divisible by 5)"
    }
  };

  // ... inside your component:

  const handleRunCode = async () => {
    setIsRunning(true);
    setConsoleOpen(true);
    setTestResults(null); // Clear previous results
    
    // Map the dropdown text to your Judge0 Language IDs
    const getLangId = (langName) => {
      if (langName === 'Python 3') return 71;
      if (langName === 'C++') return 54;
      return 63; // JavaScript fallback
    };

    try {
      // Send the code to your actual FastAPI backend
      const response = await apiClient.post('/coding/submit', {
        problem_id: activeQuestion,
        language_id: getLangId(language),
        source_code: code
      });

      // The backend returns the Judge0 compilation results
      const { status, passed_cases, total_cases, details } = response.data;
      
      setTestResults({
        passed: passed_cases,
        total: total_cases,
        status: status,
        cases: normalizeTestCases(details) // The array of input/output diffs
      });

    } catch (error) {
      console.error("Compilation Error:", error);
      setTestResults({
        passed: 0,
        total: 0,
        status: "Server Error",
        cases: [{
          id: 1, 
          passed: false, 
          input: "N/A", 
          expected: "Valid execution", 
          output: error.response?.data?.detail || "Failed to connect to compilation server."
        }]
      });
    } finally {
      setIsRunning(false);
    }
  };
  // Theme configuration dictionaries (added a darker 'nav' background for the new sidebar)
  const theme = isDarkMode 
    ? { bg: 'bg-[#0e141e]', panel: 'bg-[#1a202c]', nav: 'bg-[#0b1017]', text: 'text-gray-300', textMuted: 'text-gray-500', border: 'border-gray-800' }
    : { bg: 'bg-gray-50', panel: 'bg-white', nav: 'bg-gray-200', text: 'text-gray-900', textMuted: 'text-gray-500', border: 'border-gray-200' };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden border-none ${theme.border} font-sans transition-colors duration-300`}>
      
      {/* Top Navigation Bar */}
      <div className={`h-12 ${theme.panel} border-b ${theme.border} flex justify-between items-center px-4 shrink-0`}>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-bold tracking-wide ${theme.text}`}>HackerCore IDE</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 rounded-md ${isDarkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'} transition-colors`}
            title="Toggle Theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          <span className="text-xs font-semibold text-green-500 border border-green-500/30 bg-green-500/10 px-3 py-1 rounded-full flex items-center gap-1">
            <span>🕒</span> 54 min 9 sec
          </span>
          
          <button 
            onClick={() => {
              if(window.confirm("Are you sure you want to submit your final assessment? You cannot return to this page.")) {
                onSubmitAssessment();
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 text-sm font-bold rounded-md transition-colors"
          >
            Save & Proceed
          </button>
        </div>
      </div>

      {/* Main Split Layout (Now 3 Columns) */}
      <div className={`flex flex-1 overflow-hidden ${theme.bg}`}>
        
        {/* COLUMN 1: Question Navigator Sidebar */}
        <div className={`w-16 flex flex-col items-center py-4 border-r ${theme.border} ${theme.nav} shrink-0 overflow-y-auto`}>
          {questions.map((q) => (
            <div key={q} className="mb-6 flex flex-col items-center gap-2">
              <span className={`text-xs font-bold ${theme.textMuted}`}>S{q}</span>
              <button
                onClick={() => setActiveQuestion(q)}
                className={`w-10 h-10 rounded font-bold transition-all flex items-center justify-center
                  ${activeQuestion === q 
                    ? 'border border-green-500 text-green-500 bg-green-500/10' 
                    : `text-gray-500 hover:${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`
                  }`}
              >
                {q}
              </button>
            </div>
          ))}
          {/* Settings icon pushed to the bottom */}
          <div className="mt-auto pt-4 text-gray-500 hover:text-gray-300 cursor-pointer">
            ⚙️
          </div>
        </div>

        {/* COLUMN 2: LEFT PANE: Problem Description */}
        <div className={`w-1/3 min-w-[300px] overflow-y-auto p-6 border-r ${theme.border} ${theme.text}`}>
          <h1 className="text-2xl font-bold mb-4">{problem.title}</h1>
          <p className="mb-4 leading-relaxed">{problem.description}</p>
          <ul className="list-disc list-inside mb-6 space-y-2 pl-2">
            {problem.bullets.map((bullet, idx) => (
              <li key={idx} className="font-mono text-sm">{bullet}</li>
            ))}
          </ul>

          <h3 className="text-lg font-bold mb-2">Example</h3>
          <div className={`p-4 rounded-md font-mono text-sm mb-6 ${isDarkMode ? 'bg-[#2a303c]' : 'bg-gray-100'}`}>
            {problem.example.input}
          </div>

          <h3 className="text-sm font-bold mb-2 uppercase tracking-wide text-gray-500">Explanation</h3>
          <div className={`p-4 rounded-md font-mono text-sm mb-6 ${isDarkMode ? 'bg-[#2a303c]' : 'bg-gray-100'} whitespace-pre-line`}>
            {problem.example.explanation}
          </div>
        </div>

        {/* COLUMN 3: RIGHT PANE: Code Editor & Console */}
        <div className="flex-1 flex flex-col relative">
          
          {/* Editor Header */}
          <div className={`h-12 ${theme.panel} border-b ${theme.border} flex items-center justify-between px-4 shrink-0`}>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`bg-transparent border ${theme.border} ${theme.text} text-sm rounded px-2 py-1 outline-none focus:border-green-500 transition-colors`}
            >
              <option className="bg-gray-800 text-white">Python 3</option>
              <option className="bg-gray-800 text-white">C++</option>
              <option className="bg-gray-800 text-white">JavaScript</option>
            </select>
            <button className={`text-sm ${theme.textMuted} hover:text-blue-500 transition-colors`}>↻ Reset Code</button>
          </div>

          {/* Editor Body */}
          <div className="flex-1 relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full h-full p-4 font-mono text-sm resize-none outline-none ${theme.bg} ${theme.text}`}
              spellCheck="false"
            />
          </div>

          {/* Bottom Console Panel */}
          <div className={`border-t ${theme.border} ${theme.panel} flex flex-col transition-all duration-300 ${consoleOpen ? 'h-64' : 'h-12'}`}>
            <div className="h-12 flex justify-between items-center px-4 shrink-0 cursor-pointer hover:bg-black/10 transition-colors" onClick={() => setConsoleOpen(!consoleOpen)}>
              <div className={`font-semibold ${theme.text}`}>
                Console {consoleOpen ? '▼' : '▲'}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleRunCode(); }}
                className={`border px-4 py-1 text-sm font-bold rounded-md transition-colors ${isDarkMode ? 'border-green-500 text-green-500 hover:bg-green-900/30' : 'border-green-600 text-green-700 hover:bg-green-50'}`}
              >
                {isRunning ? 'Running...' : '▶ Run Code'}
              </button>
            </div>

            {/* Console Output Area */}
            {consoleOpen && (
              <div className={`flex-1 overflow-y-auto p-4 ${theme.bg}`}>
                {!testResults && !isRunning && (
                  <div className={`text-center mt-10 ${theme.textMuted}`}>
                    Click "Run Code" to compile and test your logic against custom test cases.
                  </div>
                )}
                
                {isRunning && (
                  <div className={`text-center mt-10 ${theme.textMuted} animate-pulse`}>
                    Evaluating on Judge0 servers...
                  </div>
                )}

                {testResults && !isRunning && (
                  <div>
                    <h4 className={`font-bold mb-4 ${testResults.passed === testResults.total ? 'text-green-500' : 'text-red-500'}`}>
                      {testResults.passed} / {testResults.total} test cases passed
                    </h4>
                    <div className="space-y-4">
                      {(testResults.cases || []).map(tc => (
                        <div key={tc.id} className={`p-3 rounded border ${isDarkMode ? 'bg-[#2a303c] border-gray-700' : 'bg-white border-gray-200'}`}>
                          <div className={`font-bold text-sm mb-2 ${tc.passed ? 'text-green-500' : 'text-red-500'}`}>
                            {tc.passed ? '✓' : '✗'} Test Case {tc.id}
                          </div>
                          {!tc.passed && (
                            <div className="grid grid-cols-2 gap-4 font-mono text-xs mt-2">
                              <div>
                                <span className={theme.textMuted}>Input:</span>
                                <div className={`mt-1 p-2 rounded ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>{tc.input}</div>
                              </div>
                              <div>
                                <span className={theme.textMuted}>Your Output:</span>
                                <div className="mt-1 p-2 rounded bg-red-900/20 text-red-400">{tc.output}</div>
                                <span className={`block mt-2 ${theme.textMuted}`}>Expected:</span>
                                <div className={`mt-1 p-2 rounded ${isDarkMode ? 'bg-gray-900 text-green-400' : 'bg-gray-100 text-green-600'}`}>{tc.expected}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {(testResults.cases || []).length === 0 && (
                        <div className={`p-3 rounded border text-sm ${isDarkMode ? 'bg-[#2a303c] border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                          No detailed test case output was returned by the server.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
