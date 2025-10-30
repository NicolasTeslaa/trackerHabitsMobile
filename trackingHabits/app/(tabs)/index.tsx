import Colors from '@/constants/Colors';
import { deleteHabit, listHabits, toggleToday, type Habit } from '@/services/habits.service';
import { Session } from '@/services/usersService';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import EditHabitModal from '../screen/EditHabitModal';
import NewHabitModal from '../screen/NewHabitModal';

export default function TabOneScreen() {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const styles = createStyles(C);

  // sessão/usuário
  const [ready, setReady] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // filtros
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'today' | 'done'>('all');
  const [order, setOrder] = useState<'streak' | 'name' | 'month'>('streak');

  // dados
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // adicionar habito
  const [showNewHabit, setShowNewHabit] = useState(false);

  // editar hábito
  const [editHabit, setEditHabit] = useState<Habit | null>(null);


  // boot: carrega sessão do storage
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { me } = await Session.load(); // lê @me e token
        if (!alive) return;
        setIsLogged(!!me);
        setUserId(me?.id ?? null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // carregar lista quando filtros mudarem e houver userId válido
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) return;
      setLoading(true);
      setErr(null);
      try {
        const data = await listHabits({ userId, tab, orderBy: order });
        if (alive) setHabits(data);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Falha ao carregar hábitos');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, tab, order]);

  const kpis = useMemo(() => {
    const ativos = habits.length;
    const hoje = habits.filter(h => h.dueToday === true).length;
    const noMes = habits.reduce((acc, h) => acc + h.monthCount, 0);
    const taxa30d = 0.16; // placeholder local
    return { noMes, hoje, ativos, taxa30d };
  }, [habits]);

  const filtered = useMemo(() => {
    const today = todayStr();
    let arr = habits.filter(h =>
      h.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    if (tab === 'today') arr = arr.filter(h => h.dueToday);
    if (tab === 'done') arr = arr.filter(h => !h.dueToday && h.lastDate === today);
    if (order === 'streak') arr = [...arr].sort((a, b) => b.streak - a.streak);
    if (order === 'name') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
    if (order === 'month') arr = [...arr].sort((a, b) => b.monthCount - a.monthCount);
    return arr;
  }, [habits, query, tab, order]);

  // handlers
  const reload = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await listHabits({ userId, tab, orderBy: order });
      setHabits(data);
    } catch (e: any) {
      setErr(e?.message || 'Falha ao recarregar hábitos');
    } finally {
      setLoading(false);
    }
  };

  const onToggleToday = async (id: string) => {
    try {
      await toggleToday(id);
      await reload();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível atualizar o hábito.');
    }
  };

  const onEdit = (habit: Habit) => {
    setEditHabit(habit);
  };

  const onDelete = async (habit: Habit) => {
    try {
      // Primeira confirmação
      Alert.alert(
        "Excluir hábito",
        `Tem certeza que deseja excluir o hábito "${habit.name}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sim, excluir",
            style: "destructive",
            onPress: async () => {
              // Se o hábito tiver dias concluídos, segunda confirmação
              if (habit.total > 0 || habit.monthCount > 0 || habit.streak > 0) {
                Alert.alert(
                  "Atenção",
                  `O hábito "${habit.name}" possui dias concluídos. Essa ação apagará permanentemente o histórico. Deseja continuar mesmo assim?`,
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Excluir definitivamente",
                      style: "destructive",
                      onPress: async () => {
                        await deleteHabit(habit.id);
                        await reload();
                      },
                    },
                  ]
                );
              } else {
                // Se não tiver histórico, exclui direto
                await deleteHabit(habit.id);
                await reload();
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível apagar o hábito.");
    }
  };

  // Loading inicial enquanto checa sessão
  if (!ready) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  // Sem sessão → manda pro login
  if (ready && !isLogged) {
    return <Redirect href="/login" />;
  }

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

        {/* Loading / erro */}
        {loading && (
          <RNView style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator />
          </RNView>
        )}
        {!!err && !loading && (
          <RNView style={{ paddingVertical: 8 }}>
            <Text style={{ color: '#ef4444' }}>{err}</Text>
          </RNView>
        )}

        {/* Lista de hábitos */}
        {!loading &&
          filtered.map(h => (
            <HabitCard
              key={h.id}
              habit={h}
              onToggle={() => onToggleToday(h.id)}
              onEdit={() => onEdit(h)}
              onDelete={() => onDelete(h)}
              C={C}
              styles={styles}
            />
          ))}

        {/* espaçamento para não cobrir pelo FAB */}
        <RNView style={{ height: 80 }} />
      </ScrollView>

      {/* FAB: Novo hábito */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          if (!userId) {
            Alert.alert("Sessão", "Você não está logado.");
            return;
          }
          setShowNewHabit(true);
        }}
      >
        <Ionicons name="add" size={26} color={C.primaryText} />
        <Text style={styles.fabText}>Novo hábito</Text>
      </Pressable>

      {userId && (
        <NewHabitModal
          visible={showNewHabit}
          onClose={() => setShowNewHabit(false)}
          userId={userId}
          onCreated={reload} // recarrega a lista depois de salvar
        />
      )}

      <EditHabitModal
        visible={!!editHabit}
        onClose={() => setEditHabit(null)}
        habit={editHabit}
        onUpdated={reload}
      />
    </View>
  );
}

/* ---------- helpers ---------- */

function todayStr() {
  return new Date().toLocaleDateString('pt-BR'); // ex.: 22/10/2025
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
      ? (C.background === '#FFFFFF' ? '#ecfdf5' : '#0f1f19')
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
  onToggle,
  onEdit,
  onDelete,
  C,
  styles,
}: {
  habit: Habit;
  onToggle: () => void;
  onEdit: (h: Habit) => void;
  onDelete: (h: Habit) => void;
  C: typeof Colors.light;
  styles: ReturnType<typeof createStyles>;
}) {
  const pct = Math.max(0, Math.min(1, habit.monthProgressPct));
  const isDoneToday = !habit.dueToday && habit.lastDate === todayStr();

  return (
    <View style={styles.habitCard}>
      <RNView style={styles.habitHeader}>
        <Text style={styles.habitTitle}>{habit.name}</Text>

        {habit.dueToday && (
          <RNView style={styles.dueTodayBadge}>
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
        <Pressable
          style={[styles.primaryBtn, isDoneToday && { backgroundColor: C.good }]}
          onPress={onToggle}
        >
          <Text style={styles.primaryBtnText}>{isDoneToday ? 'Desfazer hoje' : 'Concluir hoje'}</Text>
        </Pressable>

        <Pressable style={styles.ghostBtn} onPress={() => router.push({
          pathname: "/habit/[id]/calendar",
          params: { id: habit.id, name: habit.name },
        })}>
          <Ionicons name="calendar-outline" size={18} color={C.mutedText} />
          <Text style={styles.ghostBtnText}>Calendário</Text>
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={() => onEdit(habit)}>
          <Feather name="edit-2" size={18} color={C.mutedText} />
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={() => onDelete(habit)}>
          <Feather name="trash-2" size={18} color="#ef4444" />
        </Pressable>

      </RNView>
    </View>

  );
}

function Metric({
  value,
  label,
  icon,
  C,
}: {
  value: number;
  label: string;
  icon?: 'flame';
  C: typeof Colors.light;
}) {
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

function createStyles(C: typeof Colors.light) {
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
      backgroundColor: C.background === '#FFFFFF' ? '#fff7ed' : '#2b1e07',
      borderWidth: 1,
      borderColor: C.background === '#FFFFFF' ? '#fed7aa' : '#634c1a',
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
    primaryBtnText: { color: C.primaryText, fontWeight: '700', fontSize: 14 },

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
