import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';

const LANGUAGES = {
  'Python 3': { judgeId: 71, extension: 'py' },
  'JavaScript': { judgeId: 63, extension: 'js' },
  'C++': { judgeId: 54, extension: 'cpp' }
};

const DEFAULT_LANGUAGE = 'Python 3';

const GENERIC_STARTERS = {
  'Python 3': `import sys


def solve(input_text):
    # Write your solution here
    return ""


if __name__ == "__main__":
    print(solve(sys.stdin.read()))`,
  'JavaScript': `const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');

function solve(data) {
  // Write your solution here
  return '';
}

console.log(solve(input));`,
  'C++': `#include <bits/stdc++.h>
using namespace std;

string solve(const string& input) {
    // Write your solution here
    return "";
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    cout << solve(input) << endl;
    return 0;
}`
};

const getStarterCode = (question, language) => {
  if (question?.starter_code?.[language]) return question.starter_code[language];
  return GENERIC_STARTERS[language];
};

const normalizeQuestion = (question, index) => ({
  ...question,
  label: question.label || `${question.type === 'coding' ? 'S' : 'M'}${index + 1}`,
  title: question.title || `Question ${index + 1}`,
  description: question.description || '',
  difficulty: question.difficulty || (question.type === 'coding' ? 'Coding' : 'MCQ'),
  points: question.points ?? (question.type === 'coding' ? 50 : 10),
  constraints: Array.isArray(question.constraints) ? question.constraints : [],
  inputFormat: question.inputFormat || question.input_format || '',
  outputFormat: question.outputFormat || question.output_format || '',
  examples: Array.isArray(question.examples) ? question.examples : [],
  options: question.options || {},
});

const getInitialCode = (questions, language) => {
  const initial = {};

  questions.forEach((question) => {
    if (question.type === 'coding') {
      initial[question.id] = getStarterCode(question, language);
    }
  });

  return initial;
};

const normalizeTestCases = (details) => {
  if (Array.isArray(details)) return details;
  if (details && Array.isArray(details.cases)) return details.cases;
  if (details && Array.isArray(details.test_cases)) return details.test_cases;
  return [];
};

const formatApiError = (error) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(item => item.msg).join(', ');
  return 'Failed to connect to execution engine.';
};

export default function ParticipantDashboard({ onSubmitAssessment }) {
  const editorRef = useRef(null);
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(true);
  const [assessmentError, setAssessmentError] = useState('');
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [codeByQuestion, setCodeByQuestion] = useState({});
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [problemPaneWidth, setProblemPaneWidth] = useState(38);
  const [consoleHeight, setConsoleHeight] = useState(260);
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedOptionsByQuestion, setSelectedOptionsByQuestion] = useState({});
  const [mcqResult, setMcqResult] = useState(null);
  const [isSubmittingMCQ, setIsSubmittingMCQ] = useState(false);
  const [visitedQuestions, setVisitedQuestions] = useState({});
  const [answeredQuestions, setAnsweredQuestions] = useState({});

  useEffect(() => {
    let isMounted = true;

    const loadAssessment = async () => {
      setIsLoadingAssessment(true);
      setAssessmentError('');

      try {
        const response = await apiClient.get('/assessment/current');
        if (!isMounted) return;

        const loadedQuestions = (response.data.questions || []).map(normalizeQuestion);
        const firstQuestion = loadedQuestions[0];

        setAssessment(response.data);
        setQuestions(loadedQuestions);
        setActiveQuestionId(firstQuestion?.id || null);
        setVisitedQuestions(firstQuestion ? { [firstQuestion.id]: true } : {});
        setAnsweredQuestions(
          loadedQuestions.reduce((answered, question) => {
            if (question.answered) answered[question.id] = true;
            return answered;
          }, {})
        );
        setSelectedOptionsByQuestion(
          loadedQuestions.reduce((selectedOptions, question) => {
            if (question.selected_option) {
              selectedOptions[question.id] = question.selected_option;
            }
            return selectedOptions;
          }, {})
        );
        setCodeByQuestion(getInitialCode(loadedQuestions, DEFAULT_LANGUAGE));
      } catch (error) {
        if (!isMounted) return;
        setAssessmentError(error.response?.data?.detail || 'Could not load the assessment.');
      } finally {
        if (isMounted) setIsLoadingAssessment(false);
      }
    };

    loadAssessment();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProblem = questions.find(question => question.id === activeQuestionId);
  const selectedOption = selectedOptionsByQuestion[activeQuestionId] || '';
  const currentCode = activeProblem?.type === 'coding'
    ? (codeByQuestion[activeQuestionId] || getStarterCode(activeProblem, language))
    : '';
  const lineCount = Math.max(currentCode.split('\n').length, 18);

  const setCurrentCode = (nextCode) => {
    setCodeByQuestion(prev => ({ ...prev, [activeQuestionId]: nextCode }));
  };

  const restoreSelection = (start, end = start) => {
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(start, end);
    });
  };

  const handleEditorKeyDown = (event) => {
    if (event.key !== 'Tab') return;

    event.preventDefault();

    const target = event.currentTarget;
    const value = target.value;
    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const selectedText = value.slice(selectionStart, selectionEnd);
    const selectionSpansLines = selectedText.includes('\n');

    if (!event.shiftKey && !selectionSpansLines) {
      const nextValue = `${value.slice(0, selectionStart)}    ${value.slice(selectionEnd)}`;
      setCurrentCode(nextValue);
      restoreSelection(selectionStart + 4);
      return;
    }

    const blockStart = selectionSpansLines ? lineStart : value.lastIndexOf('\n', selectionStart - 1) + 1;
    const blockEnd = selectionSpansLines
      ? selectionEnd
      : value.indexOf('\n', selectionStart) === -1 ? value.length : value.indexOf('\n', selectionStart);
    const before = value.slice(0, blockStart);
    const block = value.slice(blockStart, blockEnd);
    const after = value.slice(blockEnd);
    const lines = block.split('\n');

    if (event.shiftKey) {
      let removedBeforeCursor = 0;
      let removedTotal = 0;
      const nextLines = lines.map((line, index) => {
        const removable = line.startsWith('    ') ? 4 : line.startsWith('\t') ? 1 : line.match(/^ {1,3}/)?.[0].length || 0;
        if (index === 0) removedBeforeCursor = removable;
        removedTotal += removable;
        return line.slice(removable);
      });

      setCurrentCode(`${before}${nextLines.join('\n')}${after}`);
      restoreSelection(
        Math.max(blockStart, selectionStart - removedBeforeCursor),
        Math.max(blockStart, selectionEnd - removedTotal)
      );
      return;
    }

    const nextBlock = lines.map(line => `    ${line}`).join('\n');
    setCurrentCode(`${before}${nextBlock}${after}`);
    restoreSelection(selectionStart + 4, selectionEnd + (lines.length * 4));
  };

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);

    if (activeProblem?.type === 'coding') {
      setCurrentCode(getStarterCode(activeProblem, nextLanguage));
      setTestResults(null);
    }
  };

  const handleQuestionChange = (id) => {
    setActiveQuestionId(id);
    setVisitedQuestions(prev => ({ ...prev, [id]: true }));
    setMcqResult(null);
    setTestResults(null);
    setConsoleOpen(true);
  };

  const handleRunCode = async () => {
    if (activeProblem?.type !== 'coding') return;

    setIsRunning(true);
    setConsoleOpen(true);
    setTestResults(null);

    try {
      const response = await apiClient.post('/coding/submit', {
        problem_id: activeQuestionId,
        language_id: LANGUAGES[language].judgeId,
        source_code: currentCode
      });

      const { status, passed_cases, total_cases, details } = response.data;
      setTestResults({
        passed: passed_cases,
        total: total_cases,
        status,
        cases: normalizeTestCases(details)
      });

      if (passed_cases === total_cases && total_cases > 0) {
        setAnsweredQuestions(prev => ({ ...prev, [activeQuestionId]: true }));
      }
    } catch (error) {
      setTestResults({
        passed: 0,
        total: 0,
        status: 'Server Error',
        cases: [{
          id: 1,
          passed: false,
          input: 'N/A',
          expected: 'Execution',
          output: formatApiError(error)
        }]
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleMCQSubmit = async () => {
    if (!selectedOption || activeProblem?.type !== 'mcq') return;

    setIsSubmittingMCQ(true);
    setMcqResult(null);

    try {
      const response = await apiClient.post('/mcq/submit', {
        question_id: activeQuestionId,
        selected_option: selectedOption
      });

      setMcqResult(response.data);
      setSelectedOptionsByQuestion(prev => ({
        ...prev,
        [activeQuestionId]: response.data.selected_option || selectedOption
      }));
      setAnsweredQuestions(prev => ({ ...prev, [activeQuestionId]: true }));
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to submit answer.');
    } finally {
      setIsSubmittingMCQ(false);
    }
  };

  const handleResetCode = () => {
    if (window.confirm('Reset this editor to the starter code?')) {
      setCurrentCode(getStarterCode(activeProblem, language));
      setTestResults(null);
    }
  };

  const answeredCount = Object.keys(answeredQuestions).length;

  const handleProblemResizeStart = (event) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = problemPaneWidth;
    const availableWidth = Math.max(window.innerWidth - 80, 1);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / availableWidth) * 100;
      const nextWidth = Math.min(58, Math.max(28, startWidth + deltaPercent));
      setProblemPaneWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleConsoleResizeStart = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = consoleHeight;
    const maxHeight = Math.max(160, window.innerHeight - 220);

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      const nextHeight = Math.min(maxHeight, Math.max(96, startHeight - (moveEvent.clientY - startY)));
      setConsoleHeight(nextHeight);
      setConsoleOpen(true);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (isLoadingAssessment) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b111b] text-slate-200">
        <div className="text-sm font-bold text-slate-400">Loading assessment...</div>
      </div>
    );
  }

  if (assessmentError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b111b] px-6 text-slate-200">
        <div className="max-w-md rounded-md border border-rose-900 bg-rose-950/30 p-6 text-center">
          <div className="text-lg font-black text-rose-200">Assessment unavailable</div>
          <p className="mt-2 text-sm font-medium text-rose-100">{assessmentError}</p>
        </div>
      </div>
    );
  }

  if (!activeProblem) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b111b] px-6 text-slate-200">
        <div className="max-w-md rounded-md border border-slate-800 bg-[#111827] p-6 text-center">
          <div className="text-lg font-black text-white">No assessment questions configured</div>
          <p className="mt-2 text-sm font-medium text-slate-400">
            Add coding problems or MCQs to the Round 1 assessment in the database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b111b] text-slate-200 font-sans">
      <header className="h-14 border-b border-slate-800 bg-[#111827] flex items-center justify-between px-5">
        <div className="flex items-center gap-4">
          <div className="font-black text-base text-white">
            Hacker<span className="text-emerald-400">Core</span>
          </div>
          <div className="h-5 w-px bg-slate-700" />
          <div className="text-xs font-semibold text-slate-400 uppercase">{assessment?.title || 'Online Assessment'}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {answeredCount}/{questions.length} answered
          </div>
          <div className="rounded-full border border-emerald-700 bg-emerald-500/10 px-4 py-1.5 text-sm font-bold text-emerald-300">
            54 min 9 sec
          </div>
          <button
            onClick={async () => {
              if (window.confirm('Are you sure you want to submit your final assessment?')) {
                await onSubmitAssessment();
              }
            }}
            className="h-10 rounded-md bg-emerald-500 px-5 text-sm font-bold text-white hover:bg-emerald-400"
          >
            Save & Proceed
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        <aside className="w-20 shrink-0 border-r border-slate-800 bg-[#0f1724]">
          <div className="px-3 py-4 text-center text-[10px] font-bold uppercase text-slate-500">Questions</div>
          <div className="space-y-3 px-3">
            {questions.map((question, index) => {
              const isActive = question.id === activeQuestionId;
              const isAnswered = answeredQuestions[question.id];
              const isVisited = visitedQuestions[question.id];

              return (
                <button
                  key={question.id}
                  onClick={() => handleQuestionChange(question.id)}
                  className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-md border text-sm font-black transition
                    ${isActive ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-white'}
                  `}
                >
                  <span>{question.label}</span>
                  <span className="mt-0.5 text-[9px] font-bold uppercase text-slate-500">{question.type === 'coding' ? 'Code' : 'MCQ'}</span>
                  <span
                    className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border border-[#0f1724]
                      ${isAnswered ? 'bg-emerald-400' : isVisited ? 'bg-blue-400' : 'bg-slate-600'}
                    `}
                    title={`Question ${index + 1}`}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        <main
          className="grid flex-1 overflow-hidden"
          style={{ gridTemplateColumns: `minmax(320px, ${problemPaneWidth}%) 6px minmax(420px, 1fr)` }}
        >
          <section className="overflow-y-auto border-r border-slate-800 bg-[#0d1420]">
            <div className="border-b border-slate-800 px-8 py-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded bg-blue-500/10 px-2 py-1 text-[11px] font-bold uppercase text-blue-300">{activeProblem.type}</span>
                <span className="rounded bg-slate-800 px-2 py-1 text-[11px] font-bold uppercase text-slate-300">{activeProblem.difficulty}</span>
                <span className="rounded bg-amber-500/10 px-2 py-1 text-[11px] font-bold uppercase text-amber-300">{activeProblem.points} pts</span>
              </div>
              <h1 className="text-3xl font-black text-white">{activeProblem.title}</h1>
            </div>

            <div className="space-y-8 px-8 py-7 text-[15px] leading-7 text-slate-300">
              <section>
                <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Problem</h2>
                <p>{activeProblem.description}</p>
              </section>

              {activeProblem.type === 'coding' && (
                <>
                  {activeProblem.inputFormat && (
                    <section>
                      <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Input Format</h2>
                      <p>{activeProblem.inputFormat}</p>
                    </section>
                  )}

                  {activeProblem.outputFormat && (
                    <section>
                      <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Output Format</h2>
                      <p>{activeProblem.outputFormat}</p>
                    </section>
                  )}

                  {activeProblem.constraints.length > 0 && (
                    <section>
                      <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Constraints</h2>
                      <ul className="space-y-2">
                        {activeProblem.constraints.map((constraint) => (
                          <li key={constraint} className="font-mono text-sm text-slate-200">{constraint}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {activeProblem.examples.map((example, index) => (
                    <section key={example.input}>
                      <h2 className="mb-3 text-sm font-black uppercase text-slate-500">Sample {index + 1}</h2>
                      <div className="mb-4 rounded-md border border-slate-700 bg-slate-900">
                        <div className="border-b border-slate-800 px-4 py-2 text-xs font-bold uppercase text-slate-500">Input</div>
                        <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-sm text-slate-100">{example.input}</pre>
                      </div>
                      <div className="mb-4 rounded-md border border-slate-700 bg-slate-900">
                        <div className="border-b border-slate-800 px-4 py-2 text-xs font-bold uppercase text-slate-500">Output</div>
                        <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-sm text-slate-100">{example.output}</pre>
                      </div>
                      {example.explanation && (
                        <div className="rounded-md border border-slate-700 bg-slate-900">
                          <div className="border-b border-slate-800 px-4 py-2 text-xs font-bold uppercase text-slate-500">Explanation</div>
                          <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-sm text-slate-100">{example.explanation}</pre>
                        </div>
                      )}
                    </section>
                  ))}
                </>
              )}
            </div>
          </section>

          <div
            onMouseDown={handleProblemResizeStart}
            className="group relative cursor-col-resize bg-[#0b111b]"
            title="Resize problem and editor panes"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-800 group-hover:bg-emerald-500" />
          </div>

          <section className="flex min-w-0 flex-col overflow-hidden bg-[#0b111b]">
            {activeProblem.type === 'coding' ? (
              <>
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#111827] px-5">
                  <div className="flex items-center gap-3">
                    <select
                      value={language}
                      onChange={(event) => handleLanguageChange(event.target.value)}
                      className="h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400"
                    >
                      {Object.keys(LANGUAGES).map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                    <span className="rounded bg-slate-900 px-2 py-1 font-mono text-xs text-slate-500">main.{LANGUAGES[language].extension}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetCode}
                      className="h-9 rounded-md border border-slate-700 px-3 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleRunCode}
                      disabled={isRunning}
                      className="h-9 rounded-md border border-emerald-500 bg-emerald-500/10 px-4 text-sm font-black text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isRunning ? 'Running...' : 'Run Code'}
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div className="select-none border-r border-slate-800 bg-[#090f18] px-3 py-4 text-right font-mono text-sm leading-6 text-slate-600">
                    {Array.from({ length: lineCount }, (_, index) => (
                      <div key={index + 1}>{index + 1}</div>
                    ))}
                  </div>
                  <textarea
                    ref={editorRef}
                    value={currentCode}
                    onChange={(event) => setCurrentCode(event.target.value)}
                    onKeyDown={handleEditorKeyDown}
                    spellCheck="false"
                    className="h-full min-w-0 flex-1 resize-none bg-[#0b111b] px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none selection:bg-emerald-500/30"
                  />
                </div>

                <div
                  className="shrink-0 border-t border-slate-800 bg-[#111827]"
                  style={{ height: consoleOpen ? `${consoleHeight}px` : '48px' }}
                >
                  {consoleOpen && (
                    <div
                      onMouseDown={handleConsoleResizeStart}
                      className="h-1.5 cursor-row-resize bg-slate-900 hover:bg-emerald-500"
                      title="Resize console"
                    />
                  )}
                  <div className="flex h-12 cursor-pointer items-center justify-between px-5" onClick={() => setConsoleOpen(prev => !prev)}>
                    <div className="flex items-center gap-2 text-sm font-black text-white">
                      Console
                      <span className="text-slate-500">{consoleOpen ? 'v' : '^'}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">Tab indents, Shift+Tab unindents</div>
                  </div>

                  {consoleOpen && (
                    <div className="h-[calc(100%-54px)] overflow-y-auto border-t border-slate-800 bg-[#0b111b] p-5">
                      {!testResults && !isRunning && (
                        <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
                          Run your code to compile and test against the configured cases.
                        </div>
                      )}

                      {isRunning && (
                        <div className="flex h-full items-center justify-center text-sm font-bold text-emerald-300">
                          Executing on server...
                        </div>
                      )}

                      {testResults && !isRunning && (
                        <div className="space-y-4">
                          <div className={`font-black ${testResults.passed === testResults.total && testResults.total > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {testResults.status}: {testResults.passed} / {testResults.total} test cases passed
                          </div>

                          {(testResults.cases.length ? testResults.cases : [{ id: 1, passed: testResults.passed === testResults.total, input: 'Hidden tests', expected: '-', output: testResults.status }]).map((testCase) => (
                            <div key={testCase.id} className="rounded-md border border-slate-800 bg-slate-950 p-4">
                              <div className={`mb-3 text-sm font-black ${testCase.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {testCase.passed ? 'Passed' : 'Failed'} Test Case {testCase.id}
                              </div>
                              {!testCase.passed && (
                                <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                                  <pre className="rounded bg-slate-900 p-3 text-slate-300">Input{'\n'}{testCase.input}</pre>
                                  <pre className="rounded bg-slate-900 p-3 text-slate-300">Expected{'\n'}{testCase.expected}</pre>
                                  <pre className="rounded bg-slate-900 p-3 text-slate-300">Output{'\n'}{testCase.output}</pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col overflow-y-auto bg-[#0b111b]">
                <div className="border-b border-slate-800 bg-[#111827] px-6 py-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Multiple Choice</div>
                  <h2 className="mt-1 text-xl font-black text-white">Select one answer</h2>
                </div>

                <div className="max-w-4xl space-y-4 p-8">
                  {Object.entries(activeProblem.options).map(([key, value]) => {
                    const isSelected = selectedOption === key;

                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedOptionsByQuestion(prev => ({ ...prev, [activeQuestionId]: key }));
                          setMcqResult(null);
                        }}
                        className={`flex w-full items-center gap-4 rounded-lg border p-5 text-left transition
                          ${isSelected ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-800 bg-[#111827] hover:border-slate-600'}
                        `}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${isSelected ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-600 text-slate-400'}`}>
                          {key}
                        </span>
                        <span className="text-base font-semibold text-slate-100">{value}</span>
                      </button>
                    );
                  })}

                  <div className="flex items-center gap-4 border-t border-slate-800 pt-6">
                    <button
                      onClick={handleMCQSubmit}
                      disabled={!selectedOption || isSubmittingMCQ}
                      className="h-11 rounded-md bg-emerald-500 px-6 text-sm font-black text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {isSubmittingMCQ ? 'Submitting...' : 'Submit Answer'}
                    </button>

                    {mcqResult && (
                      <div className="rounded-md bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300">
                        {mcqResult.message || 'Answer saved. It will be evaluated when you submit the assessment.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
