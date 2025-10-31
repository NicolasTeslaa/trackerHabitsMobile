import Colors from '@/constants/Colors';
import { deleteHabit, listHabits, toggleToday, type Habit } from '@/services/habits.service';
import { Session } from '@/services/usersService';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// animações moti
import { AnimatePresence, MotiText, MotiView } from 'moti';

// reanimated (wrapper universal de escala + chips)
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// gesture handler (swipe)
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

// haptics (opcional, micro feedback)
import * as Haptics from 'expo-haptics';

// ==== modais ====
import EditHabitModal from '../screen/EditHabitModal';
import NewHabitModal from '../screen/NewHabitModal';

/** Wrapper de Pressable com animação de escala (compatível com qualquer versão) */
function ScalePressable({
  onPress,
  children,
  activeScale = 0.96,
  duration = 120,
  disabled,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  activeScale?: number;
  duration?: number;
  disabled?: boolean;
}) {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }), []);
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => (s.value = withTiming(activeScale, { duration }))}
      onPressOut={() => (s.value = withTiming(1, { duration }))}
      onPress={onPress}
    >
      <Animated.View style={style}>{children}</Animated.View>
    </Pressable>
  );
}

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

  // modais
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);

  // boot: carrega sessão do storage
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { me } = await Session.load();
        if (!alive) return;
        setIsLogged(!!me);
        setUserId(me?.id ?? null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // carregar lista quando filtros mudarem
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const data = await listHabits({ userId, tab, orderBy: order });
        setHabits(data);
      } catch (e: any) {
        setErr(e?.message || 'Falha ao carregar hábitos');
      } finally {
        setLoading(false);
      }
    })();
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

  // Toggle só atualiza o item (usa retorno do service)
  const onToggleToday = async (id: string) => {
    try {
      const updated = await toggleToday(id); // Habit | undefined
      if (!updated) return;
      setHabits(prev => prev.map(h => (h.id === id ? updated : h)));
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível atualizar o hábito.');
    }
  };

  const onEdit = (habit: Habit) => setEditHabit(habit);

  // Excluir atualiza estado local; sem reload global (com saída animada)
  const onDelete = async (habit: Habit) => {
    try {
      Alert.alert('Excluir hábito', `Tem certeza que deseja excluir o hábito "${habit.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, excluir',
          style: 'destructive',
          onPress: async () => {
            const confirmAndRemove = async () => {
              await deleteHabit(habit.id);
              setHabits(prev => prev.filter(h => h.id !== habit.id));
            };

            if (habit.total > 0 || habit.monthCount > 0 || habit.streak > 0) {
              Alert.alert(
                'Atenção',
                `O hábito "${habit.name}" possui dias concluídos. Essa ação apagará permanentemente o histórico. Deseja continuar mesmo assim?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir definitivamente', style: 'destructive', onPress: confirmAndRemove },
                ],
              );
            } else {
              await confirmAndRemove();
            }
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível apagar o hábito.');
    }
  };

  // callbacks dos modais (evitam refetch)
  const handleHabitCreated = (newHabit: Habit) => {
    setHabits(prev => [newHabit, ...prev]);
  };

  if (!ready) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (ready && !isLogged) return <Redirect href="/login" />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header com fade/slide */}
          <MotiView
            from={{ opacity: 0, translateY: -12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 420 }}
            style={styles.headerCard}
          >
            <View style={styles.headerRow}>
              <View>
                <MotiText
                  from={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 80 }}
                  style={styles.title}
                >
                  Seus hábitos
                </MotiText>
                <MotiText
                  from={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 140 }}
                  style={styles.subtitle}
                >
                  Foco no que importa hoje
                </MotiText>
              </View>
            </View>

            {/* KPIs com stagger */}
            <RNView style={styles.kpiRow}>
              {[
                { v: kpis.noMes.toString(), l: 'Este mês' },
                { v: kpis.hoje.toString(), l: 'Hoje', t: 'green' as const },
                { v: kpis.ativos.toString(), l: 'Ativos', t: 'lilac' as const },
                { v: `${Math.round(kpis.taxa30d * 100)}%`, l: 'Taxa (30d)', t: 'warn' as const },
              ].map((k, i) => (
                <MotiView
                  key={k.l}
                  from={{ opacity: 0, translateY: 12, scale: 0.98 }}
                  animate={{ opacity: 1, translateY: 0, scale: 1 }}
                  transition={{ delay: 100 + i * 60, damping: 14 }}
                  style={{ flex: 1 }}
                >
                  <Kpi value={k.v} label={k.l} tone={k.t} C={C} />
                </MotiView>
              ))}
            </RNView>

            {/* busca */}
            <MotiView
              from={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 220, delay: 120 }}
              style={styles.searchWrap}
            >
              <Ionicons name="search" size={18} color={C.mutedText} />
              <TextInput
                placeholder="Pesquisar por nome..."
                placeholderTextColor={C.mutedText}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </MotiView>

            {/* chips */}
            <RNView style={styles.chipsRow}>
              <AnimatedChip text="Todos" active={tab === 'all'} onPress={() => setTab('all')} C={C} />
              <AnimatedChip text="Para hoje" active={tab === 'today'} onPress={() => setTab('today')} C={C} />
              <AnimatedChip text="Concluídos hoje" active={tab === 'done'} onPress={() => setTab('done')} C={C} />
            </RNView>

            {/* ordenar */}
            <ScalePressable
              onPress={() => {
                const next: Record<typeof order, typeof order> = { streak: 'name', name: 'month', month: 'streak' };
                setOrder(next[order]);
              }}
              activeScale={0.98}
            >
              <View style={styles.orderSelect}>
                <Text style={styles.orderText}>
                  Ordenar por: {order === 'streak' ? 'Sequência' : order === 'name' ? 'Nome' : 'Mês'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={C.mutedText} />
              </View>
            </ScalePressable>
          </MotiView>

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

          {/* Lista com AnimatePresence (enter/exit) */}
          <AnimatePresence>
            {!loading &&
              filtered.map((h, idx) => (
                <MotiView
                  key={h.id}
                  from={{ opacity: 0, translateY: 12 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: -12 }}
                  transition={{ delay: 40 + idx * 24 }}
                >
                  <HabitCard
                    habit={h}
                    onToggle={() => onToggleToday(h.id)}
                    onEdit={() => onEdit(h)}
                    onDelete={() => onDelete(h)}
                    C={C}
                    styles={styles}
                  />
                </MotiView>
              ))}
          </AnimatePresence>

          <RNView style={{ height: 80 }} />
        </ScrollView>

        {/* FAB */}
        <ScalePressable
          onPress={() => {
            if (!userId) {
              Alert.alert('Sessão', 'Você não está logado.');
              return;
            }
            setShowNewHabit(true);
          }}
          activeScale={0.94}
        >
          <MotiView
            from={{ scale: 1, opacity: 0.95 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ loop: true, type: 'timing', duration: 1400 }}
            style={styles.fab}
          >
            <Ionicons name="add" size={26} color={C.primaryText} />
            <Text style={styles.fabText}>Novo hábito</Text>
          </MotiView>
        </ScalePressable>

        {userId && (
          <NewHabitModal
            visible={showNewHabit}
            onClose={() => setShowNewHabit(false)}
            userId={userId}
            onCreated={handleHabitCreated}
          />
        )}

        <EditHabitModal
          visible={!!editHabit}
          onClose={() => setEditHabit(null)}
          habit={editHabit}
          onUpdated={updated => {
            setHabits(prev => prev.map(h => (h.id === updated.id ? updated : h)));
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}

/* ---------- helpers ---------- */

function todayStr() {
  return new Date().toLocaleDateString('pt-BR'); // ex.: 22/10/2025
}

/* ---------- componentes auxiliares ---------- */

type Palette = typeof Colors.light;

function Kpi({
  value,
  label,
  tone,
  C,
}: {
  value: string;
  label: string;
  tone?: 'green' | 'warn' | 'lilac';
  C: Palette;
}) {
  const bg =
    tone === 'green'
      ? C.background === '#FFFFFF'
        ? '#ecfdf5'
        : '#0f1f19'
      : tone === 'warn'
        ? C.background === '#FFFFFF'
          ? '#fffbeb'
          : '#2b1e07'
        : tone === 'lilac'
          ? C.background === '#FFFFFF'
            ? '#f5f3ff'
            : '#191827'
          : C.chipBg;

  return (
    <MotiView
      from={{ scale: 0.98 }}
      animate={{ scale: 1 }}
      transition={{ type: 'timing', duration: 220 }}
      style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', flex: 1, backgroundColor: bg }}
    >
      <MotiText from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} style={{ fontSize: 20, fontWeight: '800', color: C.text }}>
        {value}
      </MotiText>
      <MotiText from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 90 }} style={{ marginTop: 4, color: C.mutedText, fontSize: 12 }}>
        {label}
      </MotiText>
    </MotiView>
  );
}

function AnimatedChip({
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
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withTiming(0.95, { duration: 100 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 100 }))}
      onPress={onPress}
    >
      <Animated.View style={aStyle}>
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 180 }}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: active ? C.primary : C.chipBg,
          }}
        >
          <MotiText style={{ fontWeight: '600', color: active ? C.primaryText : C.text }}>
            {text}
          </MotiText>
        </MotiView>
      </Animated.View>
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
  C: Palette;
  styles: ReturnType<typeof createStyles>;
}) {
  const pct = Math.max(0, Math.min(1, habit.monthProgressPct));
  const isDoneToday = !habit.dueToday && habit.lastDate === todayStr();

  // swipe control
  const swipeRef = useRef<Swipeable>(null);
  const closeSwipe = () => swipeRef.current?.close();
  
  const LeftAction = () => (
    <RNView style={swipeStyles.actionsWrap}>
      <ScalePressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
          closeSwipe();
          onEdit(habit);
        }}
      >
        <RNView style={[swipeStyles.actionBtn, { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 }]}>
          <Feather name="edit-2" size={18} color={C.mutedText} />
          <Text style={[swipeStyles.actionText, { color: C.text }]}>Editar</Text>
        </RNView>
      </ScalePressable>
    </RNView>
  );

  const RightActions = () => (
    <RNView style={swipeStyles.actionsWrap}>
      <ScalePressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
          closeSwipe();
          onDelete(habit);
        }}
      >
        <RNView style={[swipeStyles.actionBtn, { backgroundColor: '#2b0d0d', borderColor: '#7f1d1d', borderWidth: 1 }]}>
          <Feather name="trash-2" size={18} color="#ef4444" />
          <Text style={[swipeStyles.actionText, { color: '#fca5a5' }]}>Excluir</Text>
        </RNView>
      </ScalePressable>
    </RNView>
  );

  return (
    <Swipeable
      renderRightActions={RightActions}
      renderLeftActions={LeftAction}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}              // <- essencialmente “nunca abre”
    // onSwipeableLeftOpen={() => closeSwipe()} // <- safety: auto-fecha se abrir
    >
      <MotiView
        from={{ opacity: 0.9, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: 'timing', duration: 240 }}
        style={styles.habitCard}
      >
        <RNView style={styles.habitHeader}>
          <MotiText from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} style={styles.habitTitle}>
            {habit.name}
          </MotiText>

          {habit.dueToday && (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 200 }}
              style={styles.dueTodayBadge}
            >
              <Ionicons name="time-outline" size={14} color={C.warn} />
              <Text style={[styles.dueTodayText, { color: C.warn }]}>fazer hoje</Text>
            </MotiView>
          )}
        </RNView>

        {/* métricas */}
        <RNView style={styles.habitMetrics}>
          <Metric value={habit.monthCount} label="no mês" C={C} />
          <Metric value={habit.streak} label="sequência" icon="flame" C={C} />
          <Metric value={habit.total} label="total" C={C} />
        </RNView>

        {/* progresso animado */}
        <RNView style={styles.progressWrap}>
          <MotiView
            from={{ width: '0%' }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: 'timing', duration: 500 }}
            style={[styles.progressBar]}
          />
        </RNView>
        <Text style={styles.progressInfo}>Progresso no mês: {Math.round(pct * 100)}% · última: {habit.lastDate}</Text>

        {/* ações principais (sem editar/excluir aqui) */}
        <RNView style={styles.actionsRow}>
          <ScalePressable onPress={onToggle} activeScale={0.96}>
            <MotiView
              from={{ opacity: 0.9, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 160 }}
              style={[styles.primaryBtn, isDoneToday && { backgroundColor: C.good }]}
            >
              <MotiText from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.primaryBtnText}>
                {isDoneToday ? 'Desfazer hoje' : 'Concluir hoje'}
              </MotiText>
            </MotiView>
          </ScalePressable>

          <ScalePressable
            onPress={() =>
              router.push({
                pathname: '/habit/[id]/calendar',
                params: { id: habit.id, name: habit.name },
              })
            }
            activeScale={0.96}
          >
            <MotiView from={{ opacity: 0.9, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} style={styles.ghostBtn}>
              <Ionicons name="calendar-outline" size={18} color={C.mutedText} />
              <Text style={styles.ghostBtnText}>Calendário</Text>
            </MotiView>
          </ScalePressable>
        </RNView>
      </MotiView>
    </Swipeable>
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
  C: Palette;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      style={{ flex: 1, backgroundColor: C.card, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
    >
      <MotiText style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{value}</MotiText>
      <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon === 'flame' && <Ionicons name="flame-outline" size={14} color={C.lilac} />}
        <Text style={{ color: C.mutedText, fontSize: 12 }}>{label}</Text>
      </RNView>
    </MotiView>
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

    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },

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
    primaryBtnText: { color: C.primaryText, fontWeight: '700', fontSize: 14, width: 120, textAlign: 'center' },

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
      width: 120
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

/* estilos das ações de swipe */
const swipeStyles = StyleSheet.create({
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  actionBtn: {
    width: 96,
    height: '90%',
    borderRadius: 12,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { fontWeight: '700', fontSize: 12 },

  leftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  leftBtn: {
    width: 140,
    height: '90%',
    borderRadius: 12,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  leftText: { fontWeight: '800', fontSize: 12 },
});
