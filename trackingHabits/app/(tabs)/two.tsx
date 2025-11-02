import Colors from '@/constants/Colors';
import { listHabits, getHabitCalendar, type Habit } from '@/services/habits.service';
import { Session } from '@/services/usersService';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, useColorScheme } from 'react-native';
import { MotiView } from 'moti';

// tipos/utilidades/estilos compartilhados
import {
  styles, type Palette, type ChartType, type HabitExt,
  enrichWithCalendars,
} from '@/components/habits/utils';

// cabeçalho (tabs + busca + navegação mês)
import { Header } from '@/components/habits/Header';

// seções
import { SectionMonthBar } from '@/components/habits/SectionMonthBar';
import { SectionTrendSix } from '@/components/habits/SectionTrendSix';
import { SectionOverview } from '@/components/habits/SectionOverview';
import { SectionInsights } from '@/components/habits/SectionInsights';
import { SectionCompareMonths } from '@/components/habits/SectionCompareMonths';

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
  const [query, setQuery] = useState('');

  // novo: mês de referência para comparação (por padrão, mês anterior)
  const [compareRefDate, setCompareRefDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  );

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
        const base = await listHabits({ userId, tab: 'all', orderBy: 'name' as any });
        const full = await enrichWithCalendars(base, getHabitCalendar, 4);
        setHabits(full);
      } catch (e: any) {
        setErr(e?.message || 'Falha ao carregar hábitos');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

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
        <Header
          C={C as Palette}
          chartType={chartType}
          onChangeChart={setChartType}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          query={query}
          setQuery={setQuery}
          showSearch={chartType === 'bar'}
          showMonthNav={chartType === 'bar'}
          // >>> novos props para comparar
          compareRefDate={compareRefDate}
          setCompareRefDate={setCompareRefDate}
        />

        {chartType === 'bar' && (
          <SectionMonthBar C={C as Palette} habits={habits} currentDate={currentDate} query={query} />
        )}

        {chartType === 'trend' && (
          <SectionTrendSix C={C as Palette} habits={habits} />
        )}

        {chartType === 'overview' && (
          <SectionOverview C={C as Palette} habits={habits} currentDate={currentDate} />
        )}

        {chartType === 'insights' && (
          <SectionInsights C={C as Palette} habits={habits} />
        )}

        {chartType === 'compare' && (
          <SectionCompareMonths
            C={C as Palette}
            habits={habits}
          />

        )}
      </ScrollView>
    </View>
  );
}
