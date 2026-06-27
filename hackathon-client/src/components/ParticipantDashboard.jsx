import { useState } from 'react';
import { apiClient } from '../api/client';

export default function ParticipantDashboard({ onSubmitAssessment }) {
  // Theme and UI State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [activeQuestionId, setActiveQuestionId] = useState(1);
  
  // Coding State
  const [language, setLanguage] = useState('Python 3');
  const [code, setCode] = useState('def solve():\n    pass');
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // MCQ State
  const [selectedOption, setSelectedOption] = useState('');
  const [mcqResult, setMcqResult] = useState(null);
  const [isSubmittingMCQ, setIsSubmittingMCQ] = useState(false);

  // Mock Question List with Types
  const questionsList = [
    { id: 1, type: 'coding', label: 'S1' },
    { id: 2, type: 'mcq', label: 'M1' },
    { id: 3, type: 'coding', label: 'S2' }
  ];

  // Mock Database Data
  const mockDatabase = {
    1: {
      type: 'coding',
      title: "Counting Triplets",
      description: "Given an integer array arr[n] and an integer d, count the number of distinct triplets (i, j, k) where:",
      bullets: ["0 ≤ i < j < k < n", "The sum arr[i] + arr[j] + arr[k] is divisible by d"],
      example: { input: "arr = [3, 3, 4, 7, 8]\nd = 5", output: "3", explanation: "(0, 1, 2): 3 + 3 + 4 = 10\n(0, 2, 4): 3 + 4 + 8 = 15" }
    },
    2: {
      type: 'mcq',
      title: "Algorithmic Complexity",
      description: "In a heavily unbalanced binary search tree, what is the worst-case time complexity for a search operation?",
      options: {
        "A": "O(1)",
        "B": "O(log n)",
        "C": "O(n)",
        "D": "O(n log n)"
      }
    },
    3: {
      type: 'coding',
      title: "Valid Palindrome",
      description: "Determine if a given string is a valid palindrome, ignoring non-alphanumeric characters.",
      bullets: ["String length <= 10^5"],
      example: { input: "s = 'A man, a plan, a canal: Panama'", output: "true", explanation: "'amanaplanacanalpanama' is a palindrome." }
    }
  };

  const activeProblem = mockDatabase[activeQuestionId];

  const normalizeTestCases = (details) => {
    if (Array.isArray(details)) return details;
    if (details && Array.isArray(details.cases)) return details.cases;
    if (details && Array.isArray(details.test_cases)) return details.test_cases;
    return [];
  };

  // --- HANDLERS ---

  const handleRunCode = async () => {
    setIsRunning(true);
    setConsoleOpen(true);
    setTestResults(null);
    
    const getLangId = (langName) => {
      if (langName === 'Python 3') return 71;
      if (langName === 'C++') return 54;
      return 63; // JS fallback
    };

    try {
      const response = await apiClient.post('/coding/submit', {
        problem_id: activeQuestionId,
        language_id: getLangId(language),
        source_code: code
      });
      
      const { status, passed_cases, total_cases, details } = response.data;
      setTestResults({
        passed: passed_cases,
        total: total_cases,
        status: status,
        cases: normalizeTestCases(details)
      });
    } catch (error) {
      setTestResults({
        passed: 0, total: 0, status: "Server Error",
        cases: [{ id: 1, passed: false, input: "N/A", expected: "Execution", output: error.response?.data?.detail || "Failed to connect to execution engine." }]
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleMCQSubmit = async () => {
    if (!selectedOption) return;
    setIsSubmittingMCQ(true);
    setMcqResult(null);

    try {
      const response = await apiClient.post('/mcq/submit', {
        question_id: activeQuestionId,
        selected_option: selectedOption
      });
      
      // Response contains is_correct and correct_answer
      setMcqResult(response.data);
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to submit MCQ.");
    } finally {
      setIsSubmittingMCQ(false);
    }
  };

  const handleQuestionChange = (id) => {
    setActiveQuestionId(id);
    setSelectedOption(''); // Reset MCQ selection when switching
    setMcqResult(null);
    setTestResults(null);
  };

  // Theme Config
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
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-1.5 rounded-md ${isDarkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          <span className="text-xs font-semibold text-green-500 border border-green-500/30 bg-green-500/10 px-3 py-1 rounded-full flex items-center gap-1">
            <span>🕒</span> 54 min 9 sec
          </span>
          
          <button 
            onClick={() => {
              if(window.confirm("Are you sure you want to submit your final assessment?")) {
                onSubmitAssessment();
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 text-sm font-bold rounded-md"
          >
            Save & Proceed
          </button>
        </div>
      </div>

      <div className={`flex flex-1 overflow-hidden ${theme.bg}`}>
        
        {/* COLUMN 1: Sidebar Navigator */}
        <div className={`w-16 flex flex-col items-center py-4 border-r ${theme.border} ${theme.nav} shrink-0 overflow-y-auto`}>
          {questionsList.map((q) => (
            <div key={q.id} className="mb-6 flex flex-col items-center gap-2">
              <span className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{q.type}</span>
              <button
                onClick={() => handleQuestionChange(q.id)}
                className={`w-10 h-10 rounded font-bold transition-all flex items-center justify-center
                  ${activeQuestionId === q.id 
                    ? 'border border-green-500 text-green-500 bg-green-500/10' 
                    : `text-gray-500 hover:${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`
                  }`}
              >
                {q.label}
              </button>
            </div>
          ))}
        </div>

        {/* COLUMN 2: Problem Description */}
        <div className={`w-1/3 min-w-[300px] overflow-y-auto p-6 border-r ${theme.border} ${theme.text}`}>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">{activeProblem.title}</h1>
            <span className="px-2 py-1 text-xs font-bold uppercase rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {activeProblem.type}
            </span>
          </div>
          
          <p className="mb-4 leading-relaxed">{activeProblem.description}</p>
          
          {activeProblem.type === 'coding' && (
            <>
              <ul className="list-disc list-inside mb-6 space-y-2 pl-2">
                {activeProblem.bullets.map((bullet, idx) => (
                  <li key={idx} className="font-mono text-sm">{bullet}</li>
                ))}
              </ul>
              <h3 className="text-lg font-bold mb-2">Example</h3>
              <div className={`p-4 rounded-md font-mono text-sm mb-6 ${isDarkMode ? 'bg-[#2a303c]' : 'bg-gray-100'}`}>
                {activeProblem.example.input}
              </div>
              <h3 className="text-sm font-bold mb-2 uppercase tracking-wide text-gray-500">Explanation</h3>
              <div className={`p-4 rounded-md font-mono text-sm mb-6 ${isDarkMode ? 'bg-[#2a303c]' : 'bg-gray-100'} whitespace-pre-line`}>
                {activeProblem.example.explanation}
              </div>
            </>
          )}
        </div>

        {/* COLUMN 3: Interaction Area (Code Editor OR MCQ Form) */}
        <div className="flex-1 flex flex-col relative overflow-y-auto">
          
          {activeProblem.type === 'coding' ? (
            // --- CODING INTERFACE ---
            <>
              <div className={`h-12 ${theme.panel} border-b ${theme.border} flex items-center justify-between px-4 shrink-0`}>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`bg-transparent border ${theme.border} ${theme.text} text-sm rounded px-2 py-1 outline-none focus:border-green-500`}
                >
                  <option className="bg-gray-800 text-white">Python 3</option>
                  <option className="bg-gray-800 text-white">C++</option>
                  <option className="bg-gray-800 text-white">JavaScript</option>
                </select>
              </div>

              <div className="flex-1 relative">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`w-full h-full p-4 font-mono text-sm resize-none outline-none ${theme.bg} ${theme.text}`}
                  spellCheck="false"
                />
              </div>

              {/* Coding Console */}
              <div className={`border-t ${theme.border} ${theme.panel} flex flex-col transition-all duration-300 ${consoleOpen ? 'h-64' : 'h-12'}`}>
                <div className="h-12 flex justify-between items-center px-4 shrink-0 cursor-pointer" onClick={() => setConsoleOpen(!consoleOpen)}>
                  <div className={`font-semibold ${theme.text}`}>Console {consoleOpen ? '▼' : '▲'}</div>
                  <button onClick={(e) => { e.stopPropagation(); handleRunCode(); }} className={`border px-4 py-1 text-sm font-bold rounded-md ${isDarkMode ? 'border-green-500 text-green-500 hover:bg-green-900/30' : 'border-green-600 text-green-700 hover:bg-green-50'}`}>
                    {isRunning ? 'Running...' : '▶ Run Code'}
                  </button>
                </div>

                {consoleOpen && (
                  <div className={`flex-1 overflow-y-auto p-4 ${theme.bg}`}>
                    {!testResults && !isRunning && <div className={`text-center mt-10 ${theme.textMuted}`}>Click "Run Code" to compile and test your logic.</div>}
                    {isRunning && <div className={`text-center mt-10 ${theme.textMuted} animate-pulse`}>Executing on server...</div>}
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
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            // --- MCQ INTERFACE ---
            <div className={`flex-1 p-8 ${theme.bg}`}>
              <h2 className={`text-xl font-bold mb-6 ${theme.text}`}>Select the correct answer:</h2>
              
              <div className="space-y-4 max-w-2xl">
                {Object.entries(activeProblem.options).map(([key, value]) => (
                  <label 
                    key={key}
                    className={`flex items-center p-4 rounded-lg cursor-pointer border transition-all duration-200
                      ${selectedOption === key 
                        ? (isDarkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500') 
                        : (isDarkMode ? 'bg-[#1a202c] border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400')
                      }
                    `}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 
                      ${selectedOption === key ? 'border-blue-500' : 'border-gray-400'}`}
                    >
                      {selectedOption === key && <div className="w-3 h-3 rounded-full bg-blue-500" />}
                    </div>
                    <span className={`font-bold mr-3 ${theme.textMuted}`}>{key}.</span>
                    <span className={theme.text}>{value}</span>
                  </label>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-700/50 max-w-2xl flex justify-between items-center">
                <button
                  onClick={handleMCQSubmit}
                  disabled={!selectedOption || isSubmittingMCQ}
                  className={`px-6 py-2.5 rounded-md font-bold transition-all
                    ${!selectedOption 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'}
                  `}
                >
                  {isSubmittingMCQ ? 'Submitting...' : 'Submit Answer'}
                </button>

                {mcqResult && (
                  <div className={`text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-lg 
                    ${mcqResult.is_correct ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {mcqResult.is_correct ? '✅ Correct!' : '❌ Incorrect.'}
                    {!mcqResult.is_correct && <span className="ml-2 text-gray-400 font-normal">Correct answer was: {mcqResult.correct_answer}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}