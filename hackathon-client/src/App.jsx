import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Components
import Auth from './components/Auth';
import HackathonHub from './components/HackathonHub';
import ParticipantDashboard from './components/ParticipantDashboard';
import ProjectBuilder from './components/ProjectBuilder';
import JudgeDashboard from './components/JudgeDashboard';
import LiveLeaderboard from './components/LiveLeaderboard';
import AdminDashboard from './components/AdminDashboard';

// 1. The Security Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('access_token');
  const role = localStorage.getItem('role');

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
  const role = localStorage.getItem('role');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 cursor-pointer" onClick={() => navigate('/')}>
            HACK<span className="text-blue-600">CORE</span>
          </h1>
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
  const [hackathonStages, setHackathonStages] = useState({
    registration: 'completed',
    round1: 'active',
    round2: 'locked',
    finale: 'locked'
  });

  return (
    <BrowserRouter>
      <AppRoutes stages={hackathonStages} setStages={setHackathonStages} />
    </BrowserRouter>
  );
}

// 4. Route Definitions
function AppRoutes({ stages, setStages }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.clear();
    navigate('/auth');
  };

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/auth" element={<Auth onLoginSuccess={(role) => {
        if (role === 'admin') navigate('/admin');
        else if (role === 'judge') navigate('/judge');
        else navigate('/hub');
      }} />} />

      {/* Standalone Route (No Navbar) */}
      <Route path="/leaderboard" element={<LiveLeaderboard onExit={() => navigate(-1)} />} />
      <Route path="/assessment" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <ParticipantDashboard onSubmitAssessment={() => {
            setStages(prev => ({ ...prev, round1: 'completed', round2: 'active' }));
            navigate('/hub');
          }} />
        </ProtectedRoute>
      } />

      {/* Routes wrapped in the Navbar Layout */}
      <Route path="/hub" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <MainLayout onSignOut={handleSignOut}>
            <HackathonHub 
              stages={stages} 
              onLaunchOA={() => navigate('/assessment')} 
              onLaunchProject={() => navigate('/project-builder')} 
            />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/project-builder" element={
        <ProtectedRoute allowedRoles={['participant']}>
          <MainLayout onSignOut={handleSignOut}>
            <div className="-mx-4 -mt-4">
              <ProjectBuilder onExit={(isSuccess) => {
                if (isSuccess) setStages(prev => ({ ...prev, round2: 'completed', finale: 'active' }));
                navigate('/hub');
              }} />
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