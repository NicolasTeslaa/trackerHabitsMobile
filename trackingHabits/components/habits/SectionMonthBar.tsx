import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import type { HabitExt, Palette } from './utils';
import { styles as makeStyles } from './utils';

export function SectionMonthBar({
  C, habits, currentDate, query,
}: {
  C: Palette;
  habits: HabitExt[];
  currentDate: Date;
  query: string;
}) {
  const S = makeStyles(C);

  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const rows = useMemo(() => {
    const per = habits.map(h => ({
      id: h.id,
      name: h.name,
      completions: h.completedDates.filter(d => d.startsWith(monthKey)).length,
    }));
    return per.sort((a, b) => b.completions - a.completions || a.name.localeCompare(b.name));
  }, [habits, monthKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(h => h.name.toLowerCase().includes(q));
  }, [rows, query]);

  const maxCompletions = Math.max(...rows.map(h => h.completions), 1);
  const hasCompleted = habits.some(h => h.completedDates.length > 0);

  return (
    <View style={S.card}>
      {!hasCompleted && (
        <Text style={{ color: C.mutedText, marginBottom: 8 }}>
          Para visualizar os gráficos do mês, precisamos de <Text style={{ fontWeight: 'bold' }}>completedDates</Text>.
        </Text>
      )}

      {filtered.map((h, idx) => (
        <View key={h.id} style={{ marginBottom: 12 }}>
          <View style={S.rowBetween}>
            <Text style={[S.habitName]} numberOfLines={1}>{h.name}</Text>
            <Text style={{ color: C.mutedText }}>
              {h.completions} dia{h.completions === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={S.barTrack}>
            <MotiView
              from={{ width: '0%' }}
              animate={{ width: `${(h.completions / (maxCompletions || 1)) * 100}%` }}
              transition={{ type: 'timing', duration: 600, delay: idx * 90 }}
              style={S.barFill}
            />
          </View>
        </View>
      ))}

      {filtered.length === 0 && (
        <Text style={{ color: C.mutedText, textAlign: 'center', paddingVertical: 16 }}>
          Nenhum dado de hábito para este mês.
        </Text>
      )}
    </View>
  );
}
