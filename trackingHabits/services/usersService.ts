// src/services/usersService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// === Ajuste aqui se for usar .env / Constants ===
const BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 15000;

// ===== Tipos (espelham seu backend) =====
export type Permissao = "Admin" | "User" | "Viewer" | string;

export interface User {
  id: string; // Guid no backend
  nome: string;
  telefone: string;
  senha?: string; // apenas em criação/atualização
  permissao?: Permissao;
  // adicione outros campos que existirem no seu Entity
}

export interface LoginRequest {
  telefone: string;
  senha: string;
}

export interface LoginResponse {
  id: string; // Guid
  nome: string;
  telefone: string;
  token?: string; // caso você passe a emitir JWT
  permissao?: Permissao;
  usuario?: User;
}

export interface ApiError {
  error?: string;
  message?: string;
  [k: string]: any;
}

// ===== Storage keys =====
const TOKEN_KEY = "@auth_token";
const ME_KEY = "@me";

// ===== Sessão (get/set) =====
async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
async function setToken(token: string | null) {
  if (!token) return AsyncStorage.removeItem(TOKEN_KEY);
  return AsyncStorage.setItem(TOKEN_KEY, token);
}
async function getMe(): Promise<LoginResponse | null> {
  const raw = await AsyncStorage.getItem(ME_KEY);
  return raw ? (JSON.parse(raw) as LoginResponse) : null;
}
async function setMe(me: LoginResponse | null) {
  if (!me) return AsyncStorage.removeItem(ME_KEY);
  return AsyncStorage.setItem(ME_KEY, JSON.stringify(me));
}

// API pública para outras partes do app
export const Session = {
  /** Retorna o usuário logado (LoginResponse) ou null */
  getCurrentUser: getMe,
  /** Retorna o token persistido (pode ser null se backend ainda não emite) */
  getToken,
  /** True se existir token ou @me salvo */
  async isLoggedIn() {
    const [tk, me] = await Promise.all([getToken(), getMe()]);
    return !!tk || !!me;
  },
  /** Força recarregar (útil em guards) → { me, token } */
  async load() {
    const [tk, me] = await Promise.all([getToken(), getMe()]);
    return { token: tk, me };
  },
};

// ===== Helper de request com timeout e headers =====
async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number; auth?: boolean }
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, auth = false, ...rest } = init || {};
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(rest.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });

    const text = await res.text();
    const isJson = text.trim().startsWith("{") || text.trim().startsWith("[");
    const data = isJson ? JSON.parse(text) : (text as unknown as T);

    if (!res.ok) {
      const err: ApiError =
        typeof data === "object" && data ? (data as ApiError) : { message: text };
      const msg = err.error || err.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data as T;
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("Tempo de requisição excedido.");
    throw e;
  } finally {
    clearTimeout(to);
  }
}

// ===== Service =====
export const UsersService = {
  // Auth
  async login(req: LoginRequest): Promise<LoginResponse> {
    const resp = await request<LoginResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify(req),
    });

    // Persistência de sessão
    // 1) salva token se existir (quando você ativar JWT no backend, já funciona)
    if (resp?.token) await setToken(resp.token);
    // 2) salva @me (sempre salva para manter id/nome/telefone/permissão)
    await setMe(resp);

    return resp;
  },

  async logout() {
    await Promise.all([setToken(null), setMe(null)]);
  },

  /** Retorna o usuário logado ou lança erro se não houver sessão */
  async requireUser(): Promise<LoginResponse> {
    const me = await getMe();
    if (!me?.id) throw new Error("Sessão não encontrada. Faça login novamente.");
    return me;
  },

  // Users CRUD
  async getAll(): Promise<User[]> {
    return request<User[]>("/users", { method: "GET", auth: true });
  },

  async getById(id: string): Promise<User> {
    return request<User>(`/users/${id}`, { method: "GET", auth: true });
  },

  async create(user: User): Promise<User> {
    return request<User>("/users", {
      method: "POST",
      body: JSON.stringify(user),
      auth: true,
    });
  },

  async update(user: User): Promise<void> {
    if (!user.id) throw new Error("Id do usuário é obrigatório para atualizar.");
    await request<void>(`/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify(user),
      auth: true,
    });
  },

  async remove(id: string): Promise<void> {
    await request<void>(`/users/${id}`, { method: "DELETE", auth: true });
  },

  async resetPassword(id: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
    }
    await request<void>(`/users/${id}/password/reset`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
      auth: true,
    });
  },
};
