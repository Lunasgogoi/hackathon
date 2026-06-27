import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export default function AdminDashboard() {
    const [systemStatus, setSystemStatus] = useState({
        registration: 'active',
        round1: 'locked',
        round2: 'locked',
        finale: 'locked'
    });

    const [announcement, setAnnouncement] = useState('');

    useEffect(() => {
        const fetchPhases = async () => {
            try {
                const response = await apiClient.get('/system/phases');
                setSystemStatus(response.data);
            } catch (error) {
                console.error('Failed to load phase state.', error);
            }
        };

        fetchPhases();
    }, []);

    const handlePhaseChange = async (phase, newStatus) => {
        const previousStatus = systemStatus[phase];

        // Optimistic UI update
        setSystemStatus(prev => ({ ...prev, [phase]: newStatus }));

        try {
            // REAL AXIOS CALL: Update the global state in the database
            await apiClient.post('/admin/phase', {
                phase_name: phase,
                status: newStatus
            });
        } catch (error) {
            console.error('Failed to update phase on the server.', error);
            alert("Failed to update phase on the server.");
            // Revert the UI if the server fails
            setSystemStatus(prev => ({ ...prev, [phase]: previousStatus }));
        }
    };

    const handleBroadcast = async (e) => {
        e.preventDefault();

        try {
            // REAL AXIOS CALL: Fire a WebSocket broadcast to all users
            await apiClient.post('/admin/broadcast', {
                message: announcement
            });

            alert(`Broadcast sent to all screens: "${announcement}"`);
            setAnnouncement('');
        } catch (error) {
            console.error('Failed to send broadcast.', error);
            alert("Failed to send broadcast.");
        }
    };
    return (
        <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Registered Teams', value: '142', color: 'text-blue-600' },
                    { label: 'Active Users', value: '38', color: 'text-green-600' },
                    { label: 'Projects Submitted', value: '12', color: 'text-purple-600' },
                    { label: 'Pending Evaluations', value: '5', color: 'text-yellow-600' }
                ].map(stat => (
                    <div key={stat.label} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
                        <div className={`text-3xl font-black mb-1 ${stat.color}`}>{stat.value}</div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Phase Control Panel */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-bold text-gray-900 text-lg">System Phase Controls</h2>
                        <p className="text-sm text-gray-500">Warning: Changing these states affects all active users instantly.</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {[
                            { id: 'registration', name: 'Team Registration' },
                            { id: 'round1', name: 'Round 1: Online Assessment' },
                            { id: 'round2', name: 'Round 2: Project Building' },
                            { id: 'finale', name: 'Grand Finale: Leaderboard' }
                        ].map(phase => (
                            <div key={phase.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50">
                                <div>
                                    <h4 className="font-bold text-gray-900">{phase.name}</h4>
                                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded mt-1 inline-block
                    ${systemStatus[phase.id] === 'active' ? 'bg-blue-100 text-blue-700' :
                                            systemStatus[phase.id] === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}
                  `}>
                                        Current: {systemStatus[phase.id]}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePhaseChange(phase.id, 'locked')}
                                        className={`px-3 py-1.5 text-sm font-medium rounded transition ${systemStatus[phase.id] === 'locked' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >Not Open</button>
                                    <button
                                        onClick={() => handlePhaseChange(phase.id, 'active')}
                                        className={`px-3 py-1.5 text-sm font-medium rounded transition ${systemStatus[phase.id] === 'active' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                    >Open Now</button>
                                    <button
                                        onClick={() => handlePhaseChange(phase.id, 'completed')}
                                        className={`px-3 py-1.5 text-sm font-medium rounded transition ${systemStatus[phase.id] === 'completed' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >Closed</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Global Broadcast Panel */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg overflow-hidden flex flex-col text-white">
                    <div className="p-6 border-b border-gray-800">
                        <h2 className="font-bold text-xl">Global Broadcast 📢</h2>
                        <p className="text-sm text-gray-400">Push a notification to all user screens.</p>
                    </div>
                    <form onSubmit={handleBroadcast} className="p-6 flex flex-col flex-1">
                        <textarea
                            required
                            rows={4}
                            value={announcement}
                            onChange={(e) => setAnnouncement(e.target.value)}
                            placeholder="e.g., 'Attention hackers: Only 1 hour remaining in Round 2!'"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition resize-none mb-4"
                        />
                        <button
                            type="submit"
                            className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                        >
                            SEND ALERT
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}
