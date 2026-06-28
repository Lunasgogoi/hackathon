import { useCallback, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

// Components
import Auth from './components/Auth';
import HackathonHub, { TeamPage } from './components/HackathonHub';
import ParticipantDashboard from './components/ParticipantDashboard';
import ProjectBuilder from './components/ProjectBuilder';
import JudgeDashboard from './components/JudgeDashboard';
import LiveLeaderboard from './components/LiveLeaderboard';
import AdminDashboard from './components/AdminDashboard';
import HackathonRules from './components/HackathonRules';
import { apiClient, buildWebSocketUrl } from './api/client';
import {
  clearAuthSession,
  getAccessToken,
  getSessionRole,
  loadStoredParticipantProgress,
  saveStoredParticipantProgress
} from './api/session';

const DEFAULT_STAGES = {
  registration: 'active',
  round1: 'locked',
  round2: 'locked',
  finale: 'locked'
};

const DEFAULT_PARTICIPANT_PROGRESS = {
  registration: true,
  round1: false,
  round2: false
};

const DEFAULT_ASSESSMENT_STATUS = {
  submitted: false,
  qualified_for_round2: false,
  user_score: null,
  team: null
};

const LoadingScreen = ({ label = 'Loading...' }) => (
  <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-gray-500">
    {label}
  </div>
);

const loadParticipantProgress = () => {
  return loadStoredParticipantProgress(DEFAULT_PARTICIPANT_PROGRESS);
};

const saveParticipantProgress = (updater) => {
  const nextProgress = updater(loadParticipantProgress());
  saveStoredParticipantProgress(nextProgress);
  return nextProgress;
};

// 1. The Security Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = getAccessToken();
  const role = getSessionRole();

  if (!token) return <Navigate to="/auth" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    // If they have a token but the wrong role, send them to their native dashboard
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'judge') return <Navigate to="/judge" replace />;
    return <Navigate to="/hub" replace />;
  }

  return children;
};

// 2. The Global Navbar Layout
const MainLayout = ({ children, onSignOut }) => {
  const role = getSessionRole();
  const navigate = useNavigate();
  const location = useLocation();
  const navButtonClass = (path) => (
    location.pathname === path
      ? 'text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded transition'
      : 'text-sm font-bold text-gray-600 px-3 py-1.5 rounded transition hover:bg-gray-100 hover:text-gray-900'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 cursor-pointer" onClick={() => navigate('/')}>
            HACK<span className="text-blue-600">CORE</span>
          </h1>
          {role === 'participant' && (
            <div className="hidden items-center gap-1 sm:flex">
              <button type="button" onClick={() => navigate('/hub')} className={navButtonClass('/hub')}>
                Hub
              </button>
              <button type="button" onClick={() => navigate('/team')} className={navButtonClass('/team')}>
                Team
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500 font-medium hidden sm:block">
            Role: <span className="uppercase text-blue-600">{role}</span>
          </p>
          <button
            onClick={() => navigate('/leaderboard')}
            className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100 transition"
          >
            Launch Projector 📺
          </button>
          <button onClick={onSignOut} className="text-sm font-medium text-gray-500 hover:text-red-600 transition">
            Sign Out
          </button>
        </div>
      </nav>
      <main className="px-4">{children}</main>
    </div>
  );
};

// 3. The Core App Router
export default function App() {
  const [hackathonStages, setHackathonStages] = useState(DEFAULT_STAGES);
  const [participantProgress, setParticipantProgress] = useState(loadParticipantProgress);
  const [assessmentStatus, setAssessmentStatus] = useState(DEFAULT_ASSESSMENT_STATUS);
  const [assessmentStatusLoaded, setAssessmentStatusLoaded] = useState(false);
  const [authSessionVersion, setAuthSessionVersion] = useState(0);

  return (
    <BrowserRouter>
      <AppRoutes
        stages={hackathonStages}
        setStages={setHackathonStages}
        participantProgress={participantProgress}
        setParticipantProgress={setParticipantProgress}
        assessmentStatus={assessmentStatus}
        setAssessmentStatus={setAssessmentStatus}
        assessmentStatusLoaded={assessmentStatusLoaded}
        setAssessmentStatusLoaded={setAssessmentStatusLoaded}
        authSessionVersion={authSessionVersion}
        setAuthSessionVersion={setAuthSessionVersion}
      />
    </BrowserRouter>
  );
}

// 4. Route Definitions
function AppRoutes({
  stages,
  setStages,
  participantProgress,
  setParticipantProgress,
  assessmentStatus,
  setAssessmentStatus,
  assessmentStatusLoaded,
  setAssessmentStatusLoaded,
  authSessionVersion,
  setAuthSessionVersion
}) {
  const navigate = useNavigate();

  const fetchPhases = useCallback(async () => {
    try {
      const response = await apiClient.get('/system/phases');
      setStages(response.data);
    } catch (error) {
      console.error("Could not load global phases", error);
    }
  }, [setStages]);

  const markParticipantProgress = useCallback((phase) => {
    setParticipantProgress(saveParticipantProgress((currentProgress) => ({
      ...currentProgress,
      [phase]: true
    })));
  }, [setParticipantProgress]);

  const fetchAssessmentStatus = useCallback(async () => {
    if (getSessionRole() !== 'participant') {
      setAssessmentStatusLoaded(true);
      return;
    }

    try {
      const response = await apiClient.get('/assessment/status');
      setAssessmentStatus(response.data);

      if (response.data.submitted) {
        markParticipantProgress('round1');
      } else {
        setParticipantProgress(saveParticipantProgress((currentProgress) => ({
          ...currentProgress,
          round1: false,
          round2: false
        })));
      }
    } catch (error) {
      console.error('Could not load assessment status', error);
    } finally {
      setAssessmentStatusLoaded(true);
    }
  }, [markParticipantProgress, setAssessmentStatus, setAssessmentStatusLoaded, setParticipantProgress]);

  // Fetch the real global phases from the database on load.
  useEffect(() => {
    if (getAccessToken()) {
      fetchPhases();
      fetchAssessmentStatus();
    }
  }, [fetchPhases, fetchAssessmentStatus, authSessionVersion]);

  useEffect(() => {
    if (!getAccessToken()) return undefined;

    let socket;
    let shouldClose = false;

    const connectTimer = window.setTimeout(() => {
      if (shouldClose) return;

      socket = new WebSocket(buildWebSocketUrl('/system/ws'));

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'phase_update') {
            setStages(prev => ({ ...prev, [payload.phase]: payload.status }));
          }

          if (payload.type === 'global_announcement' && payload.message) {
            alert(payload.message);
          }
        } catch (error) {
          console.error('Could not process system update', error);
        }
      };

      socket.onerror = (error) => {
        if (!shouldClose) {
          console.error('System WebSocket error', error);
        }
      };
    }, 0);

    return () => {
      shouldClose = true;
      window.clearTimeout(connectTimer);

      if (!socket) return;

      socket.onmessage = null;
      socket.onerror = null;

      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => socket.close();
      }
    };
  }, [setStages, authSessionVersion]);

  const handleSignOut = () => {
    clearAuthSession();
    setAssessmentStatus(DEFAULT_ASSESSMENT_STATUS);
    setAssessmentStatusLoaded(false);
    setAuthSessionVersion(prev => prev + 1);
    navigate('/auth');
  };

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/auth" element={<Auth onLoginSuccess={async (role) => {
        setAuthSessionVersion(prev => prev + 1);
        await fetchPhases();
        await fetchAssessmentStatus();

        if (role === 'admin') navigate('/admin');
        else if (role === 'judge') navigate('/judge');
        else navigate('/hub');
      }} />} />

      {/* Standalone Route (No Navbar) */}
      <Route path="/leaderboard" element={<LiveLeaderboard onExit={() => navigate(-1)} />} />
      <Route path="/assessment" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <ParticipantDashboard onSubmitAssessment={async () => {
            try {
              const response = await apiClient.post('/assessment/submit');
              setAssessmentStatus({
                submitted: true,
                qualified_for_round2: response.data.qualified_for_round2,
                user_score: response.data.user_score,
                team: {
                  average_percent: response.data.team_average_percent
                }
              });
              markParticipantProgress('round1');
              alert(
                response.data.qualified_for_round2
                  ? `Assessment submitted. Team average ${response.data.team_average_percent}% meets the Round 2 cutoff.`
                  : `Assessment submitted. Team average ${response.data.team_average_percent}% is below the Round 2 cutoff.`
              );
              navigate('/hub');
            } catch (error) {
              alert(error.response?.data?.detail || 'Could not submit assessment.');
            }
          }} />
        </ProtectedRoute>
      } />

      {/* Routes wrapped in the Navbar Layout */}
      <Route path="/hub" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <MainLayout onSignOut={handleSignOut}>
            <HackathonHub 
              stages={stages} 
              progress={participantProgress}
              round2Eligible={assessmentStatus.qualified_for_round2}
              onLaunchOA={() => navigate('/assessment')} 
              onLaunchProject={() => navigate('/project-builder')} 
            />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/team" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <MainLayout onSignOut={handleSignOut}>
            <TeamPage />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/rules" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <MainLayout onSignOut={handleSignOut}>
            <HackathonRules />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/project-builder" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <MainLayout onSignOut={handleSignOut}>
            <div className="-mx-4 -mt-4">
              {!assessmentStatusLoaded ? (
                <LoadingScreen label="Checking Round 2 access..." />
              ) : stages.round2 === 'active' && assessmentStatus.qualified_for_round2 ? (
                <ProjectBuilder onExit={(submitted) => {
                  if (submitted) {
                    markParticipantProgress('round2');
                  }
                  navigate('/hub');
                }} />
              ) : (
                <Navigate to="/hub" replace />
              )}
            </div>
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/judge" element={
        <ProtectedRoute allowedRoles={['judge']}>
          <MainLayout onSignOut={handleSignOut}>
            <div className="mt-10 max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm"><JudgeDashboard /></div>
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout onSignOut={handleSignOut}>
            <div className="mt-10 max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm"><AdminDashboard /></div>
          </MainLayout>
        </ProtectedRoute>
      } />

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}
