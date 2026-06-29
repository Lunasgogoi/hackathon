import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '../api/client';

const PHASE_LABELS = {
  locked: 'Not Open Yet',
  active: 'Live Now',
  completed: 'Closed'
};

const DEFAULT_PROGRESS = {
  registration: true,
  round1: false,
  round2: false
};

const getPhaseClasses = (status, activeColor = 'blue') => {
  if (status === 'completed') {
    return {
      circle: 'bg-green-500 border-green-100',
      icon: 'text-white',
      card: 'border-green-400',
      stripe: 'bg-green-500',
      badge: 'bg-green-100 text-green-700'
    };
  }

  if (status === 'active') {
    const isPurple = activeColor === 'purple';

    return {
      circle: isPurple
        ? 'bg-purple-600 border-purple-200 shadow-[0_0_15px_rgba(147,51,234,0.4)]'
        : 'bg-blue-500 border-blue-100',
      icon: 'text-white',
      card: isPurple ? 'border-purple-400' : 'border-blue-400',
      stripe: isPurple ? 'bg-purple-500' : 'bg-blue-500',
      badge: isPurple ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
    };
  }

  return {
    circle: 'bg-gray-100 border-gray-200',
    icon: 'text-gray-400',
    card: 'border-gray-200',
    stripe: '',
    badge: 'bg-gray-100 text-gray-500'
  };
};

const getParticipantStatuses = (stages, progress, round2Eligible) => {
  const currentProgress = { ...DEFAULT_PROGRESS, ...progress };

  return {
    registration: currentProgress.registration ? 'completed' : stages.registration || 'locked',
    round1: currentProgress.registration
      ? currentProgress.round1 ? 'completed' : stages.round1 || 'locked'
      : 'locked',
    round2: currentProgress.round1 && round2Eligible
      ? currentProgress.round2 ? 'completed' : stages.round2 || 'locked'
      : 'locked',
    finale: currentProgress.round2 && round2Eligible ? stages.finale || 'locked' : 'locked'
  };
};

const getHackathonAccess = (
  stages,
  participantStatuses,
  hasTeam,
  round2Eligible,
  isTeamLeader,
  hasProjectSubmission
) => {
  if (!hasTeam) {
    return {
      status: 'Team Required',
      label: 'Create or Join Team First',
      helper: 'Team membership is required before entering the hackathon.',
      action: 'team',
      disabled: false,
      buttonClass: 'bg-blue-600 text-white hover:bg-blue-700'
    };
  }

  if (stages.finale === 'completed') {
    return {
      status: 'Ended',
      label: 'View Final Standings',
      helper: 'The hackathon has ended. Final standings remain available.',
      action: 'leaderboard',
      disabled: false,
      buttonClass: 'bg-gray-900 text-white hover:bg-black'
    };
  }

  if (stages.finale === 'active') {
    return {
      status: 'Started',
      label: 'Attend Finale',
      helper: 'Final judging is live. Follow the standings in real time.',
      action: 'leaderboard',
      disabled: false,
      buttonClass: 'bg-purple-600 text-white hover:bg-purple-700'
    };
  }

  if (stages.round2 === 'active') {
    if (round2Eligible && participantStatuses.round2 === 'active') {
      if (hasProjectSubmission) {
        return {
          status: 'Submitted',
          label: 'Project Submitted',
          helper: 'Project submitted successfully. Your team is now under final review.',
          action: null,
          disabled: true,
          buttonClass: 'bg-gray-100 text-gray-400'
        };
      }

      if (!isTeamLeader) {
        return {
          status: 'Team Leader Required',
          label: 'Only Team Leaders Can Submit',
          helper: 'Only team leaders can submit the project for the team.',
          action: null,
          disabled: true,
          buttonClass: 'bg-gray-100 text-gray-400'
        };
      }

      return {
        status: 'Started',
        label: 'Enter Build Phase',
        helper: 'Round 2 is live for your qualified team.',
        action: 'project',
        disabled: false,
        buttonClass: 'bg-blue-600 text-white hover:bg-blue-700'
      };
    }

    return {
      status: 'Started',
      label: 'Attend Hackathon',
      helper: 'Round 2 is live. You can follow the public standings.',
      action: 'leaderboard',
      disabled: false,
      buttonClass: 'bg-indigo-600 text-white hover:bg-indigo-700'
    };
  }

  if (participantStatuses.round1 === 'completed') {
    return {
      status: 'Submitted',
      label: 'View Round 1 Status',
      helper: 'Your Round 1 submission is recorded. View your score, team average, and Round 2 qualification status.',
      action: 'assessment-status',
      disabled: false,
      buttonClass: 'bg-blue-600 text-white hover:bg-blue-700'
    };
  }

  if (stages.round1 === 'active') {
    return {
      status: 'Started',
      label: 'Enter Round 1',
      helper: 'Round 1 is live for registered team members.',
      action: 'assessment',
      disabled: false,
      buttonClass: 'bg-blue-600 text-white hover:bg-blue-700'
    };
  }

  return {
    status: 'Not Started',
    label: 'Hackathon Not Started',
    helper: 'You can manage your team until an organizer starts Round 1.',
    action: null,
    disabled: true,
    buttonClass: 'bg-gray-100 text-gray-400'
  };
};

const formatApiError = (error, fallback = 'Something went wrong.') => {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(item => item.msg).join(', ');
  return fallback;
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

function MemberAvatar({ member, size = 'md' }) {
  const sizeClasses = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-11 w-11 text-sm';

  if (member?.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.username}
        className={`${sizeClasses} shrink-0 rounded-full object-cover ring-2 ring-white`}
      />
    );
  }

  return (
    <div className={`${sizeClasses} shrink-0 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-black text-white ring-2 ring-white`}>
      {getInitials(member?.username)}
    </div>
  );
}

function TeamPanel({ teamPayload, setTeamPayload, registrationStatus = 'active' }) {
  const [mode, setMode] = useState('create');
  const [teamForm, setTeamForm] = useState({ name: '', description: '', maxMembers: 4 });
  const [joinCode, setJoinCode] = useState('');
  const [profileForm, setProfileForm] = useState({
    avatarUrl: teamPayload?.current_user?.avatar_url || '',
    skills: teamPayload?.current_user?.skills || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentUser = teamPayload?.current_user;
  const team = teamPayload?.team;
  const canModifyTeam = registrationStatus === 'active';
  const registrationUnavailableMessage = registrationStatus === 'completed'
    ? 'Team registration is closed.'
    : 'Team registration is not open yet.';

  const loadTeam = async () => {
    const response = await apiClient.get('/teams/me');
    setTeamPayload(response.data);
    return response.data;
  };

  const handleCreateTeam = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post('/teams/create', {
        name: teamForm.name,
        description: teamForm.description || null,
        max_members: Number(teamForm.maxMembers)
      });
      await loadTeam();
      setMessage(response.data.message || 'Team created.');
    } catch (err) {
      setError(formatApiError(err, 'Could not create team.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleJoinTeam = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.post('/teams/join', {
        invite_code: joinCode.trim().toUpperCase()
      });
      await loadTeam();
      setMessage(response.data.message || 'Joined team.');
    } catch (err) {
      setError(formatApiError(err, 'Could not join team.'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfile = async (nextProfile = profileForm) => {
    const response = await apiClient.patch('/teams/profile', {
      avatar_url: nextProfile.avatarUrl || null,
      skills: nextProfile.skills || null
    });
    setTeamPayload({
      current_user: response.data.current_user,
      team: response.data.team
    });
    return response.data;
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await saveProfile();
      setMessage(response.message || 'Profile updated.');
    } catch (err) {
      setError(formatApiError(err, 'Could not update profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    setError('');
    setMessage('');

    if (!cloudName || !uploadPreset) {
      setError('Cloudinary is not configured. Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo is too large. Upload an image under 5MB.');
      event.target.value = '';
      return;
    }

    setIsUploading(true);

    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', uploadPreset);

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        data,
        {
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 1;
            setUploadProgress(Math.round((progressEvent.loaded * 100) / total));
          }
        }
      );

      const nextProfile = {
        ...profileForm,
        avatarUrl: response.data.secure_url
      };
      setProfileForm(nextProfile);
      await saveProfile(nextProfile);
      setMessage('Photo updated.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to upload photo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  return (
    <aside className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <MemberAvatar member={currentUser} size="lg" />
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-bold uppercase ${currentUser?.is_captain ? 'text-emerald-600' : 'text-gray-400'}`}>
              {currentUser?.is_captain ? 'Team Leader' : 'Participant'}
            </div>
            <h2 className="truncate text-xl font-black text-gray-900">{currentUser?.username || 'Profile'}</h2>
            <p className="truncate text-sm text-gray-500">{currentUser?.email}</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-900">Photo</span>
            <div className="relative flex h-11 items-center rounded-md border border-gray-300 bg-gray-50 px-3 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isUploading}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              {isUploading ? `Uploading ${uploadProgress}%` : 'Choose image'}
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-900">Skills</span>
            <input
              type="text"
              value={profileForm.skills}
              onChange={(event) => setProfileForm(prev => ({ ...prev, skills: event.target.value }))}
              placeholder="React, FastAPI, ML"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:cursor-wait disabled:bg-gray-400"
          >
            Save Profile
          </button>
        </form>
      </div>

      {!team && !canModifyTeam ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="text-lg font-black text-amber-900">Team Registration Unavailable</h3>
          <p className="mt-2 text-sm font-semibold text-amber-700">
            {registrationUnavailableMessage} You can sign in, but teams can only be created or joined while registration is open.
          </p>
        </div>
      ) : !team ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex rounded-md border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 rounded px-3 py-2 text-sm font-bold ${mode === 'create' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex-1 rounded px-3 py-2 text-sm font-bold ${mode === 'join' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              Join
            </button>
          </div>

          {mode === 'create' ? (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <h3 className="text-lg font-black text-gray-900">Create Team</h3>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={teamForm.name}
                onChange={(event) => setTeamForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Team name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <textarea
                rows={3}
                maxLength={255}
                value={teamForm.description}
                onChange={(event) => setTeamForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Short team description"
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-gray-900">Max members</span>
                <input
                  type="number"
                  min={2}
                  max={6}
                  value={teamForm.maxMembers}
                  onChange={(event) => setTeamForm(prev => ({ ...prev, maxMembers: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
              >
                Create Team
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinTeam} className="space-y-4">
              <h3 className="text-lg font-black text-gray-900">Join Team</h3>
              <input
                type="text"
                required
                minLength={4}
                maxLength={24}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Invite code"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
              >
                Join Team
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-gray-400">Team</div>
              <h2 className="text-xl font-black text-gray-900">{team.name}</h2>
              {team.description && <p className="mt-1 text-sm text-gray-600">{team.description}</p>}
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
              {team.member_count}/{team.max_members}
            </span>
          </div>

          <div className="mt-4 rounded-md border border-dashed border-blue-200 bg-blue-50 px-4 py-3">
            <div className="text-xs font-bold uppercase text-blue-500">Invite Code</div>
            <div className="mt-1 font-mono text-2xl font-black tracking-widest text-blue-900">{team.invite_code || 'PENDING'}</div>
          </div>

          <div className="mt-5 space-y-3">
            {team.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <MemberAvatar member={member} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-black text-gray-900">{member.username}</div>
                    {member.is_captain && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                        Team Leader
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-500">{member.skills || member.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(message || error) && (
        <div className={`rounded-md border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || message}
        </div>
      )}
    </aside>
  );
}

function TeamAccessCard({
  teamPayload,
  teamError,
  accessDetails,
  onAccess,
  onDownloadCertificate,
  isDownloadingCertificate,
  certificateError
}) {
  const team = teamPayload?.team;
  const canRequestCertificate = team && accessDetails.status === 'Ended';

  return (
    <aside className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-400">Hackathon Access</div>
            <h2 className="mt-1 text-xl font-black text-gray-900">{accessDetails.status}</h2>
          </div>
          {team && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
              Team Ready
            </span>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-600">{accessDetails.helper}</p>
        <button
          type="button"
          onClick={() => onAccess()}
          disabled={accessDetails.disabled}
          className={`mt-5 w-full rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${accessDetails.buttonClass}`}
        >
          {accessDetails.label}
        </button>
        {canRequestCertificate && (
          <button
            type="button"
            onClick={onDownloadCertificate}
            disabled={isDownloadingCertificate}
            className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:bg-gray-100 disabled:text-gray-400"
          >
            {isDownloadingCertificate ? 'Preparing Certificate...' : 'Download Certificate'}
          </button>
        )}
        {certificateError && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            {certificateError}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-400">Team</div>
            <h2 className="mt-1 text-lg font-black text-gray-900">
              {team ? team.name : 'No Team Yet'}
            </h2>
          </div>
          {team && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
              {team.member_count}/{team.max_members}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {team
            ? `${team.name} is registered and ready for active hackathon phases.`
            : teamError || 'Create a team or join one using an invite code.'}
        </p>
        <button
          type="button"
          onClick={() => onAccess('team')}
          className="mt-5 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
        >
          Manage Team
        </button>
      </div>
    </aside>
  );
}

export function TeamPage() {
  const [teamPayload, setTeamPayload] = useState(null);
  const [teamError, setTeamError] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('locked');

  useEffect(() => {
    let isMounted = true;

    const loadTeam = async () => {
      try {
        const response = await apiClient.get('/teams/me');
        if (isMounted) setTeamPayload(response.data);
      } catch (error) {
        if (isMounted) setTeamError(formatApiError(error, 'Could not load team details.'));
      }
    };
    const loadPhases = async () => {
      try {
        const response = await apiClient.get('/system/phases');
        if (isMounted) setRegistrationStatus(response.data.registration || 'locked');
      } catch {
        if (isMounted) setRegistrationStatus('locked');
      }
    };

    loadTeam();
    loadPhases();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto mt-8 max-w-3xl pb-12">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase text-blue-600">Team Setup</div>
        <h1 className="text-3xl font-black tracking-tight text-gray-900">Manage Team</h1>
      </div>
      {teamPayload ? (
        <TeamPanel
          teamPayload={teamPayload}
          setTeamPayload={setTeamPayload}
          registrationStatus={registrationStatus}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm font-semibold text-gray-500 shadow-sm">
          {teamError || 'Loading team setup...'}
        </div>
      )}
    </div>
  );
}

export default function HackathonHub({ stages, progress, round2Eligible, onLaunchOA, onLaunchProject }) {
  const navigate = useNavigate();
  const [teamPayload, setTeamPayload] = useState(null);
  const [teamError, setTeamError] = useState('');
  const [certificateError, setCertificateError] = useState('');
  const [isDownloadingCertificate, setIsDownloadingCertificate] = useState(false);
  const participantStatuses = getParticipantStatuses(stages, progress, round2Eligible);

  useEffect(() => {
    let isMounted = true;

    const loadTeam = async () => {
      try {
        const response = await apiClient.get('/teams/me');
        if (isMounted) setTeamPayload(response.data);
      } catch (error) {
        if (isMounted) setTeamError(formatApiError(error, 'Could not load team details.'));
      }
    };

    loadTeam();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasTeam = Boolean(teamPayload?.team);
  const registrationStatus = hasTeam ? 'completed' : stages.registration || 'locked';
  const round1Status = participantStatuses.round1;
  const round2Status = participantStatuses.round2;
  const finaleStatus = participantStatuses.finale;
  const isTeamLeader = Boolean(teamPayload?.team && teamPayload?.current_user?.id === teamPayload.team.captain_id);
  const hasProjectSubmission = Boolean(teamPayload?.team?.has_project_submission);
  const isRound2Live = stages.round2 === 'active';
  const canOpenRound2 = isRound2Live && round2Status === 'active' && round2Eligible && isTeamLeader && !hasProjectSubmission;
  const round2ButtonLabel = (() => {
    if (canOpenRound2) return 'Open Project Builder';
    if (hasProjectSubmission) return 'Project Submitted';
    if (round2Eligible && hasTeam && !isTeamLeader) return 'Only Team Leaders Can Submit';
    return 'Round 1 Qualification Required';
  })();
  const round2BadgeLabel = (() => {
    if (hasProjectSubmission) return 'Submitted';
    if (isRound2Live && round2Eligible && hasTeam && !isTeamLeader) return 'Leader Only';
    if (isRound2Live && !canOpenRound2) return 'Qualified Teams Only';
    return PHASE_LABELS[round2Status];
  })();
  const round2HelperText = (() => {
    if (hasProjectSubmission) return 'Project submitted successfully. Your team is now under final review.';
    if (round2Eligible && hasTeam && !isTeamLeader) return 'Only team leaders can submit the project for the team.';
    return 'Promoted teams will submit their GitHub repository, tech stack details, and presentation assets.';
  })();
  const accessDetails = getHackathonAccess(
    stages,
    participantStatuses,
    hasTeam,
    round2Eligible,
    isTeamLeader,
    hasProjectSubmission
  );

  const registrationClasses = getPhaseClasses(registrationStatus);
  const round1Classes = getPhaseClasses(round1Status);
  const round2Classes = getPhaseClasses(hasProjectSubmission ? 'completed' : round2Status);
  const finaleClasses = getPhaseClasses(finaleStatus, 'purple');

  const handleAccess = (overrideAction) => {
    const action = overrideAction || accessDetails.action;

    if (action === 'team') navigate('/team');
    if (action === 'assessment') onLaunchOA();
    if (action === 'assessment-status') navigate('/assessment-status');
    if (action === 'project') onLaunchProject();
    if (action === 'leaderboard') navigate('/leaderboard');
  };

  const handleDownloadCertificate = async () => {
    setCertificateError('');
    setIsDownloadingCertificate(true);

    try {
      const response = await apiClient.get('/certificates/my-team', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTeamName = (teamPayload?.team?.name || 'team').replace(/[^a-z0-9_-]+/gi, '-');
      link.href = url;
      link.download = `hackcore-certificate-${safeTeamName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      let message = 'Certificate is not available yet.';
      const detail = error.response?.data;
      if (detail instanceof Blob) {
        try {
          const parsed = JSON.parse(await detail.text());
          message = parsed.detail || message;
        } catch {
          message = 'Certificate is not available yet.';
        }
      } else if (detail?.detail) {
        message = detail.detail;
      }
      setCertificateError(message);
    } finally {
      setIsDownloadingCertificate(false);
    }
  };

  return (
    <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-8 pb-12 lg:grid-cols-3">
      <div className="relative space-y-0 lg:col-span-2">
        <div className="phase-timeline-line absolute bottom-8 left-[27px] top-8 z-0 hidden w-0.5 border-l border-dashed border-gray-400 bg-gray-200 sm:block"></div>

        <div className="phase-step relative flex items-start p-4 sm:mb-8 sm:p-0">
          <div className={`phase-node z-10 mr-6 mt-4 hidden h-14 w-14 items-center justify-center rounded-full border shadow-sm sm:flex ${registrationClasses.circle}`}>
            <span className={`phase-node-label ${registrationClasses.icon} text-lg font-bold`}>
              {registrationStatus === 'completed' ? 'OK' : '0'}
            </span>
          </div>
          <div className={`phase-card relative flex-1 overflow-hidden rounded-xl border bg-white p-6 shadow-sm ${registrationClasses.card}`}>
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-gray-900">Team Registration</h3>
              <span className={`phase-badge rounded-full px-3 py-1 text-xs font-semibold ${registrationClasses.badge}`}>
                {hasTeam ? 'Team Ready' : registrationStatus === 'active' ? 'Open Now' : PHASE_LABELS[registrationStatus]}
              </span>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {hasTeam
                ? `${teamPayload.team.name} is registered with ${teamPayload.team.member_count} member${teamPayload.team.member_count === 1 ? '' : 's'}.`
                : registrationStatus === 'active'
                  ? 'Create a team or join one with an invite code before Round 1.'
                  : 'Team registration is not open yet.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/team')} className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                {hasTeam ? 'Manage Team' : registrationStatus === 'active' ? 'Set Up Team' : 'View Team'}
              </button>
              <button onClick={() => navigate('/rules')} className="rounded-lg border border-blue-200 bg-blue-50 px-6 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                Rules
              </button>
            </div>
          </div>
        </div>

        <div className="phase-step relative flex items-start p-4 sm:mb-8 sm:p-0">
          <div className={`phase-node z-10 mr-6 mt-4 hidden h-14 w-14 items-center justify-center rounded-full border shadow-sm sm:flex ${round1Classes.circle}`}>
            <span className={`phase-node-label ${round1Classes.icon} text-lg font-bold`}>{round1Status === 'completed' ? 'OK' : '1'}</span>
          </div>
          <div className={`phase-card relative flex-1 overflow-hidden rounded-xl border bg-white p-6 shadow-md ${round1Classes.card}`}>
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-gray-900">Round 1: Online Assessment</h3>
              <span className={`phase-badge rounded-full px-3 py-1 text-xs font-semibold ${round1Classes.badge} ${round1Status === 'active' ? 'animate-pulse' : ''}`}>
                {PHASE_LABELS[round1Status]}
              </span>
            </div>
            <p className="mb-6 mt-3 text-sm text-gray-600">Complete the algorithmic coding challenges and multiple-choice questions within the time limit.</p>
            {round1Status === 'active' ? (
              <button
                onClick={round1Status === 'completed' ? () => navigate('/assessment-status') : onLaunchOA}
                disabled={!hasTeam}
                className="w-full rounded-lg bg-blue-600 px-6 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:w-auto"
              >
                {hasTeam ? (round1Status === 'completed' ? 'View Round 1 Status' : 'Launch Assessment') : 'Create or Join Team First'}
              </button>
            ) : (
              <button disabled className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-6 py-2 font-medium text-gray-400 sm:w-auto">
                {round1Status === 'completed' ? 'Assessment Closed' : 'Not Open Yet'}
              </button>
            )}
          </div>
        </div>

        <div className="phase-step relative flex items-start p-4 sm:mb-8 sm:p-0">
          <div className={`phase-node z-10 mr-6 mt-4 hidden h-14 w-14 items-center justify-center rounded-full border shadow-sm sm:flex ${round2Classes.circle}`}>
            <span className={`phase-node-label ${round2Classes.icon} text-lg font-bold`}>{round2Status === 'completed' ? 'OK' : '2'}</span>
          </div>
          <div className={`phase-card relative flex-1 overflow-hidden rounded-xl border bg-white p-6 shadow-sm ${round2Classes.card}`}>
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-gray-900">Round 2: Virtual Build Phase</h3>
              <span className={`phase-badge rounded-full px-3 py-1 text-xs font-semibold ${round2Classes.badge} ${round2Status === 'active' ? 'animate-pulse' : ''}`}>
                {round2BadgeLabel}
              </span>
            </div>
            <p className="mb-4 text-sm text-gray-600">{round2HelperText}</p>
            {isRound2Live ? (
              <button
                onClick={canOpenRound2 ? onLaunchProject : undefined}
                disabled={!canOpenRound2}
                className={`w-full rounded-lg px-6 py-2 font-medium shadow-sm transition disabled:cursor-not-allowed sm:w-auto ${
                  hasProjectSubmission
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400'
                }`}
              >
                {round2ButtonLabel}
              </button>
            ) : (
              <button disabled className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-6 py-2 font-medium text-gray-400 sm:w-auto">
                {round2Status === 'completed' ? 'Submissions Closed' : 'Not Open Yet'}
              </button>
            )}
          </div>
        </div>

        <div className="phase-step relative flex items-start p-4 sm:mb-8 sm:p-0">
          <div className={`phase-node z-10 mr-6 mt-4 hidden h-14 w-14 items-center justify-center rounded-full border shadow-sm sm:flex ${finaleClasses.circle}`}>
            <span className={`phase-node-label ${finaleClasses.icon} text-lg font-bold`}>3</span>
          </div>
          <div className={`phase-card relative flex-1 overflow-hidden rounded-xl border bg-white p-6 shadow-sm ${finaleStatus === 'completed' ? 'border-yellow-400' : finaleClasses.card}`}>
            <div className="mb-2 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-gray-900">Round 3: Grand Finale</h3>
              {finaleStatus === 'active' && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 animate-pulse">Grading Live</span>}
              {finaleStatus === 'locked' && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">Not Open Yet</span>}
              {finaleStatus === 'completed' && <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">Final Results</span>}
            </div>
            <p className="mb-4 text-sm text-gray-600">The top teams pitch their projects live. Judges submit evaluations in real time to the global leaderboard.</p>
            {finaleStatus === 'active' && (
              <button onClick={() => navigate('/leaderboard')} className="w-full rounded-lg bg-purple-600 px-6 py-2 font-bold text-white shadow-sm transition hover:bg-purple-700 sm:w-auto">
                Live Results
              </button>
            )}
            {finaleStatus === 'completed' && (
              <button onClick={() => navigate('/leaderboard')} className="w-full rounded-lg bg-gray-900 px-6 py-2 font-bold text-white shadow-sm transition hover:bg-black sm:w-auto">
                View Final Results
              </button>
            )}
            {finaleStatus === 'locked' && (
              <button disabled className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-6 py-2 font-medium text-gray-400 sm:w-auto">
                Awaiting Finale
              </button>
            )}
          </div>
        </div>
      </div>

      <TeamAccessCard
        teamPayload={teamPayload}
        teamError={teamError}
        accessDetails={accessDetails}
        onAccess={handleAccess}
        onDownloadCertificate={handleDownloadCertificate}
        isDownloadingCertificate={isDownloadingCertificate}
        certificateError={certificateError}
      />
    </div>
  );
}
