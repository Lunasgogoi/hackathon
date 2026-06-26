import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client'; // Assuming Axios is set up

export default function JudgeDashboard() {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');

    // Rubric State
    const [scores, setScores] = useState({
        innovation: 5,
        technical: 5,
        ui_ux: 5
    });

    const fetchProjects = useCallback(async () => {
        try {
            // REAL AXIOS CALL: Fetch pending projects from FastAPI
            const response = await apiClient.get('/projects/pending');
            const pendingProjects = Array.isArray(response.data)
                ? response.data
                : response.data.projects || response.data.pending_projects || [];

            setProjects(pendingProjects);
            setError('');
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch projects", error);
            setError(error.response?.data?.detail || "Failed to fetch project queue.");
            setProjects([]);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleEvaluate = async (e) => {
        e.preventDefault();
        if (!selectedProject) return;

        try {
            // REAL AXIOS CALL: Send the evaluation to FastAPI
            const response = await apiClient.post('/projects/evaluate', {
                project_id: selectedProject.id, // Make sure this matches your FastAPI schema
                ui_ux_score: scores.ui_ux,
                technical_complexity: scores.technical,
                innovation: scores.innovation,
                feedback: feedback.trim() || null
            });

            const totalScore = response.data.total_score ?? (scores.innovation + scores.technical + scores.ui_ux);
            alert(`Successfully graded ${selectedProject.title} with a score of ${totalScore}!`);

            setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
            setSelectedProject(null);
            setScores({ innovation: 5, technical: 5, ui_ux: 5 });
            setFeedback('');

        } catch (error) {
            alert(error.response?.data?.detail || "Failed to submit evaluation.");
        }
    };

    if (loading) {
        return <div className="p-10 text-center font-bold text-gray-500">Loading submission queue...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* LEFT COLUMN: The Queue */}
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[80vh]">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-bold text-gray-900">Submission Queue</h2>
                    <p className="text-xs text-gray-500">{projects.length} projects awaiting review</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {error && (
                        <div className="m-2 rounded border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {projects.length === 0 && (
                        <div className="text-center p-8 text-gray-400 text-sm">No projects left to review!</div>
                    )}
                    {projects.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProject(p)}
                            className={`p-4 rounded-lg cursor-pointer transition-colors border
                ${selectedProject?.id === p.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-100 hover:border-gray-300'}
              `}
                        >
                            <h3 className="font-bold text-gray-900 text-sm truncate">{p.title}</h3>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-gray-500">Team {p.team_id}</span>
                                <span className="text-[10px] uppercase tracking-wide bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Pending Review</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT COLUMN: Evaluation Form */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[80vh] flex flex-col">
                {!selectedProject ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <span className="text-4xl mb-4">📝</span>
                        <p>Select a project from the queue to begin grading.</p>
                    </div>
                ) : (
                    <>
                        {/* Project Details Header */}
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedProject.title}</h2>
                            <p className="text-gray-600 text-sm mb-4">{selectedProject.description}</p>

                            <div className="flex gap-4">
                                <a href={selectedProject.repo_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                    🔗 GitHub Repository
                                </a>
                                {selectedProject.asset_url && (
                                    <a href={selectedProject.asset_url} target="_blank" rel="noreferrer" className="text-sm text-purple-600 hover:underline flex items-center gap-1">
                                        🖼️ View Assets/Slides
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Rubric Form */}
                        <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
                            <h3 className="font-bold text-gray-900 mb-6 uppercase tracking-wide text-sm">Grading Rubric (1-10)</h3>

                            <form onSubmit={handleEvaluate} className="space-y-6 max-w-lg">
                                {[
                                    { id: 'innovation', label: 'Innovation & Creativity', desc: 'Is the idea unique?' },
                                    { id: 'technical', label: 'Technical Complexity', desc: 'Difficulty of the tech stack & execution.' },
                                    { id: 'ui_ux', label: 'UI/UX Design', desc: 'Is the user experience intuitive and clean?' }
                                ].map(criterion => (
                                    <div key={criterion.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="font-bold text-gray-800 text-sm">{criterion.label}</label>
                                            <span className="font-mono font-bold text-blue-600">{scores[criterion.id]} / 10</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3">{criterion.desc}</p>
                                        <input
                                            type="range"
                                            min="1" max="10" step="1"
                                            value={scores[criterion.id]}
                                            onChange={(e) => setScores({ ...scores, [criterion.id]: parseInt(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                ))}

                                <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                                    <label className="font-bold text-gray-800 text-sm">Feedback</label>
                                    <textarea
                                        rows={4}
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Optional notes for the team..."
                                        className="mt-3 w-full rounded border border-gray-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-green-700 transition">
                                    Submit Final Evaluation
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
