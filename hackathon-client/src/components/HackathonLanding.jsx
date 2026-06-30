import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import ThemeToggle from './ThemeToggle';
import useThemePreference from '../hooks/useThemePreference';

const sectionClass = 'mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10';

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Rounds', href: '#rounds' },
  { label: 'Prizes', href: '#prizes' },
  { label: 'Results', href: '#results' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' }
];

const phaseLabel = (status) => {
  if (status === 'active') return 'Open now';
  if (status === 'completed') return 'Completed';
  return 'Locked';
};

const questions = [
  {
    question: 'Who can participate?',
    answer: 'Students can register as participants and form teams before the registration phase closes.'
  },
  {
    question: 'How many rounds are there?',
    answer: 'The event has team registration, Round 1 assessment, Round 2 project building, and a finale leaderboard.'
  },
  {
    question: 'How do teams qualify for Round 2?',
    answer: 'Round 2 eligibility is based on the Round 1 assessment result and the configured cutoff.'
  },
  {
    question: 'Where do I manage my team?',
    answer: 'After signing in, participants can create, join, or manage a team from the HackCore hub.'
  }
];

export default function HackathonLanding() {
  const [stages, setStages] = useState({
    registration: 'active',
    round1: 'locked',
    round2: 'locked',
    finale: 'locked'
  });
  const { isDarkTheme, toggleTheme } = useThemePreference('dark');
  const ui = {
    page: isDarkTheme ? 'bg-[#121417] text-slate-100' : 'bg-slate-50 text-slate-950',
    header: isDarkTheme ? 'border-white/10 bg-[#121417]/95' : 'border-slate-200 bg-white/95 shadow-sm',
    hero: isDarkTheme ? 'border-white/10 bg-[#121417]' : 'border-slate-200 bg-white',
    band: isDarkTheme ? 'bg-[#171a1f]' : 'bg-slate-100',
    card: isDarkTheme ? 'border-zinc-700/70 bg-[#1d2127]' : 'border-slate-200 bg-white shadow-sm',
    row: isDarkTheme ? 'border-zinc-700/70 bg-zinc-950/30' : 'border-slate-200 bg-slate-50',
    divider: isDarkTheme ? 'border-zinc-700/70 divide-zinc-700/70' : 'border-slate-200 divide-slate-200',
    navText: isDarkTheme ? 'text-slate-300 hover:text-emerald-200' : 'text-slate-600 hover:text-emerald-700',
    brandAccent: isDarkTheme ? 'text-emerald-200' : 'text-emerald-600',
    title: isDarkTheme ? 'text-slate-50' : 'text-slate-950',
    body: isDarkTheme ? 'text-slate-300' : 'text-slate-600',
    muted: isDarkTheme ? 'text-slate-400' : 'text-slate-500',
    accent: isDarkTheme ? 'text-emerald-200' : 'text-emerald-700',
    chip: isDarkTheme
      ? 'border-emerald-200/25 bg-emerald-200/10 text-emerald-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800',
    themeButton: isDarkTheme
      ? 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-200/60 hover:text-emerald-100'
      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700',
    secondaryButton: isDarkTheme
      ? 'border-zinc-600 text-slate-100 hover:border-emerald-200 hover:text-emerald-100'
      : 'border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-800',
    linkButton: isDarkTheme
      ? 'border-emerald-200/80 text-emerald-100 hover:bg-emerald-200 hover:text-emerald-950'
      : 'border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white'
  };

  useEffect(() => {
    let isMounted = true;

    const loadStages = async () => {
      try {
        const response = await apiClient.get('/system/phases');
        if (isMounted) setStages(response.data);
      } catch {
        if (isMounted) {
          setStages((currentStages) => currentStages);
        }
      }
    };

    loadStages();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={`min-h-screen overflow-x-hidden transition-colors ${ui.page}`}>
      <header className={`sticky top-0 z-50 border-b backdrop-blur transition-colors ${ui.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10">
          <a href="#home" className="no-underline text-xl font-bold tracking-tight sm:text-2xl">
            HACK<span className={ui.brandAccent}>CORE</span> 2026
          </a>
          <nav className={`hidden items-center gap-7 text-sm font-bold lg:flex ${ui.navText}`}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="no-underline transition hover:underline">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle isDarkTheme={isDarkTheme} onToggle={toggleTheme} className={ui.themeButton} />
            <Link to="/auth" className={`hidden no-underline text-sm font-bold transition hover:underline sm:inline ${ui.navText}`}>
              Login
            </Link>
            <Link
              to="/auth?mode=register"
              className="hidden no-underline rounded-md bg-emerald-200 px-5 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-100 hover:no-underline sm:inline-flex"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main id="home">
        <section className={`border-b transition-colors ${ui.hero}`}>
          <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-10">
            <div className="min-w-0 max-w-5xl">
              <div className={`mb-8 inline-flex rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${ui.chip}`}>
                National-Level Coding Competition
              </div>
              <h1 className={`max-w-5xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl ${ui.title}`}>
                Build, compete, and ship under pressure.
              </h1>
              <p className={`mt-8 max-w-4xl text-lg font-medium leading-8 sm:text-xl sm:leading-9 ${ui.body}`}>
                HackCore brings registration, team management, assessment, project submission, judging, and leaderboard tracking into one focused hackathon platform.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                <Link
                  to="/auth?mode=register"
                  className="w-full no-underline rounded-md bg-emerald-200 px-7 py-3 text-center text-sm font-bold text-emerald-950 transition hover:bg-emerald-100 hover:no-underline sm:w-auto"
                >
                  Register Your Team
                </Link>
                <Link
                  to="/auth"
                  className={`w-full no-underline rounded-md border px-7 py-3 text-center text-sm font-bold transition hover:no-underline sm:w-auto ${ui.secondaryButton}`}
                >
                  Login to Start Test
                </Link>
              </div>
              <div className={`mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm font-bold ${ui.muted}`}>
                <span>Registration: {phaseLabel(stages.registration)}</span>
                <span>Round 1: {phaseLabel(stages.round1)}</span>
                <span>Round 2: {phaseLabel(stages.round2)}</span>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className={`${sectionClass} scroll-mt-20`}>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">About HackCore</h2>
              <p className={`mt-5 text-lg font-medium leading-8 ${ui.body}`}>
                A structured competition experience for teams, participants, judges, and admins.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Team-first', 'Create, join, and manage teams before moving into rounds.'],
                ['Assessment-ready', 'Round 1 is built for timed problem solving and evaluation.'],
                ['Project-focused', 'Round 2 supports project submissions, judging, and results.']
              ].map(([title, body]) => (
                <article key={title} className={`rounded-lg border p-5 transition-colors ${ui.card}`}>
                  <h3 className={`text-lg font-bold ${ui.accent}`}>{title}</h3>
                  <p className={`mt-3 text-sm font-medium leading-6 ${ui.body}`}>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="flow" className={`scroll-mt-20 transition-colors ${ui.band}`}>
          <div className={sectionClass}>
            <div className={`mx-auto max-w-4xl rounded-lg border p-6 sm:p-8 ${ui.card}`}>
              <div className={`border-b pb-5 ${ui.divider}`}>
                <div className={`text-sm font-bold uppercase tracking-wider ${ui.accent}`}>Live Event Flow</div>
                <h2 className="mt-3 text-2xl font-bold">From registration to leaderboard</h2>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  ['01', 'Register and form a team', phaseLabel(stages.registration)],
                  ['02', 'Complete Round 1 assessment', phaseLabel(stages.round1)],
                  ['03', 'Submit Round 2 project', phaseLabel(stages.round2)],
                  ['04', 'Track finalist leaderboard', phaseLabel(stages.finale)]
                ].map(([number, title, status]) => (
                  <div key={number} className={`flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between ${ui.row}`}>
                    <div className="flex items-center gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-200 text-sm font-bold text-emerald-950">
                        {number}
                      </span>
                      <div className={`font-semibold ${ui.title}`}>{title}</div>
                    </div>
                    <span className={`text-xs font-bold uppercase sm:whitespace-nowrap ${ui.muted}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="rounds" className={`scroll-mt-20 transition-colors ${ui.band}`}>
          <div className={sectionClass}>
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Competition Structure</h2>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {[
                ['Round 1', 'Online Assessment', 'MCQs, aptitude, and coding questions decide the Round 2 shortlist.'],
                ['Round 2', 'Project Build', 'Qualified teams submit a working solution with clear technical impact.'],
                ['Finale', 'Leaderboard', 'Judges review submissions and publish final standings.']
              ].map(([round, title, body]) => (
                <article
                  key={round}
                  className={`rounded-lg border p-7 transition hover:border-emerald-300 ${ui.card}`}
                >
                  <div className={`text-sm font-bold uppercase tracking-wider ${ui.accent}`}>{round}</div>
                  <h3 className="mt-4 text-2xl font-bold">{title}</h3>
                  <p className={`mt-4 text-base font-medium leading-7 ${ui.body}`}>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="prizes" className={`${sectionClass} scroll-mt-20`}>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Prizes & Recognition</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ['1st Prize', 'Certificate of Achievement'],
              ['2nd Prize', 'Certificate of Achievement'],
              ['3rd Prize', 'Certificate of Achievement']
            ].map(([title, subtitle]) => (
              <article key={title} className={`rounded-lg border p-8 text-center transition hover:border-emerald-300 ${ui.card}`}>
                <h3 className={`text-2xl font-bold ${ui.accent}`}>{title}</h3>
                <p className={`mt-5 text-lg font-bold ${ui.title}`}>{subtitle}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="results" className={`scroll-mt-20 transition-colors ${ui.band}`}>
          <div className={sectionClass}>
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Event Status & Results</h2>
            <div className={`mx-auto mt-10 max-w-3xl rounded-lg border p-8 text-center ${ui.card}`}>
              <h3 className="text-2xl font-bold">Live Status</h3>
              <p className={`mt-4 text-lg font-medium leading-8 ${ui.body}`}>
                Results and round access are managed from the platform. Sign in to view your team status and current eligibility.
              </p>
              <Link
                to="/leaderboard"
                className={`mt-7 inline-flex no-underline rounded-md border px-6 py-3 text-sm font-bold transition hover:no-underline ${ui.linkButton}`}
              >
                View Leaderboard
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className={`${sectionClass} scroll-mt-20`}>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
          <div className={`mx-auto mt-10 max-w-5xl divide-y border-y ${ui.divider}`}>
            {questions.map((item) => (
              <details key={item.question} className={`group transition-colors ${isDarkTheme ? 'bg-[#1d2127]' : 'bg-white'}`}>
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-7 text-xl font-semibold sm:px-6 ${ui.title}`}>
                  <span>{item.question}</span>
                  <span className={`text-2xl font-light transition group-open:rotate-45 ${ui.accent}`}>+</span>
                </summary>
                <p className={`px-4 pb-7 text-base font-medium leading-7 sm:px-6 ${ui.body}`}>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer id="contact" className={`scroll-mt-20 border-t transition-colors ${ui.hero}`}>
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-3 lg:px-10">
          <div>
            <h2 className="text-xl font-bold">HackCore 2026</h2>
            <p className={`mt-4 text-sm font-medium leading-6 ${ui.muted}`}>
              A complete hackathon workflow for registration, assessment, project judging, and results.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold">Contact</h2>
            <p className={`mt-4 text-sm font-medium leading-6 ${ui.muted}`}>
              Event administrators can manage announcements, phases, teams, judges, and results from the admin dashboard.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold">Get Started</h2>
            <div className="mt-4 flex gap-3">
              <Link to="/auth" className={`no-underline text-sm font-bold transition hover:underline ${ui.navText}`}>Login</Link>
              <Link to="/auth?mode=register" className={`no-underline text-sm font-bold transition hover:underline ${ui.accent}`}>Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
