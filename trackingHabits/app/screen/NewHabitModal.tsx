import Colors from "@/constants/Colors";
import { createHabit, type Habit } from "@/services/habits.service";
import { MotiText, MotiView } from "moti";
import { MotiPressable } from "moti/interactions";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    useColorScheme,
    View,
} from "react-native";
import "react-native-reanimated";

export default function NewHabitModal({
    visible,
    onClose,
    userId,
    onCreated,
}: {
    visible: boolean;
    onClose: () => void;
    userId: string;
    onCreated?: (habit: Habit) => void;
}) {
    const scheme = useColorScheme() ?? "light";
    const C = Colors[scheme];
    const S = styles(C);

    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        const trimmed = name.trim();
        if (!trimmed) {
            Alert.alert("Novo hábito", "Digite um nome para o hábito.");
            return;
        }
        setSaving(true);
        try {
            const created = await createHabit(trimmed, userId);
            setName("");
            onClose();
            onCreated?.(created);
        } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível criar o hábito.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent // ✅ evita recorte com status bar no Android
            hardwareAccelerated
        >
            <KeyboardAvoidingView
                style={S.flex} // ✅ ocupa a tela toda
                behavior={Platform.OS === "ios" ? "padding" : "height"} // ✅ empurra conteúdo
                keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })} // ajuste se tiver Header
            >
                <View style={S.backdrop}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={S.center}
                    >
                        <MotiView
                            from={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 16, stiffness: 180 }}
                            style={S.card}
                        >
                            <MotiText
                                from={{ translateY: -8, opacity: 0 }}
                                animate={{ translateY: 0, opacity: 1 }}
                                transition={{ type: "timing", duration: 240 }}
                                style={S.title}
                            >
                                Novo Hábito
                            </MotiText>

                            <TextInput
                                placeholder="Nome do hábito"
                                placeholderTextColor={C.mutedText}
                                value={name}
                                onChangeText={setName}
                                style={S.input}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleSave}
                            />

                            <View style={S.row}>
                                <MotiPressable
                                    style={S.btnGhost}
                                    onPress={onClose}
                                    animate={({ hovered, pressed }) => {
                                        "worklet";
                                        return {
                                            scale: pressed ? 0.95 : hovered ? 1.05 : 1,
                                            opacity: pressed ? 0.7 : 1,
                                        };
                                    }}
                                >
                                    <MotiText style={S.btnGhostText}>Cancelar</MotiText>
                                </MotiPressable>

                                <MotiPressable
                                    style={S.btnPrimary}
                                    onPress={handleSave}
                                    disabled={saving}
                                    animate={({ pressed }) => {
                                        "worklet";
                                        return {
                                            scale: pressed ? 0.97 : 1,
                                            opacity: pressed ? 0.9 : 1,
                                        };
                                    }}
                                >
                                    {saving ? (
                                        <ActivityIndicator color={C.primaryText} />
                                    ) : (
                                        <MotiText
                                            from={{ opacity: 0, translateY: 6 }}
                                            animate={{ opacity: 1, translateY: 0 }}
                                            transition={{ delay: 120, duration: 220 }}
                                            style={S.btnPrimaryText}
                                        >
                                            Salvar
                                        </MotiText>
                                    )}
                                </MotiPressable>
                            </View>
                        </MotiView>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function styles(C: typeof Colors.light) {
    return StyleSheet.create({
        flex: { flex: 1 },
        backdrop: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
        },
        center: {
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
        },
        card: {
            width: "100%",
            backgroundColor: C.background,
            borderRadius: 16,
            padding: 22,
            borderWidth: 1,
            borderColor: C.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
            overflow: "visible",
        },
        title: {
            fontSize: 22,
            fontWeight: "800",
            color: C.text,
            marginBottom: 16,
            textAlign: "center",
        },
        input: {
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: C.text,
            marginBottom: 20,
            fontSize: 16,
        },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            columnGap: 12, // (gap estável)
            marginTop: 8,
        },
        btnGhost: {
            flex: 1,
            height: 46,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.border,
            width: 100
        },
        btnGhostText: { color: C.mutedText, fontWeight: "600", fontSize: 15 },
        btnPrimary: {
            flex: 1,
            height: 46,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: C.primary,
            shadowColor: C.primary,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 5,
            width: 100
        },
        btnPrimaryText: { color: C.primaryText, fontWeight: "700", fontSize: 15 },
    });
}
