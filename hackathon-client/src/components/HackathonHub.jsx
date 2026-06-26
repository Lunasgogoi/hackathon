import { useState } from 'react';

export default function HackathonHub({ stages, onLaunchOA, onLaunchProject }) {
  // Mock data for the sidebar
  const teamData = {
    name: "Test Hackers",
    registered: 70262,
    members: ["Lunas Gogoi", "p1@gmail.com"]
  };

  return (
    <div className="max-w-6xl mx-auto mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
      
      {/* LEFT COLUMN: The Timeline */}
      <div className="lg:col-span-2 space-y-0 relative">
        {/* The continuous vertical background line */}
        <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-gray-200 border-l border-dashed border-gray-400 z-0 hidden sm:block"></div>

        {/* STAGE 1: Eligibility & Registration */}
        <div className="relative flex items-start p-4 sm:p-0 sm:mb-8">
          <div className="hidden sm:flex z-10 w-14 h-14 bg-green-500 border-green-100 rounded-full border items-center justify-center shadow-sm mt-4 mr-6">
            <span className="text-white font-bold text-lg">✓</span>
          </div>
          <div className="flex-1 bg-white p-6 rounded-xl border border-green-400 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-gray-900">Eligibility & Registration</h3>
              {/* Standardized Badge */}
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Completed</span>
            </div>
            <p className="text-gray-600 text-sm mb-4">You have successfully formed a team of 2-3 members and met all eligibility criteria.</p>
            <div className="flex space-x-3">
              <button className="bg-green-50 text-green-700 border border-green-200 px-6 py-2 rounded-lg text-sm font-medium cursor-default">
                ✅ Registration Confirmed
              </button>
            </div>
          </div>
        </div>

        {/* STAGE 2: Round 1 (Coding Challenge) */}
        <div className="relative flex items-start p-4 sm:p-0 sm:mb-8">
          <div className={`hidden sm:flex z-10 w-14 h-14 rounded-full border items-center justify-center shadow-sm mt-4 mr-6
            ${stages.round1 === 'completed' ? 'bg-green-500 border-green-100' : stages.round1 === 'active' ? 'bg-blue-500 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
            <span className={`${(stages.round1 === 'active' || stages.round1 === 'completed') ? 'text-white' : 'text-gray-400'} font-bold text-lg`}>
              {stages.round1 === 'completed' ? '✓' : '1'}
            </span>
          </div>
          <div className={`flex-1 bg-white p-6 rounded-xl border shadow-md relative overflow-hidden
            ${stages.round1 === 'completed' ? 'border-green-400' : stages.round1 === 'active' ? 'border-blue-400' : 'border-gray-200 opacity-75'}`}>
            
            {stages.round1 === 'active' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>}
            {stages.round1 === 'completed' && <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>}

            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">100-Minute Coding Challenge</h3>
                <p className={`text-xs font-semibold mt-1 ${stages.round1 === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>13 Jun 26, 12:00 AM IST → 15 Jun 26, 11:59 PM IST</p>
              </div>
              {/* Standardized Badges */}
              {stages.round1 === 'active' && <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full animate-pulse">Live Now</span>}
              {stages.round1 === 'completed' && <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Completed</span>}
              {stages.round1 === 'locked' && <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">Locked</span>}
            </div>
            
            <p className="text-gray-600 text-sm mb-6 mt-3">All eligible teams must participate in a proctored Online Assessment (OA) that includes coding questions and algorithmic MCQs. The HackerRank-style editor will lock your browser.</p>
            
            {/* Standardized Buttons */}
            {stages.round1 === 'active' && (
              <button 
                onClick={onLaunchOA}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm w-full sm:w-auto"
              >
                Launch Assessment 🚀
              </button>
            )}
            {stages.round1 === 'completed' && (
              <button disabled className="bg-green-50 text-green-700 border border-green-200 px-6 py-2 rounded-lg font-medium cursor-not-allowed w-full sm:w-auto">
                ✅ Assessment Completed
              </button>
            )}
            {stages.round1 === 'locked' && (
               <button disabled className="bg-gray-100 text-gray-400 px-6 py-2 rounded-lg font-medium cursor-not-allowed w-full sm:w-auto">Locked</button>
            )}
          </div>
        </div>

        {/* STAGE 3: Round 2 (Project Submission) */}
        <div className="relative flex items-start p-4 sm:p-0 sm:mb-8">
          <div className={`hidden sm:flex z-10 w-14 h-14 rounded-full border items-center justify-center shadow-sm mt-4 mr-6 
            ${stages.round2 === 'completed' ? 'bg-green-500 border-green-100' : stages.round2 === 'active' ? 'bg-blue-500 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
            <span className={`${(stages.round2 === 'active' || stages.round2 === 'completed') ? 'text-white' : 'text-gray-400'} font-bold text-lg`}>
              {stages.round2 === 'completed' ? '✓' : '2'}
            </span>
          </div>
          
          <div className={`flex-1 bg-white p-6 rounded-xl border shadow-sm relative overflow-hidden
            ${stages.round2 === 'completed' ? 'border-green-400' : stages.round2 === 'active' ? 'border-blue-400' : 'border-gray-200 opacity-75'}`}>
            
            {stages.round2 === 'active' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>}
            {stages.round2 === 'completed' && <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>}

            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-gray-900">48-Hour Virtual Hackathon</h3>
              {/* Standardized Badges */}
              {stages.round2 === 'locked' && <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">Locked</span>}
              {stages.round2 === 'active' && <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full animate-pulse">Live Now</span>}
              {stages.round2 === 'completed' && <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Completed</span>}
            </div>
            
            <p className="text-gray-600 text-sm mb-4">Shortlisted teams will advance to an exclusive 48-hour build phase. You will submit your GitHub repository and video demo here.</p>
            
            {/* Standardized Buttons */}
            {stages.round2 === 'active' && (
              <button 
                onClick={onLaunchProject}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm w-full sm:w-auto"
              >
                Submit Project
              </button>
            )}
            
            {stages.round2 === 'completed' && (
              <button disabled className="bg-green-50 text-green-700 border border-green-200 px-6 py-2 rounded-lg font-medium cursor-not-allowed w-full sm:w-auto">
                ✅ Project Submitted Successfully
              </button>
            )}
            
            {stages.round2 === 'locked' && (
               <button disabled className="bg-gray-100 text-gray-400 px-6 py-2 rounded-lg font-medium cursor-not-allowed w-full sm:w-auto">Locked</button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Sidebar Stats (Like Unstop) */}
      <div className="hidden lg:block space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-inner mb-4">
            <span className="text-3xl text-white font-bold">{teamData.name.charAt(0)}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{teamData.name}</h2>
          <p className="text-sm text-gray-500 mb-4">Team Captain: Lunas</p>
          
          <button className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 mb-4 flex justify-center items-center gap-2">
            <span>✏️</span> View Details
          </button>
          
          <div className="flex items-center justify-center text-sm text-gray-600 font-medium border-t pt-4">
            <span>🚀 {teamData.registered.toLocaleString()} Registered globally</span>
          </div>
        </div>

        {/* Sponsor Banner Mockup */}
        <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-800 p-6 text-white text-center">
          <h4 className="font-bold mb-2">Powered By</h4>
          <div className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            FastAPI & React
          </div>
        </div>
      </div>
    </div>
  );
}