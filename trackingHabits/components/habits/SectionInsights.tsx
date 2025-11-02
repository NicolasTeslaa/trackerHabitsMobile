import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MotiView } from 'moti';
import type { HabitExt, Palette } from './utils';
import { styles as makeStyles, toKey, shade } from './utils';

export function SectionInsights({ C, habits }: { C: Palette; habits: HabitExt[] }) {
  const S = makeStyles(C);
  const schemeDark = C.background !== '#FFFFFF';
  const today = new Date();
  const weekdayLabels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

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

  // momentum e pareto
  const momentum = useMemo(() => {
    const now = new Date(today.getFullYear(), today.getMonth(), 1);
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const list = habits.map(h => {
      const nowC = h.completedDates.filter(ds => ds.startsWith(nowKey)).length;
      const prevC = h.completedDates.filter(ds => ds.startsWith(prevKey)).length;
      return { id: h.id, name: h.name, delta: nowC - prevC, now: nowC, prev: prevC };
    });
    const gainers = [...list].sort((a, b) => b.delta - a.delta).slice(0, 3);
    const decliners = [...list].sort((a, b) => a.delta - b.delta).slice(0, 3);
    return { gainers, decliners };
  }, [habits]);

  const totals6 = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const rows = habits.map(h => {
      const total = months.reduce((s, mk) => s + h.completedDates.filter(d => d.startsWith(mk)).length, 0);
      return { id: h.id, name: h.name, total };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const grand = rows.reduce((s, x) => s + x.total, 0) || 1;
    let acc = 0;
    const withCum = rows.map((x, i) => {
      acc += x.total;
      const share = (x.total / grand) * 100;
      const cum = (acc / grand) * 100;
      return { ...x, share, cum, rank: i + 1 };
    });
    const idx80 = withCum.findIndex(r => r.cum >= 80);
    return { rows: withCum, idx80: idx80 === -1 ? withCum.length - 1 : idx80 };
  }, [habits]);

  const hasCompleted = habits.some(h => h.completedDates.length > 0);

  return (
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
              : ratio > 0.33 ? shade(C.primary, schemeDark ? -0.2 : 0.2)
              : shade(C.primary, schemeDark ? -0.4 : 0.4);
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
        {totals6.rows.map(r => (
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
        {totals6.rows.length > 0 && (
          <Text style={{ color: C.mutedText, marginTop: 4 }}>
            ~{Math.min(totals6.idx80 + 1, totals6.rows.length)} hábito(s) geram ~80% das conclusões.
          </Text>
        )}
      </View>

      {/* Em risco (14d) */}
      <View style={[S.block, { backgroundColor: C.background === '#FFFFFF' ? '#fffbeb' : '#2b1e07', marginTop: 18 }]}>
        <View style={S.rowCenter}>
          <Ionicons name="alert" size={16} color="#b45309" />
          <Text style={[S.blockTitle, { color: '#b45309', marginLeft: 6 }]}>Hábitos em risco (14 dias)</Text>
        </View>
        {habits.filter(h => {
          const start = new Date(); start.setDate(start.getDate() - 13);
          const s = toKey(start); const e = toKey(new Date());
          return !h.completedDates.some(ds => ds >= s && ds <= e);
        }).length === 0 ? (
          <Text style={{ color: '#b45309' }}>Nenhum hábito inativo nas últimas 2 semanas. 🎉</Text>
        ) : (
          habits.filter(h => {
            const start = new Date(); start.setDate(start.getDate() - 13);
            const s = toKey(start); const e = toKey(new Date());
            return !h.completedDates.some(ds => ds >= s && ds <= e);
          }).map(h => <Text key={h.id} style={{ color: '#b45309' }} numberOfLines={1}>• {h.name}</Text>)
        )}
      </View>
    </View>
  );
}
