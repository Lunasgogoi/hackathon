import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import HackathonHub from './components/HackathonHub';
import ParticipantDashboard from './components/ParticipantDashboard';
import ProjectBuilder from './components/ProjectBuilder';
import JudgeDashboard from './components/JudgeDashboard';
import LiveLeaderboard from './components/LiveLeaderboard';
import AdminDashboard from './components/AdminDashboard';
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Navigation State: 'hub', 'oa', 'project_builder'
  const [currentView, setCurrentView] = useState('hub');

  const [hackathonStages, setHackathonStages] = useState({
    registration: 'completed',
    round1: 'active',
    round2: 'locked',
    finale: 'locked'
  });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    if (token && role) {
      setIsAuthenticated(true);
      setUserRole(role);
    }
  }, []);

  if (!isAuthenticated) {
    return <Auth onLoginSuccess={(role) => { setIsAuthenticated(true); setUserRole(role); }} />;
  }
  if (currentView === 'projector') {
    return <LiveLeaderboard onExit={() => setCurrentView('hub')} />;
  }

  // If they are in the OA, render ONLY the OA (Full Screen Lockdown)
  if (currentView === 'oa' && userRole === 'participant') {
    return (
      <ParticipantDashboard
        onSubmitAssessment={() => {
          // 1. Unlock the next round
          setHackathonStages(prev => ({
            ...prev,
            round1: 'completed',
            round2: 'active'
          }));
          // 2. Send them back to the Hub
          setCurrentView('hub');
        }}
      />
    );
  }

  // Standard Dashboard Layout (Hub, Admin, Judge)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1
            className="text-2xl font-black tracking-tight text-gray-900 cursor-pointer"
            onClick={() => setCurrentView('hub')}
          >
            HACK<span className="text-blue-600">CORE</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500 font-medium hidden sm:block">Role: <span className="uppercase text-blue-600">{userRole}</span></p>
          <button
            onClick={() => setCurrentView('projector')}
            className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100 transition"
          >
            Launch Projector 📺
          </button>
          <button
            onClick={() => {
              localStorage.clear();
              setIsAuthenticated(false);
            }}
            className="text-sm font-medium text-gray-500 hover:text-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content Router */}
      <main className="px-4">
        {userRole === 'participant' && currentView === 'hub' && (
          <HackathonHub
            stages={hackathonStages}
            onLaunchOA={() => setCurrentView('oa')}
            onLaunchProject={() => setCurrentView('project_builder')}
          />
        )}

        {userRole === 'participant' && currentView === 'project_builder' && (
          <div className="-mx-4 -mt-4">
            <ProjectBuilder
              onExit={(isSuccess) => {
                if (isSuccess) {
                  // Lock Round 2 and unlock the Finale!
                  setHackathonStages(prev => ({
                    ...prev,
                    round2: 'completed',
                    finale: 'active'
                  }));
                }
                setCurrentView('hub');
              }}
            />
          </div>
        )}

        {userRole === 'judge' && <div className="mt-10 max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm text-center"><JudgeDashboard /></div>}
        {userRole === 'admin' && <div className="mt-10 max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm text-center"><AdminDashboard /></div>}
      </main>
    </div>
  );
}