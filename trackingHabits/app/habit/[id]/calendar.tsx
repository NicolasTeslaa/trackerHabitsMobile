import Colors from "@/constants/Colors";
import { getHabitCalendar, toggleOnDate, type HabitDTO } from "@/services/habits.service";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextStyle,
    useColorScheme,
    View,
    ViewStyle,
} from "react-native";

/* ===== Helpers de estilo dinâmico (FORA do StyleSheet) ===== */
function dayTodayOutline(C: typeof Colors.light): ViewStyle {
    return { borderColor: C.primary, borderWidth: 2 };
}

export default function HabitCalendarScreen() {
    const params = useLocalSearchParams<{ id: string; name?: string | string[] }>();
    const rawName = params.name;
    const niceTitle = "Calendário";
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const router = useRouter();

    const scheme = useColorScheme() ?? "light";
    const C = Colors[scheme];
    const styles = createStyles(C);

    const [dto, setDto] = useState<HabitDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // mês/ano visíveis
    const [cursor, setCursor] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const { year, month, days, progressPct, monthCount, daysInThisMonth } = useMonthGrid(
        cursor,
        dto?.completedDates ?? []
    );

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!id) return;
            setLoading(true);
            setErr(null);
            try {
                const data = await getHabitCalendar(String(id));
                if (!alive) return;
                setDto(data);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || "Falha ao carregar calendário");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [id]);

    const title = name || dto?.name || "Hábito";

    const headerSubtitle = useMemo(() => {
        const mes = cursor.toLocaleDateString("pt-BR", { month: "long" });
        return `${capitalize(mes)} ${year}   ${monthCount}/${daysInThisMonth}`;
    }, [cursor, year, monthCount, daysInThisMonth]);

    async function onToggleDay(day: number) {
        if (!dto) return;
        const iso = toISO(year, month, day);
        try {
            await toggleOnDate(dto.id, iso);
            // atualiza localmente sem refetch
            const set = new Set(dto.completedDates);
            if (set.has(iso)) set.delete(iso);
            else set.add(iso);
            setDto({ ...dto, completedDates: Array.from(set).sort() });
        } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível atualizar o dia.");
        }
    }

    if (loading) {
        return (
            <FullCenter style={{ backgroundColor: C.background }}>
                <ActivityIndicator />
            </FullCenter>
        );
    }
    if (err) {
        return (
            <FullCenter style={{ padding: 16, backgroundColor: C.background }}>
                <Text style={{ color: "#ef4444", marginBottom: 12 } as TextStyle}>{err}</Text>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={18} color={C.primaryText} />
                    <Text style={styles.backBtnText}>Voltar</Text>
                </Pressable>
            </FullCenter>
        );
    }
    if (!dto) return null;

    return (

        <ScrollView style={{ flex: 1, backgroundColor: C.background }} contentContainerStyle={{ padding: 16 }}>
            <Stack.Screen
                options={{
                    title: niceTitle,
                    headerTitleAlign: "center",
                    headerBackTitle: "Voltar", // <<< aqui muda o nome do botão

                }}
            />

            {/* Header */}
            <View style={styles.headerCard}>
                <View style={styles.headerTop}>
                    <Pressable onPress={() => router.back()} style={styles.iconRound}>
                        <Ionicons name="arrow-back" size={18} color={C.text} />
                    </Pressable>
                    <Text style={styles.title}>{title}</Text>
                    <View style={{ width: 34 }} />
                </View>

                <Text style={styles.subtitle}>{headerSubtitle}</Text>

                <View style={styles.progressOuter}>
                    <View style={[styles.progressInner, { width: `${Math.round(progressPct * 100)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{Math.round(progressPct * 100)}% do mês concluído</Text>

                <View style={styles.monthNav}>
                    <Pressable onPress={() => setCursor(addMonths(cursor, -1))} style={styles.iconRound}>
                        <Ionicons name="chevron-back" size={18} color={C.text} />
                    </Pressable>
                    <Pressable onPress={() => setCursor(addMonths(cursor, +1))} style={styles.iconRound}>
                        <Ionicons name="chevron-forward" size={18} color={C.text} />
                    </Pressable>
                </View>
            </View>

            {/* Calendário */}
            <View style={styles.calendarCard}>
                <WeekHeader C={C} />


                <View style={styles.grid}>
                    {days.map((d, idx) => {
                        if (d.type !== "current") {
                            return <View key={`pad-${idx}`} style={styles.dayPad} />;
                        }
                        const isToday = isTodayYMD(year, month, d.day);
                        const done = d.done;
                        return (
                            <Pressable
                                key={`day-${d.day}`}
                                onPress={() => onToggleDay(d.day)}
                                style={[
                                    styles.dayCell,
                                    done && styles.dayDone,
                                    isToday && dayTodayOutline(C),
                                ]}
                            >
                                <Text style={[styles.dayText, done ? styles.dayTextDone : undefined]}>{d.day}</Text>
                            </Pressable>
                        );
                    })}
                </View>




                {/* Legenda */}
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: C.primary }]} />
                        <Text style={styles.legendText}>Concluído</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View
                            style={[
                                styles.legendDot,
                                { backgroundColor: "transparent", borderWidth: 2, borderColor: C.primary } as ViewStyle,
                            ]}
                        />
                        <Text style={styles.legendText}>Hoje</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

/* ===== Helpers de calendário ===== */

function useMonthGrid(cursor: Date, completed: string[]) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth(); // 0-11

    const firstWeekday = new Date(year, month, 1).getDay(); // 0=Dom..6=Sab
    const daysInThisMonth = new Date(year, month + 1, 0).getDate();

    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const completedSet = new Set(completed);
    const monthCount = completed.filter((d) => d.startsWith(monthPrefix)).length;
    const progressPct = Math.max(0, Math.min(1, monthCount / daysInThisMonth));

    const pads = Array.from({ length: firstWeekday }).map(() => ({ type: "pad" as const }));
    const current = Array.from({ length: daysInThisMonth }).map((_, i) => {
        const day = i + 1;
        const iso = toISO(year, month, day);
        return { type: "current" as const, day, done: completedSet.has(iso) };
    });

    return {
        year,
        month,
        daysInThisMonth,
        monthCount,
        progressPct,
        days: [...pads, ...current],
    };
}

function toISO(y: number, mZero: number, d: number) {
    const mm = String(mZero + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
}
function addMonths(d: Date, delta: number) {
    return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function isTodayYMD(y: number, mZero: number, d: number) {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === mZero && t.getDate() === d;
}
function capitalize(s: string) {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/* ===== UI auxiliares ===== */

function FullCenter({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
}) {
    return <View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}>{children}</View>;
}

function WeekHeader({ C }: { C: typeof Colors.light }) {
    const labels = ["D", "S", "T", "Q", "Q", "S", "S"]; // Dom..Sab
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            {labels.map((l, i) => (
                <Text
                    key={`${l}-${i}`} // <<< chave única agora
                    style={{ width: 40, textAlign: "center", color: C.mutedText, fontWeight: "600" }}
                >
                    {l}
                </Text>
            ))}
        </View>
    );
}

/* ===== Estilos ===== */

function createStyles(C: typeof Colors.light) {
    return StyleSheet.create({
        headerCard: {
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.background,
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
        },
        headerTop: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
        },
        title: { fontSize: 20, fontWeight: "700", color: C.text } as TextStyle,
        subtitle: { color: C.mutedText, marginBottom: 8 } as TextStyle,

        iconRound: {
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.background,
        } as ViewStyle,

        progressOuter: {
            height: 8,
            borderRadius: 999,
            backgroundColor: C.chipBg,
            overflow: "hidden",
        } as ViewStyle,
        progressInner: {
            height: "100%",
            backgroundColor: C.primary,
            borderRadius: 999,
        } as ViewStyle,
        progressLabel: {
            color: C.mutedText,
            marginTop: 6,
            fontSize: 12,
            alignSelf: "center",
        } as TextStyle,

        monthNav: {
            marginTop: 10,
            flexDirection: "row",
            justifyContent: "space-between",
        } as ViewStyle,

        calendarCard: {
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: C.background,
            borderRadius: 14,
            padding: 14,
            alignItems: "center", // centraliza o conteúdo
        } as ViewStyle,

        grid: {
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 8,
            rowGap: 8,
            justifyContent: "flex-start",
            width: 7 * 40 + 6 * 8, // 7 colunas × 40px + 6 gaps de 8px
            alignSelf: "center", // centraliza o bloco todo
        } as ViewStyle,
        dayPad: { width: 40, height: 40, marginBottom: 8 } as ViewStyle,
        dayCell: {
            width: 40,
            height: 40,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: C.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: C.background,
            marginBottom: 8,
        } as ViewStyle,
        dayDone: {
            backgroundColor: C.primary,
            borderColor: C.primary,
        } as ViewStyle,
        dayText: { color: C.text, fontWeight: "700" } as TextStyle,
        dayTextDone: { color: C.primaryText } as TextStyle,

        legend: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
        } as ViewStyle,
        legendItem: { flexDirection: "row", alignItems: "center", marginRight: 8 } as ViewStyle,
        legendDot: { width: 14, height: 14, borderRadius: 999 } as ViewStyle,
        legendText: { color: C.mutedText } as TextStyle,
        backBtn: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            height: 44,
            borderRadius: 10,
            backgroundColor: C.primary,
        } as ViewStyle,
        backBtnText: { color: C.primaryText, fontWeight: "700" } as TextStyle,
    });
}
