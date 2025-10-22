import Colors from '@/constants/Colors';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, View as RNView, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

type Habit = {
  id: string;
  name: string;
  monthCount: number;
  streak: number;
  total: number;
  monthProgressPct: number; // 0..1
  lastDate: string;
  dueToday: boolean;
};

export default function TabOneScreen() {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const styles = createStyles(C, scheme);

  // estado básico de filtro/ordenar e dados mock
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'today' | 'done'>('all');
  const [order, setOrder] = useState<'streak' | 'name' | 'month'>('streak');

  const [habits, setHabits] = useState<Habit[]>([
    {
      id: '1',
      name: 'Academia',
      monthCount: 7,
      streak: 0,
      total: 45,
      monthProgressPct: 0.23,
      lastDate: '13/10/2025',
      dueToday: true,
    },
  ]);

  const kpis = useMemo(() => {
    const ativos = habits.length;
    const hoje = habits.filter(h => h.dueToday).length;
    const noMes = habits.reduce((acc, h) => acc + h.monthCount, 0);
    const taxa30d = 0.16; // mock
    return { noMes, hoje, ativos, taxa30d };
  }, [habits]);

  const filtered = useMemo(() => {
    let arr = habits.filter(h =>
      h.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    if (tab === 'today') arr = arr.filter(h => h.dueToday);
    if (tab === 'done') arr = []; // regra real de "concluídos hoje" entra aqui
    if (order === 'streak') arr = [...arr].sort((a, b) => b.streak - a.streak);
    if (order === 'name') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    if (order === 'month') arr = [...arr].sort((a, b) => b.monthCount - a.monthCount);
    return arr;
  }, [habits, query, tab, order]);

  const onCreateHabit = () => {
    const n = habits.length + 1;
    setHabits(prev => [
      ...prev,
      {
        id: String(n),
        name: `Hábito ${n}`,
        monthCount: 0,
        streak: 0,
        total: 0,
        monthProgressPct: 0,
        lastDate: '-',
        dueToday: true,
      },
    ]);
  };

  const onCompleteToday = (id: string) => {
    setHabits(prev =>
      prev.map(h =>
        h.id === id
          ? {
              ...h,
              monthCount: h.monthCount + 1,
              total: h.total + 1,
              streak: h.streak + 1,
              monthProgressPct: Math.min(1, h.monthProgressPct + 0.05),
              lastDate: new Date().toLocaleDateString('pt-BR'),
              dueToday: false,
            }
          : h,
      ),
    );
  };

  const onEdit = (id: string) => {
    console.log('Editar', id);
  };

  const onDelete = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Seus hábitos</Text>
              <Text style={styles.subtitle}>Foco no que importa hoje</Text>
            </View>
          </View>

          {/* KPIs */}
          <RNView style={styles.kpiRow}>
            <Kpi value={kpis.noMes.toString()} label="Este mês" C={C} />
            <Kpi value={kpis.hoje.toString()} label="Hoje" tone="green" C={C} />
            <Kpi value={kpis.ativos.toString()} label="Ativos" tone="lilac" C={C} />
            <Kpi value={`${Math.round(kpis.taxa30d * 100)}%`} label="Taxa (30d)" tone="warn" C={C} />
          </RNView>

          {/* busca */}
          <RNView style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={C.mutedText} />
            <TextInput
              placeholder="Pesquisar por nome..."
              placeholderTextColor={C.mutedText}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
          </RNView>

          {/* chips */}
          <RNView style={styles.chipsRow}>
            <Chip text="Todos" active={tab === 'all'} onPress={() => setTab('all')} C={C} />
            <Chip text="Para hoje" active={tab === 'today'} onPress={() => setTab('today')} C={C} />
            <Chip text="Concluídos hoje" active={tab === 'done'} onPress={() => setTab('done')} C={C} />
          </RNView>

          {/* ordenar */}
          <Pressable
            style={styles.orderSelect}
            onPress={() => {
              const next: Record<typeof order, typeof order> = { streak: 'name', name: 'month', month: 'streak' };
              setOrder(next[order]);
            }}
          >
            <Text style={styles.orderText}>
              Ordenar por: {order === 'streak' ? 'Sequência' : order === 'name' ? 'Nome' : 'Mês'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={C.mutedText} />
          </Pressable>
        </View>

        {/* Lista de hábitos */}
        {filtered.map(h => (
          <HabitCard
            key={h.id}
            habit={h}
            onComplete={() => onCompleteToday(h.id)}
            onEdit={() => onEdit(h.id)}
            onDelete={() => onDelete(h.id)}
            C={C}
            scheme={scheme}
            styles={styles}
          />
        ))}

        {/* espaçamento para não cobrir pelo FAB */}
        <RNView style={{ height: 80 }} />
      </ScrollView>

      {/* FAB: Novo hábito */}
      <Pressable style={styles.fab} onPress={onCreateHabit}>
        <Ionicons name="add" size={26} color={C.primaryText} />
        <Text style={styles.fabText}>Novo hábito</Text>
      </Pressable>
    </View>
  );
}

/* ---------- componentes auxiliares ---------- */

function Kpi({
  value,
  label,
  tone,
  C,
}: {
  value: string;
  label: string;
  tone?: 'green' | 'warn' | 'lilac';
  C: typeof Colors.light;
}) {
  const bg =
    tone === 'green'
      ? (C.background === '#FFFFFF' ? '#ecfdf5' : '#0f1f19') // verde suave claro/escuro
      : tone === 'warn'
      ? (C.background === '#FFFFFF' ? '#fffbeb' : '#2b1e07')
      : tone === 'lilac'
      ? (C.background === '#FFFFFF' ? '#f5f3ff' : '#191827')
      : C.chipBg;

  return (
    <RNView style={[{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', flex: 1, backgroundColor: bg }]}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{value}</Text>
      <Text style={{ marginTop: 4, color: C.mutedText, fontSize: 12 }}>{label}</Text>
    </RNView>
  );
}

function Chip({
  text,
  active,
  onPress,
  C,
}: {
  text: string;
  active?: boolean;
  onPress?: () => void;
  C: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: C.chipBg,
        },
        active && { backgroundColor: C.primary },
      ]}
    >
      <Text style={[{ fontWeight: '600', color: C.text }, active && { color: C.primaryText }]}>{text}</Text>
    </Pressable>
  );
}

function HabitCard({
  habit,
  onComplete,
  onEdit,
  onDelete,
  C,
  scheme,
  styles,
}: {
  habit: Habit;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  C: typeof Colors.light;
  scheme: 'light' | 'dark' | null | undefined;
  styles: ReturnType<typeof createStyles>;
}) {
  const pct = Math.max(0, Math.min(1, habit.monthProgressPct));
  const dueBg = scheme === 'dark' ? '#2b1e07' : '#fff7ed';
  const dueBorder = scheme === 'dark' ? '#634c1a' : '#fed7aa';

  return (
    <View style={styles.habitCard}>
      <RNView style={styles.habitHeader}>
        <Text style={styles.habitTitle}>{habit.name}</Text>

        {habit.dueToday && (
          <RNView style={[styles.dueTodayBadge, { backgroundColor: dueBg, borderColor: dueBorder }]}>
            <Ionicons name="time-outline" size={14} color={C.warn} />
            <Text style={[styles.dueTodayText, { color: C.warn }]}>fazer hoje</Text>
          </RNView>
        )}
      </RNView>

      {/* métricas */}
      <RNView style={styles.habitMetrics}>
        <Metric value={habit.monthCount} label="no mês" C={C} />
        <Metric value={habit.streak} label="sequência" icon="flame" C={C} />
        <Metric value={habit.total} label="total" C={C} />
      </RNView>

      {/* progresso */}
      <RNView style={styles.progressWrap}>
        <RNView style={[styles.progressBar, { width: `${pct * 100}%` }]} />
      </RNView>
      <Text style={styles.progressInfo}>
        Progresso no mês: {Math.round(pct * 100)}% · última: {habit.lastDate}
      </Text>

      {/* ações */}
      <RNView style={styles.actionsRow}>
        <Pressable style={styles.primaryBtn} onPress={onComplete}>
          <Ionicons name="checkmark-circle" size={18} color={C.primaryText} />
          <Text style={styles.primaryBtnText}>Concluir hoje</Text>
        </Pressable>

        <Pressable style={styles.ghostBtn}>
          <Ionicons name="calendar-outline" size={18} color={C.mutedText} />
          <Text style={styles.ghostBtnText}>Calendário</Text>
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={onEdit}>
          <Feather name="edit-2" size={18} color={C.mutedText} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onDelete}>
          <Feather name="trash-2" size={18} color="#ef4444" />
        </Pressable>
      </RNView>
    </View>
  );
}

function Metric({ value, label, icon, C }: { value: number; label: string; icon?: 'flame'; C: typeof Colors.light }) {
  return (
    <RNView style={{ flex: 1, backgroundColor: C.card, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{value}</Text>
      <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon === 'flame' && <Ionicons name="flame-outline" size={14} color={C.lilac} />}
        <Text style={{ color: C.mutedText, fontSize: 12 }}>{label}</Text>
      </RNView>
    </RNView>
  );
}

/* ---------- estilos ---------- */

function createStyles(C: typeof Colors.light, scheme: 'light' | 'dark' | null | undefined) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },
    scroll: { padding: 16, paddingBottom: 0 },

    headerCard: {
      backgroundColor: C.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 14,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 20, fontWeight: '700', color: C.text },
    subtitle: { color: C.mutedText, marginTop: 2 },

    analysisBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: C.successBg,
    },
    analysisText: { color: C.primary, fontWeight: '600', fontSize: 12 },

    kpiRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 12 },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      backgroundColor: C.background,
      marginBottom: 10,
    },
    searchInput: { flex: 1, color: C.text },

    chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },

    orderSelect: {
      height: 44,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    orderText: { color: C.mutedText, fontWeight: '600' },

    habitCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.background,
      padding: 14,
      marginBottom: 14,
    },
    habitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    habitTitle: { fontSize: 18, fontWeight: '700', color: C.text },

    dueTodayBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderRadius: 999,
    },
    dueTodayText: { fontWeight: '700', fontSize: 12 },

    habitMetrics: { flexDirection: 'row', gap: 10, marginTop: 10 },

    progressWrap: {
      marginTop: 12,
      height: 8,
      borderRadius: 999,
      backgroundColor: C.chipBg,
      overflow: 'hidden',
    },
    progressBar: { height: '100%', backgroundColor: C.primary },
    progressInfo: { marginTop: 6, color: C.mutedText, fontSize: 12 },

    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

    primaryBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: { color: C.primaryText, fontWeight: '700' },

    ghostBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.background,
    },
    ghostBtnText: { color: C.mutedText, fontWeight: '700' },

    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.background,
    },

    fab: {
      position: 'absolute',
      right: 16,
      bottom: 20,
      backgroundColor: C.primary,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      height: 50,
      elevation: 4,
    },
    fabText: { color: C.primaryText, fontWeight: '800' },
  });
}
