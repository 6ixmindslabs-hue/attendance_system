import axios from 'axios';
import { clearStoredSession, getStoredSession } from './session';

const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').trim();

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export const API_BASE_URL = normalizeBaseUrl(rawApiUrl);
export const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;

export const api = axios.create({
    baseURL: API_V1_BASE_URL
});

api.interceptors.request.use((config) => {
    const session = getStoredSession();

    if (session?.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            clearStoredSession();
        }

        return Promise.reject(error);
    }
);

export const getApiErrorMessage = (error: unknown, fallbackMessage = 'Request failed.') => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as {
            error?: string;
            message?: string;
            details?: string;
            detail?: string;
        } | undefined;
        const message = [
            data?.message,
            data?.error,
            data?.details,
            data?.detail,
            error.message
        ].filter(Boolean).join(' - ');

        return message || fallbackMessage;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return fallbackMessage;
};
