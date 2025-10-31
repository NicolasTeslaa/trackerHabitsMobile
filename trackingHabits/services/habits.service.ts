// src/services/habits.service.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || "http://localhost:3000";
const TOKEN_KEY = "@auth_token";
const DEFAULT_TIMEOUT_MS = 15000;



// Retorna o DTO completo (com completedDates)
export async function getHabitCalendar(habitId: string): Promise<HabitDTO> {
  return request<HabitDTO>(`/habits/${habitId}`, { method: "GET", auth: true });
}

// Marca / desmarca conclusão de uma data específica (yyyy-MM-dd)
export async function toggleOnDate(habitId: string, dateISO: string): Promise<void> {
  await request<void>(`/habits/${habitId}/toggle-completion?date=${encodeURIComponent(dateISO)}`, {
    method: "PATCH",
    auth: true,
  });
}

export type CreateHabitPayload = {
  name: string;
  usuarioId: string; // Guid
};

export type UpdateHabitPayload = {
  id: string;        // Guid
  name: string;
  usuarioId: string; // Guid
};

// ===== Tipo que o app já usa =====
export type Habit = {
  id: string;
  name: string;
  monthCount: number;
  streak: number;
  total: number;
  monthProgressPct: number; // 0..1
  lastDate: string;         // 'pt-BR' ou '-'
  dueToday: boolean;
};

// ===== Helpers de data =====
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function todayStrPt() {
  return new Date().toLocaleDateString("pt-BR");
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function toPtBR(dateISO: string) {
  // dateISO pode ser "yyyy-MM-dd" ou ISO completo
  const d =
    dateISO.length === 10
      ? new Date(dateISO + "T00:00:00")
      : new Date(dateISO);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}

// ===== Auth header =====
async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// ===== Fetch com timeout e Authorization =====
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
    const tk = await getToken();
    if (tk) headers.Authorization = `Bearer ${tk}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });

    const txt = await res.text();
    const isJson =
      txt.trim().startsWith("{") || txt.trim().startsWith("[");
    const data = isJson ? JSON.parse(txt) : (txt as unknown as T);

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `HTTP ${res.status}`;
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

// ===== Transformação DTO -> Habit do front =====
function dtoToHabit(dto: HabitDTO): Habit {
  const isoToday = todayISO();
  const set = new Set(dto.completedDates); // "yyyy-MM-dd"
  const total = dto.completedDates.length;

  // último dia completado
  let lastISO = "-";
  if (total > 0) {
    // pegar o mais recente
    lastISO = dto.completedDates.reduce((acc, cur) =>
      acc > cur ? acc : cur
    );
  }
  const lastDate = lastISO === "-" ? "-" : toPtBR(lastISO);

  // concluído hoje?
  const completedToday = set.has(isoToday);
  const dueToday = !completedToday;

  // contagem do mês atual
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${yyyy}-${mm}-`;
  const monthCount = dto.completedDates.filter(d => d.startsWith(monthPrefix)).length;

  // progresso do mês: completados / dias do mês
  const p = monthCount / daysInMonth(now);
  const monthProgressPct = clamp01(p);

  // streak: conta dias consecutivos até a última conclusão (se concluiu hoje, inclui hoje)
  const streak = computeStreak(set);

  return {
    id: dto.id,
    name: dto.name,
    monthCount,
    streak,
    total,
    monthProgressPct,
    lastDate,
    dueToday,
  };
}

// streak consecutivo contando a partir do dia mais recente concluído
function computeStreak(doneSet: Set<string>): number {
  if (doneSet.size === 0) return 0;

  // comece do dia mais recente (hoje se feito hoje; senão, do último dia feito)
  let startISO = todayISO();
  if (!doneSet.has(startISO)) {
    // procurar o último dia concluído
    // como CompletedDates são strings yyyy-MM-dd, dá para ordenar
    const arr = Array.from(doneSet).sort(); // asc
    startISO = arr[arr.length - 1];
  }

  let count = 0;
  let cursor = new Date(startISO + "T00:00:00");
  for (;;) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    if (doneSet.has(key)) {
      count++;
      // volta um dia
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

// --- acrescente no topo se ainda não existir ---
export type HabitDTO = {
  id: string;
  name: string;
  createdAt: string;       // ISO
  completedDates: string[]; // "yyyy-MM-dd"
};



// ======================= API SERVICE =======================

export type ListOptions = {
  userId: string;                 // OBRIGATÓRIO para buscar /habits/user/{userId}
  query?: string;                 // filtro por nome
  tab?: "all" | "today" | "done"; // mesma semântica do mock
  orderBy?: "streak" | "name" | "month";
};

export async function listHabits(opts: ListOptions): Promise<Habit[]> {
  const { userId, query = "", tab = "all", orderBy = "streak" } = opts;
  if (!userId) throw new Error("userId é obrigatório em listHabits.");

  const dtos = await request<HabitDTO[]>(`/habits/user/${userId}`, {
    method: "GET",
    auth: true,
  });

  const mapped = dtos.map(dtoToHabit);

  const q = query.trim().toLowerCase();
  const today = todayStrPt();

  let arr = mapped.filter(h => h.name.toLowerCase().includes(q));

  if (tab === "today") arr = arr.filter(h => h.dueToday);
  if (tab === "done")  arr = arr.filter(h => !h.dueToday && h.lastDate === today);

  if (orderBy === "streak") arr = [...arr].sort((a, b) => b.streak - a.streak);
  if (orderBy === "name")   arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
  if (orderBy === "month")  arr = [...arr].sort((a, b) => b.monthCount - a.monthCount);

  return arr;
}

export async function getHabit(id: string): Promise<Habit | undefined> {
  const dto = await request<HabitDTO>(`/habits/${id}`, { method: "GET", auth: true });
  return dto ? dtoToHabit(dto) : undefined;
}

export async function createHabit(name: string, usuarioId: string): Promise<Habit> {
  if (!name.trim()) throw new Error("Nome é obrigatório.");
  if (!usuarioId) throw new Error("usuarioId é obrigatório.");

  const payload: CreateHabitPayload = { name: name.trim(), usuarioId };
  const dto = await request<HabitDTO>("/habits", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: true,
  });
  return dtoToHabit(dto);
}

export type HabitPatch = Partial<Pick<UpdateHabitPayload, "name" | "usuarioId">>;

export async function updateHabit(id: string, patch: HabitPatch): Promise<void> {
  if (!id) throw new Error("Id é obrigatório.");
  // Para compat com seu backend, precisamos enviar a entidade "habit" completa exigida no PUT.
  // Aqui buscamos o DTO atual para preencher campos faltantes.
  const current = await request<HabitDTO>(`/habits/${id}`, { method: "GET", auth: true });

  const payload: UpdateHabitPayload = {
    id: current.id,
    name: patch.name ?? current.name,
    usuarioId: patch.usuarioId ?? (await getUsuarioIdFromCurrentUser()) // ajuste se já tiver esse valor em contexto
  };

  await request<void>(`/habits/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    auth: true,
  });
}

export async function deleteHabit(id: string): Promise<void> {
  await request<void>(`/habits/${id}`, { method: "DELETE", auth: true });
}

export async function completeToday(id: string): Promise<Habit | undefined> {
  // seu backend usa toggle; se hoje não estiver completo, togglar marca como feito
  const iso = todayISO();
  await request<void>(`/habits/${id}/toggle-completion?date=${encodeURIComponent(iso)}`, {
    method: "PATCH",
    auth: true,
  });
  return getHabit(id);
}

export async function undoToday(id: string): Promise<Habit | undefined> {
  // idem: toggle em "hoje" remove a marca de hoje
  const iso = todayISO();
  await request<void>(`/habits/${id}/toggle-completion?date=${encodeURIComponent(iso)}`, {
    method: "PATCH",
    auth: true,
  });
  return getHabit(id);
}

export async function toggleToday(id: string): Promise<Habit | undefined> {
  const iso = todayISO();
  await request<void>(`/habits/${id}/toggle-completion?date=${encodeURIComponent(iso)}`, {
    method: "PATCH",
    auth: true,
  });
  return getHabit(id);
}

export async function resetMocks(): Promise<void> {
  // sem efeito em API; mantido por compatibilidade (no-op)
  return;
}

export async function stats(userId: string) {
  const arr = await listHabits({ userId, tab: "all", orderBy: "streak" });
  const today = todayStrPt();
  const ativos = arr.length;
  const hoje = arr.filter(h => h.dueToday).length;
  const noMes = arr.reduce((acc, h) => acc + h.monthCount, 0);
  const concluidosHoje = arr.filter(h => !h.dueToday && h.lastDate === today).length;
  return { ativos, hoje, noMes, concluidosHoje };
}

// ======================= INTERNALS =======================

// Pega o usuarioId do usuário logado, se você não tiver isso no contexto.
// Ajuste: se você já controla o usuário logado num AuthContext, troque por lá.
async function getUsuarioIdFromCurrentUser(): Promise<string> {
  // Exemplo: se você salvou o LoginResponse no AsyncStorage
  const raw = await AsyncStorage.getItem("@me"); // defina como salvar isso no login
  if (!raw) throw new Error("usuarioId não encontrado; salve o usuário no login.");
  const me = JSON.parse(raw);
  return me.id as string; // seu LoginResponse tem id (Guid)
}
