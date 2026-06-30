import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { setAuthSession } from '../api/session';
import ThemeToggle from './ThemeToggle';
import useThemePreference from '../hooks/useThemePreference';

const getRegistrationMessage = (status) => {
  if (status === 'locked') return 'Registration is not open yet.';
  if (status === 'completed') return 'Registration is closed.';
  return 'Registration is currently unavailable.';
};

export default function Auth({ onLoginSuccess }) {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(() => searchParams.get('mode') !== 'register');
  const [error, setError] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('active');
  const { isDarkTheme, toggleTheme } = useThemePreference('dark');
  const ui = {
    page: isDarkTheme ? 'bg-[#121417] text-slate-100' : 'bg-slate-50 text-slate-950',
    header: isDarkTheme ? 'border-white/10 bg-[#121417]' : 'border-slate-200 bg-white shadow-sm',
    card: isDarkTheme ? 'border-zinc-700/70 bg-[#1d2127] shadow-black/20' : 'border-slate-200 bg-white shadow-slate-200/80',
    panel: isDarkTheme ? 'border-zinc-700/70 bg-zinc-950/30' : 'border-slate-200 bg-slate-100',
    title: isDarkTheme ? 'text-slate-50' : 'text-slate-950',
    body: isDarkTheme ? 'text-slate-300' : 'text-slate-600',
    muted: isDarkTheme ? 'text-slate-400' : 'text-slate-500',
    navText: isDarkTheme ? 'text-slate-300 hover:text-emerald-200' : 'text-slate-600 hover:text-emerald-700',
    accent: isDarkTheme ? 'text-emerald-200' : 'text-emerald-700',
    chip: isDarkTheme
      ? 'border-emerald-200/25 bg-emerald-200/10 text-emerald-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800',
    themeButton: isDarkTheme
      ? 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-200/60 hover:text-emerald-100'
      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700',
    inactiveTab: isDarkTheme ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900',
    input: isDarkTheme
      ? 'border-zinc-700/70 bg-zinc-950/30 text-slate-100 placeholder:text-slate-500 focus:border-emerald-200 focus:ring-emerald-200/20'
      : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-100'
  };
  const inputClass = `h-12 w-full rounded-md border px-4 text-sm font-semibold outline-none transition focus:ring-2 ${ui.input}`;

  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isRegistrationOpen = registrationStatus === 'active';

  useEffect(() => {
    let isMounted = true;

    const loadPhases = async () => {
      try {
        const response = await apiClient.get('/system/phases');
        if (isMounted) setRegistrationStatus(response.data.registration || 'locked');
      } catch {
        if (isMounted) setRegistrationStatus('active');
      }
    };

    loadPhases();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        // --- REAL FASTAPI LOGIN ---
        // FastAPI OAuth2 expects Form Data, NOT JSON!
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        // Make the actual request to your backend
        const response = await apiClient.post('/auth/login', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        setAuthSession({
          token: response.data.access_token,
          role: response.data.role
        });

        // Trigger the app to load the Hub
        onLoginSuccess(response.data.role);

      } else {
        if (!isRegistrationOpen) {
          setError(getRegistrationMessage(registrationStatus));
          return;
        }

        // --- REAL FASTAPI REGISTRATION ---
        await apiClient.post('/auth/register', {
          username,
          email,
          password
        });

        // Auto-switch to login after successful registration
        setIsLogin(true);
        setError('Registration successful! Please log in.');
      }
    } catch (err) {
      // Show the actual error message from FastAPI (e.g., "Incorrect password")
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${ui.page}`}>
      <header className={`border-b px-5 py-5 transition-colors sm:px-8 lg:px-10 ${ui.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link to="/" className="no-underline text-2xl font-bold tracking-tight sm:text-3xl">
            HACK<span className={ui.accent}>CORE</span> 2026
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle isDarkTheme={isDarkTheme} onToggle={toggleTheme} className={ui.themeButton} />
            <Link to="/" className={`no-underline text-sm font-bold transition hover:underline ${ui.navText}`}>
              Back to event
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-81px)] max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="max-w-lg">
            <div className={`mb-6 inline-flex rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${ui.chip}`}>
              Secure Participant Access
            </div>
            <h1 className={`text-5xl font-bold leading-tight tracking-tight ${ui.title}`}>
              Continue your HackCore journey.
            </h1>
            <p className={`mt-5 text-lg font-medium leading-8 ${ui.body}`}>
              Sign in to manage your team, attend the assessment, submit your project, and track results from the hub.
            </p>
          </div>
        </section>

        <section className="w-full">
          <div className={`mx-auto max-w-md rounded-lg border p-6 shadow-xl transition-colors sm:p-8 ${ui.card}`}>
              <div className="mb-7">
                <div className={`text-sm font-bold uppercase tracking-[0.2em] ${ui.accent}`}>
                  {isLogin ? 'Participant Access' : 'Team Registration'}
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">
                  {isLogin ? 'Sign in to start' : 'Register for HackCore'}
                </h2>
                <p className={`mt-3 text-sm font-medium leading-6 ${ui.muted}`}>
                  {isLogin
                    ? 'Enter your credentials to continue to the hackathon hub.'
                    : 'Create your participant account before forming or joining a team.'}
                </p>
              </div>

              <div className={`mb-6 grid grid-cols-2 rounded-md border p-1 ${ui.panel}`}>
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setError(''); }}
                  className={`rounded px-4 py-2 text-sm font-bold transition ${isLogin ? 'bg-slate-100 text-slate-900 shadow-sm' : ui.inactiveTab}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className={`rounded px-4 py-2 text-sm font-bold transition ${!isLogin ? 'bg-emerald-200 text-emerald-950 shadow-sm' : ui.inactiveTab}`}
                >
                  Register
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className={`rounded-md border p-3 text-center text-sm font-bold ${error.includes('successful') ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                    {error}
                  </div>
                )}
                {!isLogin && !isRegistrationOpen && (
                  <div className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-center text-sm font-bold text-amber-100">
                    {getRegistrationMessage(registrationStatus)}
                  </div>
                )}

                <div className="space-y-4">
                  <input
                    type="text"
                    required
                    className={inputClass}
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />

                  {!isLogin && (
                    <input
                      type="email"
                      required
                      className={inputClass}
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}

                  <input
                    type="password"
                    required
                    className={inputClass}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isLogin && !isRegistrationOpen}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-emerald-200 px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-[#121417] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isLogin ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className={`mt-6 w-full text-center text-sm font-bold transition ${ui.navText}`}
              >
                {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
              </button>
            </div>
        </section>
      </main>
    </div>
  );
}
