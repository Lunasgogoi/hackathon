// src/api/client.js
import axios from 'axios';
import { getAccessToken } from './session';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

const configuredWsBaseUrl = import.meta.env.VITE_WS_BASE_URL;

export const WS_BASE_URL = configuredWsBaseUrl || API_BASE_URL.replace(/^http/, 'ws');

export const buildWebSocketUrl = (path) => {
    const normalizedBase = WS_BASE_URL.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${normalizedBase}${normalizedPath}`;
};

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically attach the JWT token to every request
apiClient.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
