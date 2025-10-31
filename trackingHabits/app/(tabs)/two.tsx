// app/(tabs)/two.tsx
import Colors from '@/constants/Colors';
import { getHabitCalendar, listHabits, type Habit } from '@/services/habits.service';
import { Session } from '@/services/usersService';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MotiText, MotiView } from 'moti';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

type Palette = typeof Colors.light;
type ChartType = 'bar' | 'trend' | 'overview' | 'insights';

// enriquecimento local (não altera a service)
type HabitExt = Habit & {
  completedDates: string[];  // yyyy-MM-dd
  createdAt?: string;        // ISO
};

export default function TabTwoScreen() {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const S = styles(C);

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [habits, setHabits] = useState<HabitExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [chartType, setChartType] = useState<ChartType>('bar');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { me } = await Session.load();
        if (!alive) return;
        setUserId(me?.id ?? null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        // 1) busca hábitos "base"
        const base = await listHabits({ userId, tab: 'all', orderBy: 'name' as any });

        // 2) enriquece com completedDates via getHabitCalendar (concorrência limitada)
        const full = await enrichWithCalendars(base, 4);
        setHabits(full);
      } catch (e: any) {
        setErr(e?.message || 'Falha ao carregar hábitos');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ===== Helpers comuns =====
  const today = new Date();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const formatMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const getMonthName = (idx: number) => monthNames[idx] ?? '';

  const hasCompleted = useMemo(() => {
    return habits.some(h => Array.isArray(h.completedDates) && h.completedDates.length > 0);
  }, [habits]);

  // ===== Últimos 6 meses estruturados =====
  type MonthlyRow = { month: string; year: number; monthIndex: number; habits: { id: string; name: string; completions: number }[] };

  const monthlyData = useMemo<MonthlyRow[]>(() => {
    const rows: MonthlyRow[] = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const y = d.getFullYear();
      const mIx = d.getMonth();
      const monthStr = formatMonthKey(d);

      const perHabit = habits.map(h => {
        const comps = h.completedDates.filter(ds => ds.startsWith(monthStr)).length;
        return { id: h.id, name: h.name, completions: comps };
      });

      rows.push({ month: getMonthName(mIx), year: y, monthIndex: mIx, habits: perHabit });
    }
    return rows;
  }, [habits]);

  // Mês atual (ou último do array se não achou)
  const currentMonthData =
    monthlyData.find(d => d.year === currentDate.getFullYear() && d.monthIndex === currentDate.getMonth())
    ?? monthlyData[monthlyData.length - 1];

  // Ordenado por completions (mês atual)
  const sortedCurrentMonthHabits = useMemo(() => {
    if (!currentMonthData) return [] as { id: string; name: string; completions: number }[];
    return [...currentMonthData.habits].sort((a, b) => b.completions - a.completions || a.name.localeCompare(b.name));
  }, [currentMonthData]);
  const maxCompletions = Math.max(...sortedCurrentMonthHabits.map(h => h.completions), 1);

  // Totais por mês (últimos 6)
  const monthlyTotals = useMemo(() => monthlyData.map(m => ({
    label: monthShort[m.monthIndex] ?? String(m.monthIndex + 1),
    total: m.habits.reduce((s, h) => s + h.completions, 0),
  })), [monthlyData]);
  const maxMonthlyTotal = Math.max(...monthlyTotals.map(t => t.total), 1);

  // Totais 6 meses por hábito
  const sixMonthTotalsByHabit = useMemo(() => {
    const map = new Map<string, number>();
    habits.forEach(h => {
      const sum = monthlyData.reduce((s, m) => {
        const item = m.habits.find(x => x.id === h.id);
        return s + (item?.completions ?? 0);
      }, 0);
      map.set(h.id, sum);
    });
    return map;
  }, [habits, monthlyData]);

  const habitsSortedBySixMonthTotal = useMemo(() => {
    return [...habits].sort((a, b) => (sixMonthTotalsByHabit.get(b.id)! - sixMonthTotalsByHabit.get(a.id)!));
  }, [habits, sixMonthTotalsByHabit]);

  // Distribuição por dia da semana (6 meses)
  const { weekdayCounts, maxWeekday, bestWeekdayIndex, worstWeekdayIndex } = useMemo(() => {
    const counts = Array(7).fill(0);
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startKey = toKey(start);
    const endKey = toKey(end);

    habits.forEach(h => {
      h.completedDates.forEach(ds => {
        if (ds >= startKey && ds <= endKey) {
          const [y, m, d] = ds.split('-').map(Number);
          const dd = new Date(y!, (m! - 1), d!);
          counts[dd.getDay()]++;
        }
      });
    });
    const max = Math.max(...counts, 1);
    const bestIdx = counts.indexOf(Math.max(...counts));
    const worstIdx = counts.indexOf(Math.min(...counts));
    return { weekdayCounts: counts as number[], maxWeekday: max, bestWeekdayIndex: bestIdx, worstWeekdayIndex: worstIdx };
  }, [habits]);

  // Heatmap 28 dias
  const heatmapData = useMemo(() => {
    const arr: { date: string; count: number }[] = [];
    const end = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const key = toKey(d);
      const count = habits.reduce((s, h) => s + (h.completedDates.includes(key) ? 1 : 0), 0);
      arr.push({ date: key, count });
    }
    const max = Math.max(...arr.map(a => a.count), 1);
    return { arr, max };
  }, [habits]);

  // Momentum mês vs anterior
  const momentum = useMemo(() => {
    const now = new Date(today.getFullYear(), today.getMonth(), 1);
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const nowKey = formatMonthKey(now);
    const prevKey = formatMonthKey(prev);

    const list = habits.map(h => {
      const nowC = h.completedDates.filter(ds => ds.startsWith(nowKey)).length;
      const prevC = h.completedDates.filter(ds => ds.startsWith(prevKey)).length;
      return { id: h.id, name: h.name, delta: nowC - prevC, now: nowC, prev: prevC };
    });

    const gainers = [...list].sort((a, b) => b.delta - a.delta).slice(0, 3);
    const decliners = [...list].sort((a, b) => a.delta - b.delta).slice(0, 3);
    return { gainers, decliners };
  }, [habits]);

  // Consistência 30 dias
  const consistency = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startKey = toKey(start);
    const endKey = toKey(today);

    return habits.map(h => {
      const done = h.completedDates.filter(ds => ds >= startKey && ds <= endKey).length;
      const pct = Math.round((done / 30) * 100);
      return { id: h.id, name: h.name, done, pct };
    }).sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
  }, [habits]);

  // Em risco (14 dias sem atividade)
  const atRisk = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 13);
    const startKey = toKey(start);
    const endKey = toKey(today);
    return habits.filter(h => !h.completedDates.some(ds => ds >= startKey && ds <= endKey));
  }, [habits]);

  // Pareto 6 meses
  const pareto = useMemo(() => {
    const totals = habits.map(h => ({
      id: h.id,
      name: h.name,
      total: sixMonthTotalsByHabit.get(h.id) || 0
    })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const grand = totals.reduce((s, x) => s + x.total, 0) || 1;
    let acc = 0;
    const rows = totals.map((x, i) => {
      acc += x.total;
      const share = (x.total / grand) * 100;
      const cum = (acc / grand) * 100;
      return { ...x, share, cum, rank: i + 1 };
    });
    const idx80 = rows.findIndex(r => r.cum >= 80);
    return { rows, grand, idx80: idx80 === -1 ? rows.length - 1 : idx80 };
  }, [habits, sixMonthTotalsByHabit]);

  // Navegação de meses (restrita até o mês atual)
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    if (newDate <= monthStart) setCurrentDate(newDate);
  };
  const canGoNext = () => {
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return nextMonth <= monthStart;
  };

  // Busca/filtra (apenas em "bar")
  const [query, setQuery] = useState('');
  const filteredMonth = useMemo(() => {
    if (!currentMonthData) return [] as { id: string; name: string; completions: number }[];
    const q = query.trim().toLowerCase();
    const base = [...sortedCurrentMonthHabits];
    if (!q) return base;
    return base.filter(h => h.name.toLowerCase().includes(q));
  }, [sortedCurrentMonthHabits, currentMonthData, query]);

  if (!ready || loading) {
    return (
      <View style={[S.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (err) {
    return (
      <View style={[S.screen, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <Text style={{ color: '#ef4444' }}>{err}</Text>
      </View>
    );
  }

  if (!habits.length) {
    return (
      <View style={[S.screen, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={S.emptyCard}
        >
          <Feather name="bar-chart-2" size={28} color={C.mutedText} />
          <Text style={{ marginTop: 8, color: C.mutedText, textAlign: 'center' }}>
            Adicione alguns hábitos para ver os gráficos de progresso.
          </Text>
        </MotiView>
      </View>
    );
  }

  return (
    <View style={S.screen}>
      <ScrollView contentContainerStyle={S.scroll}>
        {/* Cabeçalho / Segmento */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={S.headerCard}
        >
          <View style={S.headerRow}>
            <MotiText
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 80 }}
              style={S.title}
            >
              Gráficos de Progresso
            </MotiText>
          </View>

          <View style={S.segment}>
            <SegmentBtn icon={<Feather name="bar-chart-2" size={16} color={chartType === 'bar' ? C.primaryText : C.mutedText} />}
              active={chartType === 'bar'} onPress={() => setChartType('bar')} C={C} />
            <SegmentBtn icon={<Feather name="trending-up" size={16} color={chartType === 'trend' ? C.primaryText : C.mutedText} />}
              active={chartType === 'trend'} onPress={() => setChartType('trend')} C={C} />
            <SegmentBtn icon={<Ionicons name="pie-chart-outline" size={16} color={chartType === 'overview' ? C.primaryText : C.mutedText} />}
              active={chartType === 'overview'} onPress={() => setChartType('overview')} C={C} />
            <SegmentBtn icon={<Ionicons name="bulb-outline" size={16} color={chartType === 'insights' ? C.primaryText : C.mutedText} />}
              active={chartType === 'insights'} onPress={() => setChartType('insights')} C={C} />
          </View>

          {chartType === 'bar' && currentMonthData && (
            <View style={S.monthNav}>
              <Pressable onPress={handlePrevMonth} style={S.navBtn}>
                <MaterialIcons name="chevron-left" size={20} color={C.mutedText} />
              </Pressable>
              <Text style={S.monthLabel}>
                {currentMonthData.month} {currentMonthData.year}
              </Text>
              <Pressable
                onPress={handleNextMonth}
                disabled={!canGoNext()}
                style={[S.navBtn, !canGoNext() && { opacity: 0.4 }]}
              >
                <MaterialIcons name="chevron-right" size={20} color={C.mutedText} />
              </Pressable>
            </View>
          )}

          {/* busca local (apenas 'bar') */}
          {chartType === 'bar' && (
            <View style={S.searchWrap}>
              <Ionicons name="search" size={16} color={C.mutedText} />
              <TextInput
                placeholder="Pesquisar hábito do mês..."
                placeholderTextColor={C.mutedText}
                value={query}
                onChangeText={setQuery}
                style={S.searchInput}
              />
            </View>
          )}
        </MotiView>

        {/* ==== Conteúdo ==== */}
        {/* MÊS ATUAL */}
        {chartType === 'bar' && (
          <View style={S.card}>
            {!hasCompleted && (
              <Text style={{ color: C.mutedText, marginBottom: 8 }}>
                Para visualizar os gráficos do mês, precisamos de <Text style={{ fontWeight: 'bold' }}>completedDates</Text>.
              </Text>
            )}
            {filteredMonth.map((h, index) => (
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
                    transition={{ type: 'timing', duration: 600, delay: index * 90 }}
                    style={S.barFill}
                  />
                </View>
              </View>
            ))}
            {filteredMonth.length === 0 && (
              <Text style={{ color: C.mutedText, textAlign: 'center', paddingVertical: 16 }}>
                Nenhum dado de hábito para este mês.
              </Text>
            )}
          </View>
        )}

        {/* TENDÊNCIA 6 MESES */}
        {chartType === 'trend' && (
          <View style={S.card}>
            {!hasCompleted && (
              <Text style={{ color: C.mutedText, marginBottom: 8 }}>
                Tendência exige <Text style={{ fontWeight: 'bold' }}>completedDates</Text> nos últimos 6 meses.
              </Text>
            )}
            {habitsSortedBySixMonthTotal.map(h => {
              const line = monthlyData.map(m => {
                const item = m.habits.find(x => x.id === h.id);
                return { label: monthShort[m.monthIndex] ?? '', completions: item?.completions ?? 0 };
              });
              const maxVal = Math.max(...line.map(d => d.completions), 1);

              return (
                <View key={h.id} style={{ marginBottom: 20 }}>
                  <View style={S.rowBetween}>
                    <Text style={[S.habitName]} numberOfLines={1}>{h.name}</Text>
                    <Text style={{ color: C.mutedText }}>
                      Últimos 6 meses (total {sixMonthTotalsByHabit.get(h.id) ?? 0})
                    </Text>
                  </View>
                  <View style={S.trendRow}>
                    {line.map((p, idx) => (
                      <View key={idx} style={S.trendCol}>
                        <MotiView
                          from={{ height: 0 }}
                          animate={{ height: Math.max(0, (p.completions / maxVal) * 60) }}
                          transition={{ type: 'timing', duration: 600, delay: idx * 120 }}
                          style={S.trendBar}
                        />
                        <Text style={S.trendLabel}>{p.label}</Text>
                        <Text style={S.trendValue}>{p.completions}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* VISÃO GERAL */}
        {chartType === 'overview' && (
          <View style={S.card}>
            {!hasCompleted && (
              <Text style={{ color: C.mutedText, marginBottom: 8 }}>
                Visão geral usa <Text style={{ fontWeight: 'bold' }}>completedDates</Text> para totais mensais e rankings.
              </Text>
            )}

            {/* Totais por mês */}
            <View style={{ marginBottom: 18 }}>
              <Text style={S.sectionTitle}>Totais por mês</Text>
              <View style={S.monthTotalsRow}>
                {monthlyTotals.map((m, idx) => (
                  <View key={idx} style={S.monthTotalsCol}>
                    <MotiView
                      from={{ height: 0 }}
                      animate={{ height: Math.max(0, (m.total / (maxMonthlyTotal || 1)) * 80) }}
                      transition={{ type: 'timing', duration: 600, delay: idx * 110 }}
                      style={S.monthTotalsBar}
                    />
                    <Text style={S.trendLabel}>{m.label}</Text>
                    <Text style={S.trendValue}>{m.total}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Top e Bottom do mês atual */}
            <View style={S.grid2}>
              <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#eff6ff' : '#0b1220' }]}>
                <Text style={[S.blockTitle, { color: C.primary }]}>Top 3 — Mais concluídos (mês)</Text>
                {sortedCurrentMonthHabits.slice(0, 3).map((h, i) => (
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
                {sortedCurrentMonthHabits.slice(-3).reverse().map((h, i) => (
                  <View key={h.id} style={{ marginBottom: 10 }}>
                    <View style={S.rowBetween}>
                      <Text style={[S.habitName, { color: C.text }]} numberOfLines={1}>{i + 1}. {h.name}</Text>
                      <Text style={{ color: '#e11d48' }}>{h.completions}</Text>
                    </View>
                    <View style={[S.smallTrack, { backgroundColor: C.card }]}>
                      <View style={[S.smallFill, { width: `${(h.completions / (maxCompletions || 1)) * 100}%`, backgroundColor: '#e11d48' }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* INSIGHTS */}
        {chartType === 'insights' && (
          <View style={S.card}>
            {!hasCompleted && (
              <Text style={{ color: C.mutedText, marginBottom: 8 }}>
                Insights completos requerem <Text style={{ fontWeight: 'bold' }}>completedDates</Text>.
              </Text>
            )}

            {/* Heatmap 28 dias */}
            <View style={{ marginBottom: 18 }}>
              <View style={S.rowCenter}>
                <Ionicons name="calendar-outline" size={16} color={C.text} />
                <Text style={[S.sectionTitle, { marginLeft: 6 }]}>Últimos 28 dias (heatmap)</Text>
              </View>
              <View style={S.heatGrid}>
                {heatmapData.arr.map((d, idx) => {
                  const ratio = d.count / (heatmapData.max || 1);
                  const bg = ratio === 0 ? (C.background === '#FFFFFF' ? '#e5e7eb' : '#1f2937')
                    : ratio > 0.66 ? C.primary
                      : ratio > 0.33 ? shade(C.primary, scheme === 'dark' ? -0.2 : 0.2)
                        : shade(C.primary, scheme === 'dark' ? -0.4 : 0.4);
                  return <View key={idx} style={[S.heatCell, { backgroundColor: bg }]} />;
                })}
              </View>
            </View>

            {/* Distribuição por dia da semana */}
            <View style={{ marginBottom: 18 }}>
              <View style={S.rowCenter}>
                <Ionicons name="pulse-outline" size={16} color={C.text} />
                <Text style={[S.sectionTitle, { marginLeft: 6 }]}>Distribuição por dia da semana (6m)</Text>
              </View>
              <View style={S.weekRow}>
                {weekdayCounts.map((c, i) => (
                  <View key={i} style={S.weekCol}>
                    <View style={S.weekBarTrack}>
                      <MotiView
                        from={{ height: 0 }}
                        animate={{ height: Math.max(0, (c / (maxWeekday || 1)) * 80) }}
                        transition={{ type: 'timing', duration: 600, delay: i * 90 }}
                        style={[
                          S.weekBarFill,
                          i === bestWeekdayIndex
                            ? { backgroundColor: '#22c55e' }
                            : i === worstWeekdayIndex
                              ? { backgroundColor: '#f43f5e' }
                              : { backgroundColor: C.primary },
                        ]}
                      />
                    </View>
                    <Text style={S.weekLabel}>{weekdayLabels[i]}</Text>
                    <Text style={S.weekValue}>{c}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: C.mutedText, marginTop: 4 }}>
                Melhor dia: <Text style={{ fontWeight: '700', color: C.text }}>{weekdayLabels[bestWeekdayIndex]}</Text> •{' '}
                Pior dia: <Text style={{ fontWeight: '700', color: C.text }}>{weekdayLabels[worstWeekdayIndex]}</Text>
              </Text>
            </View>

            {/* Consistência 30 dias */}
            <View style={{ marginBottom: 18 }}>
              <View style={S.rowCenter}>
                <Ionicons name="speedometer-outline" size={16} color={C.text} />
                <Text style={[S.sectionTitle, { marginLeft: 6 }]}>Consistência (últimos 30 dias)</Text>
              </View>
              {consistency.map(h => (
                <View key={h.id} style={{ marginBottom: 10 }}>
                  <View style={S.rowBetween}>
                    <Text style={[S.habitName]} numberOfLines={1}>{h.name}</Text>
                    <Text style={{ color: C.mutedText }}>{h.done}/30 ({h.pct}%)</Text>
                  </View>
                  <View style={S.smallTrack}>
                    <MotiView
                      from={{ width: '0%' }}
                      animate={{ width: `${h.pct}%` }}
                      transition={{ type: 'timing', duration: 600 }}
                      style={[S.smallFill, { backgroundColor: '#22c55e' }]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Momentum */}
            <View style={S.grid2}>
              <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#ecfdf5' : '#0f1f19' }]}>
                <View style={S.rowCenter}>
                  <Feather name="trending-up" size={16} color="#15803d" />
                  <Text style={[S.blockTitle, { color: '#15803d', marginLeft: 6 }]}>Ganhando força</Text>
                </View>
                {momentum.gainers.length === 0 ? (
                  <Text style={{ color: '#15803d' }}>Sem ganhos no período.</Text>
                ) : (
                  momentum.gainers.map(g => (
                    <View key={g.id} style={S.rowBetween}>
                      <Text style={[S.habitName]} numberOfLines={1}>{g.name}</Text>
                      <Text style={{ color: '#15803d', fontWeight: '700' }}>+{g.delta}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#fff1f2' : '#1b0f12' }]}>
                <View style={S.rowCenter}>
                  <Ionicons name="alert-circle-outline" size={16} color="#be123c" />
                  <Text style={[S.blockTitle, { color: '#be123c', marginLeft: 6 }]}>Perdendo ritmo</Text>
                </View>
                {momentum.decliners.length === 0 ? (
                  <Text style={{ color: '#be123c' }}>Sem quedas no período.</Text>
                ) : (
                  momentum.decliners.map(d => (
                    <View key={d.id} style={S.rowBetween}>
                      <Text style={[S.habitName]} numberOfLines={1}>{d.name}</Text>
                      <Text style={{ color: '#be123c', fontWeight: '700' }}>{d.delta}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Pareto */}
            <View style={{ marginTop: 18 }}>
              <View style={S.rowCenter}>
                <Ionicons name="trophy-outline" size={16} color={C.text} />
                <Text style={[S.sectionTitle, { marginLeft: 6 }]}>Curva de Pareto (6 meses)</Text>
              </View>
              {pareto.rows.map(r => (
                <View key={r.id} style={{ marginBottom: 8 }}>
                  <View style={S.rowBetween}>
                    <Text style={[S.habitName]} numberOfLines={1}>{r.rank}. {r.name}</Text>
                    <Text style={{ color: C.mutedText }}>
                      {r.total} • {r.share.toFixed(1)}% • acum. {r.cum.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={S.smallTrack}>
                    <MotiView
                      from={{ width: '0%' }}
                      animate={{ width: `${r.cum}%` }}
                      transition={{ type: 'timing', duration: 600 }}
                      style={[S.smallFill, { backgroundColor: C.primary }]}
                    />
                  </View>
                </View>
              ))}
              {pareto.rows.length > 0 && (
                <Text style={{ color: C.mutedText, marginTop: 4 }}>
                  ~{Math.min(pareto.idx80 + 1, pareto.rows.length)} hábito(s) geram ~80% das conclusões.
                </Text>
              )}
            </View>

            {/* Em risco (14d) */}
            <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#fffbeb' : '#2b1e07', marginTop: 18 }]}>
              <View style={S.rowCenter}>
                <Ionicons name="alert" size={16} color="#b45309" />
                <Text style={[S.blockTitle, { color: '#b45309', marginLeft: 6 }]}>Hábitos em risco (14 dias)</Text>
              </View>
              {atRisk.length === 0 ? (
                <Text style={{ color: '#b45309' }}>Nenhum hábito inativo nas últimas 2 semanas. 🎉</Text>
              ) : (
                atRisk.map(h => (
                  <Text key={h.id} style={{ color: '#b45309' }} numberOfLines={1}>• {h.name}</Text>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ===== Helpers ===== */
function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// enriquece os hábitos com completedDates/createdAt, com N workers
async function enrichWithCalendars(base: Habit[], concurrency = 4): Promise<HabitExt[]> {
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
        // fallback seguro: sem datas
        out[i] = { ...h, completedDates: [], createdAt: undefined };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, base.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

function shade(hex: string, amt = 0.2) {
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

/* ===== UI Aux ===== */
function SegmentBtn({
  icon,
  active,
  onPress,
  C,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  C: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: active ? C.primary : C.card,
          borderWidth: 1,
          borderColor: active ? 'transparent' : C.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={{ minWidth: 28, alignItems: 'center' }}>{icon}</View>
    </Pressable>
  );
}

/* ===== Estilos ===== */
function styles(C: Palette) {
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
      marginTop: 20
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
    barFill: {
      height: '100%',
      backgroundColor: C.primary,
      borderRadius: 999,
    },

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
    trendBar: {
      width: 18,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      backgroundColor: C.primary,
    },
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
    monthTotalsBar: {
      width: 22,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      backgroundColor: C.primary,
    },

    grid2: { flexDirection: 'row', gap: 12, marginTop: 12 },
    block: {
      flex: 1,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
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
    weekBarFill: {
      width: '100%',
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
    },
    weekLabel: { marginTop: 4, color: C.mutedText, fontSize: 11 },
    weekValue: { color: C.text, fontSize: 11 },
  });
}
