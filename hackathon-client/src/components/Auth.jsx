import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { setAuthSession } from '../api/session';

const getRegistrationMessage = (status) => {
  if (status === 'locked') return 'Registration is not open yet.';
  if (status === 'completed') return 'Registration is closed.';
  return 'Registration is currently unavailable.';
};

const inputClass = "h-12 w-full rounded-md border border-zinc-700/70 bg-zinc-950/30 px-4 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-200/20";

export default function Auth({ onLoginSuccess }) {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(() => searchParams.get('mode') !== 'register');
  const [error, setError] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('active');

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
    <div className="min-h-screen bg-[#121417] text-slate-100">
      <header className="border-b border-white/10 bg-[#121417] px-5 py-5 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link to="/" className="no-underline text-2xl font-bold tracking-tight sm:text-3xl">
            HACK<span className="text-emerald-200">CORE</span> 2026
          </Link>
          <Link to="/" className="no-underline text-sm font-bold text-slate-300 transition hover:text-emerald-200 hover:underline">
            Back to event
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-81px)] max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="max-w-lg">
            <div className="mb-6 inline-flex rounded-full border border-emerald-200/25 bg-emerald-200/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-100">
              Secure Participant Access
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-slate-50">
              Continue your HackCore journey.
            </h1>
            <p className="mt-5 text-lg font-medium leading-8 text-slate-300">
              Sign in to manage your team, attend the assessment, submit your project, and track results from the hub.
            </p>
          </div>
        </section>

        <section className="w-full">
          <div className="mx-auto max-w-md rounded-lg border border-zinc-700/70 bg-[#1d2127] p-6 shadow-xl shadow-black/20 sm:p-8">
              <div className="mb-7">
                <div className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-200">
                  {isLogin ? 'Participant Access' : 'Team Registration'}
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">
                  {isLogin ? 'Sign in to start' : 'Register for HackCore'}
                </h2>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-400">
                  {isLogin
                    ? 'Enter your credentials to continue to the hackathon hub.'
                    : 'Create your participant account before forming or joining a team.'}
                </p>
              </div>

              <div className="mb-6 grid grid-cols-2 rounded-md border border-zinc-700/70 bg-zinc-950/30 p-1">
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setError(''); }}
                  className={`rounded px-4 py-2 text-sm font-bold transition ${isLogin ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className={`rounded px-4 py-2 text-sm font-bold transition ${!isLogin ? 'bg-emerald-200 text-emerald-950' : 'text-slate-400 hover:text-slate-100'}`}
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
                className="mt-6 w-full text-center text-sm font-bold text-slate-300 transition hover:text-emerald-200"
              >
                {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
              </button>
            </div>
        </section>
      </main>
    </div>
  );
}
