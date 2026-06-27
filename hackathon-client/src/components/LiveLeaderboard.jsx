import { useState, useEffect } from 'react';

export default function LiveLeaderboard({ onExit }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  useEffect(() => {
    // Connect directly to your FastAPI WebSocket endpoint
    const ws = new WebSocket('ws://127.0.0.1:8000/api/v1/leaderboard/ws');

    ws.onopen = () => {
      setConnectionStatus('Live');
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      // Look for data.data instead of data.leaderboard
      if (payload.type === 'initial_load' || payload.type === 'live_update') {
        // Sort based on 'score' instead of 'total_score'
        const sortedTeams = payload.data.sort((a, b) => b.score - a.score);
        setLeaderboard(sortedTeams);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setConnectionStatus('Error');
    };

    ws.onclose = () => {
      setConnectionStatus('Disconnected');
    };

    // Clean up the TCP connection when the component unmounts
    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen w-screen bg-[#0b1017] text-white flex flex-col font-sans relative overflow-hidden">

      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <header className="px-10 py-8 flex justify-between items-center relative z-10 border-b border-gray-800/50 bg-[#0b1017]/50 backdrop-blur-md">
        <button
          onClick={onExit}
          className="text-gray-500 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>←</span> Close Projector
        </button>

        <h1 className="text-4xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          Grand Finale Leaderboard
        </h1>

        <div className="flex items-center gap-3 bg-gray-900/80 px-4 py-2 rounded-full border border-gray-800">
          <div className={`w-3 h-3 rounded-full animate-pulse ${connectionStatus === 'Live' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' :
            connectionStatus === 'Connecting...' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
          <span className="text-sm font-mono text-gray-300 font-medium tracking-wide uppercase">
            {connectionStatus}
          </span>
        </div>
      </header>

      {/* Main Leaderboard List */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-10 relative z-10 flex flex-col gap-4">

        {/* Table Headers */}
        <div className="grid grid-cols-12 gap-4 px-6 text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-7">Team Name</div>
          <div className="col-span-2 text-center">Projects</div>
          <div className="col-span-2 text-right">Total Score</div>
        </div>

        {/* Dynamic Rows */}
        {leaderboard.length === 0 ? (
          <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-xl">
            Awaiting live evaluations from judges...
          </div>
        ) : (
          leaderboard.map((team, index) => {
            const rank = index + 1;
            // Podium Styling
            const isFirst = rank === 1;
            const isSecond = rank === 2;
            const isThird = rank === 3;

            return (
              <div
                key={team.team_name}
                className={`grid grid-cols-12 gap-4 items-center px-6 py-5 rounded-xl border transition-all duration-500 transform hover:scale-[1.01]
                  ${isFirst ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]' :
                    isSecond ? 'bg-gradient-to-r from-gray-300/10 to-transparent border-gray-300/20' :
                      isThird ? 'bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/20' :
                        'bg-[#131b26] border-gray-800/50 hover:bg-[#1a2433]'}
                `}
              >
                <div className="col-span-1 flex justify-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg
                    ${isFirst ? 'bg-yellow-500 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.5)]' :
                      isSecond ? 'bg-gray-300 text-gray-900' :
                        isThird ? 'bg-orange-500 text-orange-950' :
                          'bg-gray-800 text-gray-400'}
                  `}>
                    {rank}
                  </div>
                </div>

                <div className="col-span-7 font-bold text-2xl tracking-tight text-white">
                  {team.team} {/* Changed from team.team_name */}
                </div>

                <div className="col-span-2 text-center text-gray-400 font-medium">
                  {/* Since your DB query doesn't pull project counts, we can just show a checkmark */}
                  ✅ Evaluated
                </div>

                <div className="col-span-2 text-right font-mono text-3xl font-bold text-white">
                  {parseFloat(team.score).toFixed(1)} {/* Changed from team.total_score */}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}

