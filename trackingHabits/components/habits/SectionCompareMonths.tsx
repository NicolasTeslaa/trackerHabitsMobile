import React, { useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler'; // <<< swipe

// ===== Tipos =====
export type HabitExt = {
  id: string;
  name: string;
  completedDates: string[]; // 'yyyy-MM-dd'
  createdAt?: string;
};

type Row = { id: string; name: string; m1: number; m2: number; diff: number };

type PaletteLike = {
  background: string; text: string; mutedText: string;
  primary: string; primaryText: string;
  border: string; card: string;
};

// ===== Helpers =====
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const sameYM   = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth();
const label    = (d: Date) => `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
const firstDay = (y: number, m: number) => new Date(y, m, 1);
const pctChange = (oldV: number, newV: number) => {
  if (oldV === 0 && newV === 0) return 0;
  if (oldV === 0) return 100;
  return Math.round(((newV - oldV) / oldV) * 100);
};

// ===== Picker simples de mês/ano =====
function MonthPickerModal({
  visible, onClose, value, onChange, C,
}: {
  visible: boolean; onClose: () => void; value: Date; onChange: (d: Date)=>void; C: PaletteLike;
}) {
  const [year, setYear] = useState<number>(value.getFullYear());
  React.useEffect(()=>{ if(visible) setYear(value.getFullYear()); }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={S.modalBackdrop}>
        <View style={[S.modalCard, { backgroundColor: C.background, borderColor: C.border }]}>
          <View style={S.modalHeader}>
            <Pressable onPress={()=>setYear(y=>y-1)} style={[S.iconBtn, { borderColor: C.border, backgroundColor: C.card }]}>
              <Feather name="chevron-left" size={16} color={C.text}/>
            </Pressable>
            <Text style={[S.yearTitle, { color: C.text }]}>{year}</Text>
            <Pressable onPress={()=>setYear(y=>y+1)} style={[S.iconBtn, { borderColor: C.border, backgroundColor: C.card }]}>
              <Feather name="chevron-right" size={16} color={C.text}/>
            </Pressable>
          </View>

          <View style={S.monthGrid}>
            {MONTHS.map((mLabel, m)=> {
              const pick = firstDay(year, m);
              const active = sameYM(pick, value);
              return (
                <Pressable
                  key={mLabel}
                  onPress={()=>{ onChange(pick); onClose(); }}
                  style={[
                    S.monthChip,
                    { borderColor: active ? 'transparent' : C.border,
                      backgroundColor: active ? C.primary : C.card }
                  ]}
                >
                  <Text style={{ color: active ? C.primaryText : C.text, fontWeight: '600' }}>{mLabel}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={[S.closeBtn, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={{ color: C.text, fontWeight: '700' }}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ===== Componente principal =====
export function SectionCompareMonths({
  habits,
  C: CProp,
}: {
  habits: HabitExt[];
  C?: Partial<PaletteLike>;
}) {
  const C: PaletteLike = {
    background: '#FFFFFF', text: '#111827', mutedText: '#6B7280',
    primary: '#2563EB', primaryText: '#FFFFFF',
    border: '#E5E7EB', card: '#F9FAFB',
    ...(CProp || {}),
  };

  // Estado meses + filtros
  const today = new Date();
  const [m1, setM1] = useState(new Date(today.getFullYear(), today.getMonth()-1, 1));
  const [m2, setM2] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [changedOnly, setChangedOnly] = useState(false);
  const [focus, setFocus] = useState<'all'|'gains'|'losses'>('all');

  // Somente UI: itens ocultos via swipe (voltam ao recarregar/trocar página)
  const [hiddenIds, setHiddenIds] = useState<Record<string, true>>({});

  const mk1 = monthKey(m1);
  const mk2 = monthKey(m2);

  // Base ordenada por impacto
  const baseRows = useMemo<Row[]>(() => {
    const rows = habits.map(h => {
      const a = h.completedDates.filter(d => d.startsWith(mk1)).length;
      const b = h.completedDates.filter(d => d.startsWith(mk2)).length;
      return { id: h.id, name: h.name, m1: a, m2: b, diff: b - a };
    });
    rows.sort((x, y) => (Math.abs(y.diff) - Math.abs(x.diff)) || (y.m2 - x.m2) || x.name.localeCompare(y.name));
    return rows;
  }, [habits, mk1, mk2]);

  // Top 3 (ganhos/quedas)
  const topGains  = useMemo(()=> baseRows.filter(r => r.diff > 0).slice(0,3), [baseRows]);
  const topLosses = useMemo(()=> baseRows.filter(r => r.diff < 0).slice(0,3), [baseRows]);

  // Aplicar foco (gains/losses) e "só quem mudou"
  const focusedRows = useMemo(() => {
    let r = baseRows;
    if (focus === 'gains')  r = r.filter(x => x.diff > 0);
    if (focus === 'losses') r = r.filter(x => x.diff < 0);
    return changedOnly ? r.filter(x => x.diff !== 0) : r;
  }, [baseRows, focus, changedOnly]);

  // Filtra ocultos (UI only)
  const rows = focusedRows.filter(r => !hiddenIds[r.id]);

  const maxVal = Math.max(...rows.map(r => Math.max(r.m1, r.m2, 1)), 1);

  // Totais e % (base no mês 1)
  const tot1 = rows.reduce((s, r) => s + r.m1, 0);
  const tot2 = rows.reduce((s, r) => s + r.m2, 0);
  const totDiff = tot2 - tot1;
  const totPct  = pctChange(tot1, tot2);
  const totalPhrase =
    totDiff > 0 ? `subiu ${totDiff} (${totPct > 0 ? '+' : ''}${totPct}%)` :
    totDiff < 0 ? `caiu ${Math.abs(totDiff)} (${totPct}%)` :
    'ficou igual (0%)';

  const label1 = label(m1);
  const label2 = label(m2);

  // Top cards -> alternam foco
  const onPressTopGains = () => setFocus(f => f === 'gains' ? 'all' : 'gains');
  const onPressTopLoss  = () => setFocus(f => f === 'losses' ? 'all' : 'losses');

  // Ocultar/Restaurar (somente estado local)
  const hideHabit = (id: string) => setHiddenIds(prev => ({ ...prev, [id]: true }));
  const clearHidden = () => setHiddenIds({});

  return (
    <View style={[S.screen, { backgroundColor: C.background }]}>
      {/* Header: dois pickers */}
      <View style={[S.header, { borderColor: C.border }]}>
        <PickerPill label={label1} onPress={()=>setOpen1(true)} C={C}/>
        <Feather name="arrow-right" size={16} color={C.mutedText}/>
        <PickerPill label={label2} onPress={()=>setOpen2(true)} C={C}/>
      </View>

      {/* Filtros rápidos */}
      <View style={{ flexDirection:'row', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
        <Pressable
          onPress={()=>setChangedOnly(v=>!v)}
          style={[
            S.toggleChip,
            { backgroundColor: changedOnly ? C.primary : C.card,
              borderColor: changedOnly ? 'transparent' : C.border }
          ]}
        >
          <Feather name="filter" size={14} color={changedOnly ? C.primaryText : C.mutedText}/>
          <Text style={{ marginLeft:6, color: changedOnly ? C.primaryText : C.text, fontWeight:'700' }}>
            Mostrar só quem mudou
          </Text>
        </Pressable>

        {focus !== 'all' && (
          <View style={[S.toggleChip, { backgroundColor: C.card, borderColor: C.border }]}>
            <Feather name={focus === 'gains' ? 'trending-up' : 'trending-down'} size={14} color={focus==='gains' ? '#16a34a' : '#dc2626'}/>
            <Text style={{ marginLeft:6, fontWeight:'700', color: focus==='gains' ? '#065f46' : '#7f1d1d' }}>
              {focus === 'gains' ? 'Mostrando ganhos' : 'Mostrando quedas'}
            </Text>
            <Pressable onPress={()=>setFocus('all')} style={{ marginLeft:8 }}>
              <Feather name="x" size={14} color={C.mutedText}/>
            </Pressable>
          </View>
        )}

        {Object.keys(hiddenIds).length > 0 && (
          <Pressable
            onPress={clearHidden}
            style={[S.toggleChip, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Feather name="eye" size={14} color={C.mutedText}/>
            <Text style={{ marginLeft:6, fontWeight:'700', color: C.text }}>
              Mostrar todos ({Object.keys(hiddenIds).length})
            </Text>
          </Pressable>
        )}
      </View>

      {/* Top 3 ganhos / quedas (clicáveis) */}
      <View style={S.topGrid}>
        <Pressable
          onPress={onPressTopGains}
          style={[
            S.topCard,
            { backgroundColor: '#ecfdf5', borderColor: '#c7f0df',
              borderWidth: focus==='gains' ? 2 : 1 }
          ]}
        >
          <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <Feather name="trending-up" size={14} color="#16a34a"/>
            <Text style={{ marginLeft:6, color:'#065f46', fontWeight:'800' }}>
              Top 3 ganhos {focus==='gains' ? '• ativo' : ''}
            </Text>
          </View>
          {topGains.length ? topGains.map(r=>(
            <View key={r.id} style={S.topRow}>
              <Text style={{ flex:1, color:'#065f46' }} numberOfLines={1}>{r.name}</Text>
              <Text style={{ color:'#16a34a', fontWeight:'800' }}>+{r.diff}</Text>
            </View>
          )) : <Text style={{ color:'#065f46' }}>Sem ganhos.</Text>}
        </Pressable>

        <Pressable
          onPress={onPressTopLoss}
          style={[
            S.topCard,
            { backgroundColor: '#fff1f2', borderColor: '#f7cdd3',
              borderWidth: focus==='losses' ? 2 : 1 }
          ]}
        >
          <View style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <Feather name="trending-down" size={14} color="#dc2626"/>
            <Text style={{ marginLeft:6, color:'#7f1d1d', fontWeight:'800' }}>
              Top 3 quedas {focus==='losses' ? '• ativo' : ''}
            </Text>
          </View>
          {topLosses.length ? topLosses.map(r=>(
            <View key={r.id} style={S.topRow}>
              <Text style={{ flex:1, color:'#7f1d1d' }} numberOfLines={1}>{r.name}</Text>
              <Text style={{ color:'#dc2626', fontWeight:'800' }}>{r.diff}</Text>
            </View>
          )) : <Text style={{ color:'#7f1d1d' }}>Sem quedas.</Text>}
        </Pressable>
      </View>

      {/* Resumo simples com % */}
      <View style={[S.summaryCard, { borderColor: C.border, backgroundColor: C.card }]}>
        <Text style={[S.summaryLine, { color: C.text }]}>
          {label1}: <Text style={{ fontWeight:'800' }}>{tot1}</Text>   •   {label2}: <Text style={{ fontWeight:'800' }}>{tot2}</Text>
        </Text>
        <Text style={{ color: totDiff>0 ? '#16a34a' : totDiff<0 ? '#dc2626' : C.mutedText, fontWeight:'700' }}>
          {totalPhrase}
        </Text>
      </View>

      {/* Cards por hábito (com swipe para ocultar) */}
      <View>
        {rows.map((r, idx) => {
          const up = r.diff > 0;
          const down = r.diff < 0;
          const neutral = r.diff === 0;
          const tone = up ? '#16a34a' : down ? '#dc2626' : C.mutedText;


          const phrase = neutral
            ? `ficou igual a ${label1}`
            : up ? `fez ${r.diff} a mais que ${label1}`
                 : `fez ${Math.abs(r.diff)} a menos que ${label1}`;

          // Ação à direita (arrastar para a esquerda)
          const renderRightActions = () => (
            <View style={[S.swipeAction, { backgroundColor: '#fee2e2' }]}>
              <Feather name="eye-off" size={16} color="#991b1b" />
              <Text style={{ color:'#991b1b', fontWeight:'800', marginTop:4 }}>Ocultar</Text>
            </View>
          );

          return (
            <Swipeable
              key={r.id}
              renderRightActions={renderRightActions}
              overshootRight={false}
              onSwipeableRightOpen={() => hideHabit(r.id)}
            >
              <View style={[S.habitCard, { backgroundColor: C.background, borderColor: C.border }]}>
                <View style={S.cardHeader}>
                  <Text style={[S.habitTitle, { color: C.text }]} numberOfLines={1}>{r.name}</Text>
                  <View style={[
                    S.badge,
                    { backgroundColor: up ? '#e8f7ee' : down ? '#fdecec' : C.card,
                      borderColor: up ? '#c8efd7' : down ? '#f7d0d0' : C.border }
                  ]}>
                    {up && <Feather name="arrow-up-right" size={14} color="#16a34a" />}
                    {down && <Feather name="arrow-down-right" size={14} color="#dc2626" />}
                    {neutral && <Feather name="minus" size={14} color={C.mutedText} />}
                    {!neutral && (
                      <Text style={{ color: tone, fontWeight:'800', marginLeft:6 }}>
                        {up ? `+${r.diff}` : `-${Math.abs(r.diff)}`}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={{ color: C.mutedText, marginTop: 2 }}>
                  {label1} → {label2} • <Text style={{ color: tone, fontWeight:'700' }}>{phrase}</Text>
                </Text>

                <View style={S.kpiRow}>
                  <KpiBox title={label1} value={r.m1} C={C} />
                  <KpiBox title={label2} value={r.m2} C={C} />
                </View>

                <View style={[S.singleTrack, { backgroundColor: C.card, borderColor: C.border }]}>
                  {/* mês 1 */}
                  <MotiView
                    from={{ width: '0%' }}
                    transition={{ type: 'timing', duration: 420, delay: idx*20 }}
                    style={[StyleSheet.absoluteFill, { backgroundColor: C.border, borderRadius: 999 }]}
                  />
                  {/* mês 2 */}
                  <MotiView
                    from={{ width: '0%' }}
                    transition={{ type: 'timing', duration: 420, delay: idx*20 + 60 }}
                    style={[StyleSheet.absoluteFill, { backgroundColor: C.primary, borderRadius: 999, opacity: 0.9 }]}
                  />
                </View>
              </View>
            </Swipeable>
          );
        })}
        {rows.length===0 && (
          <Text style={{ color: C.mutedText, textAlign:'center', paddingVertical:16 }}>
            Sem dados para comparar.
          </Text>
        )}
      </View>

      {/* Modais */}
      <MonthPickerModal visible={open1} onClose={()=>setOpen1(false)} value={m1} onChange={setM1} C={C}/>
      <MonthPickerModal visible={open2} onClose={()=>setOpen2(false)} value={m2} onChange={setM2} C={C}/>
    </View>
  );
}

/* ===== Pequenos componentes ===== */
function PickerPill({ label, onPress, C }: { label: string; onPress: ()=>void; C: PaletteLike }) {
  return (
    <Pressable onPress={onPress} style={[S.inputBox, { backgroundColor: C.background, borderColor: C.border, flex: 1 }]}>
      <Feather name="calendar" size={14} color={C.mutedText}/>
      <Text style={{ color: C.text, fontWeight:'700' }}>{label}</Text>
    </Pressable>
  );
}
function KpiBox({ title, value, C, style }: { title:string; value:number; C:PaletteLike; style?:StyleProp<ViewStyle> }) {
  return (
    <View style={[S.kpiBox, { borderColor: C.border, backgroundColor: C.card }, style]}>
      <Text style={[S.kpiLabel, { color: C.mutedText }]}>{title}</Text>
      <Text style={[S.kpiValue, { color: C.text }]}>{value}</Text>
    </View>
  );
}

/* ===== Styles ===== */
const S = StyleSheet.create({
  screen: { padding: 14 },
  header: {
    flexDirection:'row', alignItems:'center', gap:10,
    paddingBottom:10, borderBottomWidth:1, marginBottom:12,
  },

  inputBox: {
    flexDirection:'row', alignItems:'center', gap:8,
    height:40, paddingHorizontal:12, borderRadius:10, borderWidth:1,
  },

  toggleChip: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:10, paddingVertical:8, borderRadius:10, borderWidth:1,
  },

  topGrid: { flexDirection:'row', gap:10, marginBottom:12 },
  topCard: { flex:1, borderWidth:1, borderRadius:12, padding:10 },
  topRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },

  summaryCard: { borderWidth:1, borderRadius:12, padding:12, marginBottom:12 },
  summaryLine: { fontSize:14, fontWeight:'700' },

  habitCard: { borderWidth:1, borderRadius:12, padding:12, marginBottom:12 },
  cardHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  habitTitle: { fontSize:16, fontWeight:'800' },
  badge: { flexDirection:'row', alignItems:'center', borderRadius:20, paddingHorizontal:10, paddingVertical:6, borderWidth:1 },

  kpiRow: { marginTop:10, flexDirection:'row', gap:10 },
  kpiBox: { flex:1, borderWidth:1, borderRadius:10, paddingVertical:8, alignItems:'center' },
  kpiLabel: { fontSize:11, fontWeight:'700' },
  kpiValue: { fontSize:16, fontWeight:'800', marginTop:2 },

  singleTrack: { marginTop:10, height:12, borderRadius:999, borderWidth:1, overflow:'hidden' },

  swipeAction: {
    width: 96, justifyContent:'center', alignItems:'center',
    borderTopRightRadius:12, borderBottomRightRadius:12,
  },

  // Modal
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center', padding:16 },
  modalCard: { width:'100%', maxWidth:420, borderRadius:14, borderWidth:1, padding:14 },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  iconBtn: { width:36, height:36, borderRadius:8, alignItems:'center', justifyContent:'center', borderWidth:1 },
  yearTitle: { fontSize:16, fontWeight:'800' },
  monthGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'space-between' },
  monthChip: { width:'30%', alignItems:'center', justifyContent:'center', height:40, borderRadius:10, borderWidth:1, marginBottom:8 },
  closeBtn: { marginTop:8, alignSelf:'flex-end', paddingHorizontal:12, paddingVertical:8, borderRadius:8, borderWidth:1 },
});
