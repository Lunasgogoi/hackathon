const ACCESS_TOKEN_KEY = 'access_token';
const ROLE_KEY = 'role';
const PARTICIPANT_PROGRESS_KEY = 'participant_progress';

export const getAccessToken = () => sessionStorage.getItem(ACCESS_TOKEN_KEY);

export const getSessionRole = () => sessionStorage.getItem(ROLE_KEY);

export const setAuthSession = ({ token, role }) => {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  sessionStorage.setItem(ROLE_KEY, role);

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export const clearAuthSession = () => {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(PARTICIPANT_PROGRESS_KEY);

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export const loadStoredParticipantProgress = (fallback) => {
  try {
    const savedProgress = JSON.parse(sessionStorage.getItem(PARTICIPANT_PROGRESS_KEY));
    return { ...fallback, ...savedProgress };
  } catch {
    return fallback;
  }
};

export const saveStoredParticipantProgress = (progress) => {
  sessionStorage.setItem(PARTICIPANT_PROGRESS_KEY, JSON.stringify(progress));
};
