import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

const formatDateTime = (value) => {
  if (!value) return 'Not submitted';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
};

const formatScore = (score) => {
  if (!score) return '-';
  return `${score.total_score} / ${score.max_score}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  return `${value}%`;
};

export default function Round1Status({ onExit }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await apiClient.get('/assessment/status');
        if (isMounted) setStatus(response.data);
      } catch (err) {
        if (isMounted) setError(err.response?.data?.detail || 'Could not load Round 1 status.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto mt-10 max-w-4xl rounded-xl border border-gray-200 bg-white p-8 text-sm font-bold text-gray-500 shadow-sm">
        Loading Round 1 status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-4xl rounded-xl border border-red-200 bg-red-50 p-8 text-sm font-bold text-red-700 shadow-sm">
        {error}
      </div>
    );
  }

  const score = status?.user_score;
  const breakdown = status?.breakdown || {};
  const submitted = Boolean(status?.submitted);
  const qualified = Boolean(status?.qualified_for_round2);

  return (
    <div className="mx-auto mt-8 max-w-5xl pb-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase text-blue-600">Round 1</div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Assessment Status</h1>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
        >
          Back to Hub
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-400">Submission</div>
            <h2 className="mt-1 text-2xl font-black text-gray-900">
              {submitted ? 'Submitted' : 'Not Submitted'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {submitted
                ? 'Your Round 1 submission is final. Answers cannot be changed after submission.'
                : 'Round 1 has not been submitted yet.'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${
            submitted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {status?.attempt_status || 'not_started'}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="text-xs font-bold uppercase text-gray-400">Your Score</div>
            <div className="mt-2 text-2xl font-black text-gray-900">{formatScore(score)}</div>
            <div className="mt-1 text-sm font-semibold text-gray-500">{formatPercent(score?.percentage)}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="text-xs font-bold uppercase text-gray-400">Team Average</div>
            <div className="mt-2 text-2xl font-black text-gray-900">{formatPercent(status?.team?.average_percent)}</div>
            <div className="mt-1 text-sm font-semibold text-gray-500">{status?.team?.member_count || 0} members</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="text-xs font-bold uppercase text-gray-400">Round 2 Cutoff</div>
            <div className="mt-2 text-2xl font-black text-gray-900">{formatPercent(status?.cutoff_percent)}</div>
            <div className="mt-1 text-sm font-semibold text-gray-500">team average</div>
          </div>
          <div className={`rounded-lg border p-4 ${
            qualified ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}>
            <div className={`text-xs font-bold uppercase ${qualified ? 'text-green-600' : 'text-amber-600'}`}>Result</div>
            <div className={`mt-2 text-xl font-black ${qualified ? 'text-green-800' : 'text-amber-800'}`}>
              {qualified ? 'Qualified' : 'Not Qualified'}
            </div>
            <div className={`mt-1 text-sm font-semibold ${qualified ? 'text-green-700' : 'text-amber-700'}`}>
              {qualified ? 'Round 2 unlocked' : 'Below cutoff'}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-gray-100 p-4">
            <div className="text-xs font-bold uppercase text-gray-400">Submitted At</div>
            <div className="mt-2 text-sm font-black text-gray-900">{formatDateTime(score?.submitted_at)}</div>
          </div>
          <div className="rounded-lg border border-gray-100 p-4">
            <div className="text-xs font-bold uppercase text-gray-400">Coding</div>
            <div className="mt-2 text-sm font-black text-gray-900">
              {breakdown.accepted_coding_questions || 0} / {breakdown.coding_questions || 0} accepted
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-500">{breakdown.coding_submissions || 0} code submissions</div>
          </div>
          <div className="rounded-lg border border-gray-100 p-4">
            <div className="text-xs font-bold uppercase text-gray-400">MCQ</div>
            <div className="mt-2 text-sm font-black text-gray-900">
              {breakdown.answered_mcq_questions || 0} / {breakdown.mcq_questions || 0} answered
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-500">{breakdown.correct_mcq_answers || 0} correct</div>
          </div>
        </div>
      </div>
    </div>
  );
}
