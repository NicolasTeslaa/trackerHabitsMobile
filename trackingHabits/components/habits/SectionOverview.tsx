import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { HabitExt, Palette } from './utils';
import { styles as makeStyles } from './utils';

export function SectionOverview({
    C, habits, currentDate,
}: { C: Palette; habits: HabitExt[]; currentDate: Date }) {
    const S = makeStyles(C);
    const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // últimos 6 meses
    type Row = { monthIndex: number; habits: { id: string; name: string; completions: number }[]; };
    const monthlyData = useMemo<Row[]>(() => {
        const rows: Row[] = [];
        const base = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            rows.push({
                monthIndex: d.getMonth(),
                habits: habits.map(h => ({ id: h.id, name: h.name, completions: h.completedDates.filter(ds => ds.startsWith(mk)).length })),
            });
        }
        return rows;
    }, [habits]);

    const currentMonthData = useMemo(() => {
        const found = monthlyData.find(d => d.monthIndex === currentDate.getMonth());
        return found ?? monthlyData[monthlyData.length - 1];
    }, [monthlyData, currentDate]);

    const sortedCurrent = useMemo(
        () => [...currentMonthData.habits].sort((a, b) => b.completions - a.completions || a.name.localeCompare(b.name)),
        [currentMonthData]
    );

    const maxCompletions = Math.max(...sortedCurrent.map(h => h.completions), 1);

    const monthlyTotals = useMemo(() =>
        monthlyData.map(m => ({
            label: monthShort[m.monthIndex],
            total: m.habits.reduce((s, h) => s + h.completions, 0),
        })), [monthlyData]);

    const maxMonthlyTotal = Math.max(...monthlyTotals.map(t => t.total), 1);

    return (
        <View style={S.card}>
            {/* Totais por mês */}
            <View style={{ marginBottom: 18 }}>
                <Text style={S.sectionTitle}>Totais por mês</Text>
                <View style={S.monthTotalsRow}>
                    {monthlyTotals.map((m, idx) => (
                        <View key={idx} style={S.monthTotalsCol}>
                            <View style={[S.monthTotalsBar, { height: Math.max(0, (m.total / (maxMonthlyTotal || 1)) * 80) }]} />
                            <Text style={S.trendLabel}>{m.label}</Text>
                            <Text style={S.trendValue}>{m.total}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Top/Bottom do mês atual */}
            <View style={S.grid2}>
                <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#eff6ff' : '#0b1220' }]}>
                    <Text style={[S.blockTitle, { color: C.primary }]}>Top 3 — Mais concluídos (mês)</Text>
                    {sortedCurrent.slice(0, 3).map((h, i) => (
                        <View key={h.id} style={{ marginBottom: 10 }}>
                            <View style={S.rowBetween}>
                                <Text style={[S.habitName, { color: C.text }]} numberOfLines={1}>{i + 1}. {h.name}</Text>
                                <Text style={{ color: C.primary }}>{h.completions}</Text>
                            </View>
                            <View style={[S.smallTrack, { backgroundColor: C.card }]}>
                                <View style={[S.smallFill, { width: `${(h.completions / (maxCompletions || 1)) * 100}%`, backgroundColor: C.primary }]} />
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#fff1f2' : '#1b0f12' }]}>
                    <Text style={[S.blockTitle, { color: '#e11d48' }]}>Menos concluídos (mês)</Text>
                    {sortedCurrent.slice(-3).reverse().map((h, i) => (
                        <View key={h.id} style={{ marginBottom: 10 }}>
                            <View style={S.rowBetween}>
                                <Text style={[S.habitName, { color: C.text }]} numberOfLines={1}>{i + 1}. {h.name}</Text>
                                <Text style={{ color: '#e11d48' }}>{h.completions}</Text>
                            </View>
                            <View style={[S.smallTrack, { backgroundColor: C.card }]}>
                                <View
                                    style={[
                                        S.smallFill,
                                        {
                                            width: `${(h.completions / (maxCompletions || 1)) * 100}%`,
                                            backgroundColor: '#e11d48',
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
