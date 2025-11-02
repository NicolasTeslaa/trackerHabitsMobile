import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import type { HabitExt, Palette } from './utils';
import { styles as makeStyles } from './utils';

export function SectionTrendSix({ C, habits }: { C: Palette; habits: HabitExt[] }) {
  const S = makeStyles(C);
  const monthShort = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  type MonthlyRow = {
    monthIndex: number; month: string; habits: { id: string; completions: number }[];
  };

  const monthlyData = useMemo<MonthlyRow[]>(() => {
    const rows: MonthlyRow[] = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const per = habits.map(h => ({
        id: h.id,
        completions: h.completedDates.filter(ds => ds.startsWith(monthKey)).length,
      }));
      rows.push({ monthIndex: d.getMonth(), month: monthShort[d.getMonth()], habits: per });
    }
    return rows;
  }, [habits]);

  const totals6 = useMemo(() => {
    const map = new Map<string, number>();
    habits.forEach(h => {
      const sum = monthlyData.reduce((s, m) => s + (m.habits.find(x => x.id === h.id)?.completions ?? 0), 0);
      map.set(h.id, sum);
    });
    return map;
  }, [habits, monthlyData]);

  const ordered = useMemo(
    () => [...habits].sort((a, b) => (totals6.get(b.id)! - totals6.get(a.id)!)),
    [habits, totals6]
  );

  const hasCompleted = habits.some(h => h.completedDates.length > 0);

  return (
    <View style={S.card}>
      {!hasCompleted && (
        <Text style={{ color: C.mutedText, marginBottom: 8 }}>
          Tendência exige <Text style={{ fontWeight: 'bold' }}>completedDates</Text> nos últimos 6 meses.
        </Text>
      )}

      {ordered.map(h => {
        const line = monthlyData.map(m => ({
          label: m.month,
          value: m.habits.find(x => x.id === h.id)?.completions ?? 0,
        }));
        const maxVal = Math.max(...line.map(x => x.value), 1);

        return (
          <View key={h.id} style={{ marginBottom: 20 }}>
            <View style={S.rowBetween}>
              <Text style={[S.habitName]} numberOfLines={1}>{h.name}</Text>
              <Text style={{ color: C.mutedText }}>Últimos 6 meses (total {totals6.get(h.id) ?? 0})</Text>
            </View>

            <View style={S.trendRow}>
              {line.map((p, idx) => (
                <View key={idx} style={S.trendCol}>
                  <MotiView
                    from={{ height: 0 }}
                    animate={{ height: Math.max(0, (p.value / maxVal) * 60) }}
                    transition={{ type: 'timing', duration: 600, delay: idx * 120 }}
                    style={S.trendBar}
                  />
                  <Text style={S.trendLabel}>{p.label}</Text>
                  <Text style={S.trendValue}>{p.value}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
