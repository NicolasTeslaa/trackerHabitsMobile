// src/services/habits.service.ts

export type Habit = {
  id: string;
  name: string;
  monthCount: number;
  streak: number;
  total: number;
  monthProgressPct: number; // 0..1
  lastDate: string; // 'pt-BR' ex.: '22/10/2025' ou '-'
  dueToday: boolean; // true => ainda precisa fazer hoje
};

function todayStr() {
  return new Date().toLocaleDateString('pt-BR');
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// ======================= MOCK DATA =======================

const MOCK_HABITS: Habit[] = [
  {
    id: '1',
    name: 'Academia',
    monthCount: 7,
    streak: 3,
    total: 45,
    monthProgressPct: 0.23,
    lastDate: '20/10/2025',
    dueToday: true,
  },
  {
    id: '2',
    name: 'Leitura (30 min)',
    monthCount: 10,
    streak: 10,
    total: 120,
    monthProgressPct: 0.5,
    lastDate: todayStr(), // já fez hoje
    dueToday: false,
  },
  {
    id: '3',
    name: 'Beber 2L de água',
    monthCount: 12,
    streak: 2,
    total: 210,
    monthProgressPct: 0.4,
    lastDate: '21/10/2025',
    dueToday: true,
  },
  {
    id: '4',
    name: 'Estudar Inglês',
    monthCount: 8,
    streak: 0,
    total: 60,
    monthProgressPct: 0.3,
    lastDate: '-',
    dueToday: true,
  },
  {
    id: '5',
    name: 'Meditar (10 min)',
    monthCount: 15,
    streak: 6,
    total: 95,
    monthProgressPct: 0.6,
    lastDate: todayStr(), // já fez hoje
    dueToday: false,
  },
  {
    id: '6',
    name: 'Código (Pomodoro)',
    monthCount: 9,
    streak: 1,
    total: 200,
    monthProgressPct: 0.35,
    lastDate: '19/10/2025',
    dueToday: true,
  },
];

// ======================= IN-MEMORY DB =======================

let db: Habit[] = structuredClone
  ? structuredClone(MOCK_HABITS)
  : JSON.parse(JSON.stringify(MOCK_HABITS));

// ======================= SERVICE API =======================

export type ListOptions = {
  query?: string; // busca por nome
  tab?: 'all' | 'today' | 'done';
  orderBy?: 'streak' | 'name' | 'month';
};

export async function listHabits(opts: ListOptions = {}): Promise<Habit[]> {
  const { query = '', tab = 'all', orderBy = 'streak' } = opts;
  const q = query.trim().toLowerCase();
  const today = todayStr();

  let arr = db.filter(h => h.name.toLowerCase().includes(q));

  if (tab === 'today') arr = arr.filter(h => h.dueToday);
  if (tab === 'done') arr = arr.filter(h => !h.dueToday && h.lastDate === today);

  if (orderBy === 'streak') arr = [...arr].sort((a, b) => b.streak - a.streak);
  if (orderBy === 'name') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
  if (orderBy === 'month') arr = [...arr].sort((a, b) => b.monthCount - a.monthCount);

  return arr;
}

export async function getHabit(id: string): Promise<Habit | undefined> {
  return db.find(h => h.id === id);
}

export async function createHabit(name: string): Promise<Habit> {
  const id = String(nextId());
  const h: Habit = {
    id,
    name,
    monthCount: 0,
    streak: 0,
    total: 0,
    monthProgressPct: 0,
    lastDate: '-',
    dueToday: true,
  };
  db = [...db, h];
  return h;
}

export type HabitPatch = Partial<Omit<Habit, 'id'>>;

export async function updateHabit(id: string, patch: HabitPatch): Promise<Habit | undefined> {
  let updated: Habit | undefined;
  db = db.map(h => {
    if (h.id !== id) return h;
    updated = { ...h, ...patch };
    // sanidade em fields numéricos
    updated.monthCount = Math.max(0, updated.monthCount);
    updated.streak = Math.max(0, updated.streak);
    updated.total = Math.max(0, updated.total);
    updated.monthProgressPct = clamp01(updated.monthProgressPct);
    return updated;
  });
  return updated;
}

export async function deleteHabit(id: string): Promise<void> {
  db = db.filter(h => h.id !== id);
}

export async function completeToday(id: string): Promise<Habit | undefined> {
  const today = todayStr();
  let updated: Habit | undefined;
  db = db.map(h => {
    if (h.id !== id) return h;
    if (!h.dueToday) return h; // já concluído hoje
    updated = {
      ...h,
      monthCount: h.monthCount + 1,
      total: h.total + 1,
      streak: h.streak + 1,
      monthProgressPct: clamp01(h.monthProgressPct + 0.05),
      lastDate: today,
      dueToday: false,
    };
    return updated;
  });
  return updated;
}

export async function undoToday(id: string): Promise<Habit | undefined> {
  const today = todayStr();
  let updated: Habit | undefined;
  db = db.map(h => {
    if (h.id !== id) return h;
    if (h.dueToday || h.lastDate !== today) return h; // só desfaz se foi hoje
    updated = {
      ...h,
      monthCount: Math.max(0, h.monthCount - 1),
      total: Math.max(0, h.total - 1),
      streak: Math.max(0, h.streak - 1),
      monthProgressPct: clamp01(h.monthProgressPct - 0.05),
      lastDate: '-',
      dueToday: true,
    };
    return updated;
  });
  return updated;
}

export async function toggleToday(id: string): Promise<Habit | undefined> {
  const h = db.find(x => x.id === id);
  if (!h) return undefined;
  return h.dueToday ? completeToday(id) : undoToday(id);
}

export async function resetMocks(): Promise<void> {
  db = structuredClone ? structuredClone(MOCK_HABITS) : JSON.parse(JSON.stringify(MOCK_HABITS));
}

export async function stats() {
  const today = todayStr();
  const ativos = db.length;
  const hoje = db.filter(h => h.dueToday).length;
  const noMes = db.reduce((acc, h) => acc + h.monthCount, 0);
  const concluidosHoje = db.filter(h => !h.dueToday && h.lastDate === today).length;
  return { ativos, hoje, noMes, concluidosHoje };
}

// ======================= INTERNALS =======================

function nextId() {
  const nums = db.map(h => Number(h.id)).filter(n => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}
