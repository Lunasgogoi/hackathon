import { useState, useEffect } from 'react';
import { buildWebSocketUrl } from '../api/client';
import ThemeToggle from './ThemeToggle';
import useThemePreference from '../hooks/useThemePreference';

export default function LiveLeaderboard({ onExit }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const { isDarkTheme, toggleTheme } = useThemePreference('dark');
  const ui = {
    page: isDarkTheme ? 'bg-[#101317] text-slate-100' : 'bg-slate-50 text-slate-950',
    header: isDarkTheme ? 'border-white/10 bg-[#12161c]' : 'border-slate-200 bg-white shadow-sm',
    card: isDarkTheme ? 'border-white/10 bg-[#181d24]' : 'border-slate-200 bg-white shadow-sm',
    table: isDarkTheme ? 'border-white/10 bg-[#151a20] shadow-black/20' : 'border-slate-200 bg-white shadow-slate-200/80',
    tableHead: isDarkTheme ? 'border-white/10 bg-white/[0.03] text-slate-500' : 'border-slate-200 bg-slate-100 text-slate-500',
    divider: isDarkTheme ? 'divide-white/10' : 'divide-slate-200',
    closeButton: isDarkTheme ? 'text-slate-400 hover:bg-white/5 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    title: isDarkTheme ? 'text-slate-50' : 'text-slate-950',
    accent: isDarkTheme ? 'text-emerald-200' : 'text-emerald-700',
    body: isDarkTheme ? 'text-slate-400' : 'text-slate-600',
    muted: isDarkTheme ? 'text-slate-500' : 'text-slate-500',
    waiting: isDarkTheme ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500',
    themeButton: isDarkTheme
      ? 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-200/60 hover:text-emerald-100'
      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700',
    neutralRank: isDarkTheme ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-700',
    rowHover: isDarkTheme ? 'bg-transparent hover:bg-white/[0.03]' : 'bg-transparent hover:bg-slate-50'
  };
  const topScore = leaderboard.length ? Math.max(...leaderboard.map(team => Number(team.score) || 0)) : 0;
  const averageScore = leaderboard.length
    ? leaderboard.reduce((total, team) => total + (Number(team.score) || 0), 0) / leaderboard.length
    : 0;

  useEffect(() => {
    let ws;
    let shouldClose = false;

    const connectTimer = window.setTimeout(() => {
      if (shouldClose) return;

      ws = new WebSocket(buildWebSocketUrl('/leaderboard/ws'));

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);

        if (payload.type === 'initial_load' || payload.type === 'live_update') {
          const sortedTeams = [...payload.data].sort((a, b) => b.score - a.score);
          setLeaderboard(sortedTeams);
        }
      };

      ws.onerror = (error) => {
        if (!shouldClose) {
          console.error('WebSocket Error:', error);
        }
      };
    }, 0);

    return () => {
      shouldClose = true;
      window.clearTimeout(connectTimer);

      if (!ws) return;

      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      }
    };
  }, []);

  return (
    <div className={`min-h-screen w-screen overflow-hidden font-sans transition-colors ${ui.page}`}>
      <header className={`border-b transition-colors ${ui.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-8 py-5">
          <button
            onClick={onExit}
            className={`inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition ${ui.closeButton}`}
          >
            <span aria-hidden="true">&lt;-</span>
            Close Projector
          </button>

          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
              Grand Finale
            </div>
            <h1 className={`mt-1 text-2xl font-semibold tracking-tight sm:text-3xl ${ui.title}`}>
              Live Leaderboard
            </h1>
          </div>

          <div className="flex min-w-32 justify-end">
            <ThemeToggle isDarkTheme={isDarkTheme} onToggle={toggleTheme} className={ui.themeButton} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-1 flex-col gap-6 px-8 py-8">
        <section className="grid gap-4 md:grid-cols-3">
          <div className={`rounded-lg border px-5 py-4 ${ui.card}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${ui.muted}`}>Teams Ranked</div>
            <div className={`mt-2 text-2xl font-semibold ${ui.title}`}>{leaderboard.length}</div>
          </div>
          <div className={`rounded-lg border px-5 py-4 ${ui.card}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${ui.muted}`}>Top Score</div>
            <div className={`mt-2 text-2xl font-semibold ${ui.accent}`}>{topScore.toFixed(1)}</div>
          </div>
          <div className={`rounded-lg border px-5 py-4 ${ui.card}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${ui.muted}`}>Average Score</div>
            <div className={`mt-2 text-2xl font-semibold ${ui.title}`}>{averageScore.toFixed(1)}</div>
          </div>
        </section>

        <section className={`overflow-hidden rounded-lg border shadow-2xl ${ui.table}`}>
          <div className={`grid grid-cols-12 gap-4 border-b px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] ${ui.tableHead}`}>
            <div className="col-span-2 sm:col-span-1">Rank</div>
            <div className="col-span-6 sm:col-span-7">Team</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-right">Score</div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-200/10 text-lg font-semibold ${ui.accent}`}>
                0
              </div>
              <h2 className={`mt-5 text-xl font-semibold tracking-tight ${ui.title}`}>
                No scores published yet
              </h2>
              <p className={`mt-2 max-w-md text-sm font-medium leading-6 ${ui.body}`}>
                Submitted judge evaluations will appear here automatically in ranked order.
              </p>
              <div className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${ui.waiting}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Waiting for evaluations
              </div>
            </div>
          ) : (
            <div className={`divide-y ${ui.divider}`}>
              {leaderboard.map((team, index) => {
                const rank = index + 1;
                const isFirst = rank === 1;
                const isSecond = rank === 2;
                const isThird = rank === 3;

                return (
                  <div
                    key={team.team}
                    className={`grid grid-cols-12 items-center gap-4 px-6 py-5 transition ${
                      isFirst
                        ? 'bg-amber-300/10'
                        : isSecond
                          ? 'bg-slate-200/5'
                          : isThird
                            ? 'bg-orange-300/10'
                            : ui.rowHover
                    }`}
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold ${
                        isFirst
                          ? 'bg-amber-300 text-amber-950'
                          : isSecond
                            ? 'bg-slate-300 text-slate-950'
                            : isThird
                              ? 'bg-orange-300 text-orange-950'
                              : ui.neutralRank
                      }`}>
                        {rank}
                      </div>
                    </div>

                    <div className="col-span-6 min-w-0 sm:col-span-7">
                      <div className={`truncate text-lg font-semibold tracking-tight ${ui.title}`}>
                        {team.team}
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <span className={`inline-flex rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${ui.accent}`}>
                        Evaluated
                      </span>
                    </div>

                    <div className={`col-span-2 text-right font-mono text-xl font-semibold ${ui.title}`}>
                      {(Number(team.score) || 0).toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
