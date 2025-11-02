import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import type { Habit } from '@/services/habits.service';

export type Palette = typeof Colors.light;
export type ChartType = 'bar' | 'trend' | 'overview' | 'insights' | 'compare';

export type HabitExt = Habit & {
  completedDates: string[]; // yyyy-MM-dd
  createdAt?: string;       // ISO
};

export function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shade(hex: string, amt = 0.2) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * amt);
  let b = (num & 0x0000ff) + Math.round(255 * amt);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  const out = (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
  return `#${out}`;
}

// concorrência controlada para enriquecer hábitos
export async function enrichWithCalendars(
  base: Habit[],
  getHabitCalendar: (id: string) => Promise<{ completedDates?: string[]; createdAt?: string }>,
  concurrency = 4
): Promise<HabitExt[]> {
  if (base.length === 0) return [];
  const out: HabitExt[] = new Array(base.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= base.length) break;
      const h = base[i];
      try {
        const dto = await getHabitCalendar(h.id);
        out[i] = { ...h, completedDates: dto.completedDates ?? [], createdAt: dto.createdAt };
      } catch {
        out[i] = { ...h, completedDates: [], createdAt: undefined };
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, base.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

/* ===== Estilos compartilhados ===== */
export function styles(C: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },
    scroll: { padding: 16 },

    headerCard: {
      backgroundColor: C.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 14,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, fontWeight: '800', color: C.text },

    segment: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.card,
      padding: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      marginTop: 20,
    },

    monthNav: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    monthLabel: { color: C.text, fontWeight: '700' },

    searchWrap: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      backgroundColor: C.background,
    },
    searchInput: { flex: 1, color: C.text },

    card: {
      backgroundColor: C.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 14,
    },
    emptyCard: {
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },

    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowCenter: { flexDirection: 'row', alignItems: 'center' },

    habitName: { fontWeight: '700', color: C.text },

    barTrack: {
      width: '100%',
      height: 12,
      backgroundColor: C.card,
      borderRadius: 999,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      marginTop: 6,
    },
    barFill: { height: '100%', backgroundColor: C.primary, borderRadius: 999 },

    trendRow: {
      height: 90,
      backgroundColor: C.card,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: C.border,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 6,
      marginTop: 6,
    },
    trendCol: { alignItems: 'center', justifyContent: 'flex-end' },
    trendBar: { width: 18, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: C.primary },
    trendLabel: { marginTop: 4, color: C.mutedText, fontSize: 11, textAlign: 'center' },
    trendValue: { color: C.text, fontSize: 11, textAlign: 'center' },

    sectionTitle: { fontWeight: '800', color: C.text, marginBottom: 8 },

    monthTotalsRow: {
      height: 110,
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 6,
    },
    monthTotalsCol: { alignItems: 'center', justifyContent: 'flex-end' },
    monthTotalsBar: { width: 22, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: C.primary },

    grid2: { flexDirection: 'row', gap: 12, marginTop: 12 },
    block: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
    blockTitle: { fontWeight: '800' },

    smallTrack: {
      width: '100%',
      height: 8,
      borderRadius: 999,
      backgroundColor: C.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      marginTop: 6,
    },
    smallFill: { height: '100%', borderRadius: 999 },

    heatGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      backgroundColor: C.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
    },
    heatCell: { width: 18, height: 18, borderRadius: 4 },

    weekRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
    weekCol: { alignItems: 'center' },
    weekBarTrack: {
      height: 90,
      width: 18,
      borderRadius: 6,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
    },
    weekBarFill: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
    weekLabel: { marginTop: 4, color: C.mutedText, fontSize: 11 },
    weekValue: { color: C.text, fontSize: 11 },
  });
}
