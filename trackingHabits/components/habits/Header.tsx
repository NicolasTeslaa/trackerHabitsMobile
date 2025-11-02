import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MotiText, MotiView } from 'moti';
import type { ChartType, Palette } from './utils';
import { styles as makeStyles } from './utils';
import { SegmentBtn } from './SegmentBtn';

export function Header({
  C, chartType, onChangeChart,
  currentDate, setCurrentDate,
  showMonthNav, showSearch, query, setQuery,
  compareRefDate, setCompareRefDate,

}: {
  C: Palette;
  chartType: ChartType;
  onChangeChart: (c: ChartType) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  showMonthNav?: boolean;
  showSearch?: boolean;
  query: string;
  setQuery: (v: string) => void;
  compareRefDate: Date;
  setCompareRefDate: (d: Date) => void;
}) {
  const S = makeStyles(C);
  const today = new Date();

  const handlePrevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

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

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const refCandidates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (i + 1), 1);
    return d;
  }).reverse(); // do mais antigo -> mais recente

  const isSameYM = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  return (
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
        <SegmentBtn
          icon={<MaterialIcons name="compare-arrows" size={16} color={chartType === 'compare' ? C.primaryText : C.mutedText} />}
          active={chartType === 'compare'} onPress={() => onChangeChart('compare')} C={C} />
        <SegmentBtn icon={<Feather name="bar-chart-2" size={16} color={chartType === 'bar' ? C.primaryText : C.mutedText} />}
          active={chartType === 'bar'} onPress={() => onChangeChart('bar')} C={C} />
        <SegmentBtn icon={<Feather name="trending-up" size={16} color={chartType === 'trend' ? C.primaryText : C.mutedText} />}
          active={chartType === 'trend'} onPress={() => onChangeChart('trend')} C={C} />
        <SegmentBtn icon={<Ionicons name="pie-chart-outline" size={16} color={chartType === 'overview' ? C.primaryText : C.mutedText} />}
          active={chartType === 'overview'} onPress={() => onChangeChart('overview')} C={C} />
        <SegmentBtn icon={<Ionicons name="bulb-outline" size={16} color={chartType === 'insights' ? C.primaryText : C.mutedText} />}
          active={chartType === 'insights'} onPress={() => onChangeChart('insights')} C={C} />
      </View>

      {showMonthNav && (
        <View style={S.monthNav}>
          <Pressable onPress={handlePrevMonth} style={S.navBtn}>
            <MaterialIcons name="chevron-left" size={20} color={C.mutedText} />
          </Pressable>
          <Text style={S.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={handleNextMonth} disabled={!canGoNext()} style={[S.navBtn, !canGoNext() && { opacity: 0.4 }]}>
            <MaterialIcons name="chevron-right" size={20} color={C.mutedText} />
          </Pressable>
        </View>
      )}

      {showSearch && (
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
  );
}
