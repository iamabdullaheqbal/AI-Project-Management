import axios, { type AxiosError } from "axios";
import { useAuthStore } from "@/stores/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt token refresh, then logout
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original?._retry) {
      const { refreshToken, login, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            if (original) original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original!));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        login(data.access_token, data.refresh_token, data.user);
        refreshQueue.forEach((cb) => cb(data.access_token));
        refreshQueue = [];
        if (original) original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original!);
      } catch {
        logout();
        refreshQueue = [];
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  },
);
