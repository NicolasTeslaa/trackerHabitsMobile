// src/components/NewHabitModal.tsx
import Colors from "@/constants/Colors";
import { createHabit, Habit } from "@/services/habits.service";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

type Props = {
    visible: boolean;
    onClose: () => void;
    userId: string;              // <- obrigatório
    onCreated?: (habit: Habit) => void;      // callback após criar com sucesso (ex: reload)
};

export default function NewHabitModal({ visible, onClose, userId, onCreated }: Props) {
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
            const created = await createHabit(trimmed, userId); // retorna Habit
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
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={S.backdrop}>
                <View style={S.card}>
                    <Text style={S.title}>Novo Hábito</Text>

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
                        <Pressable style={S.btnGhost} onPress={onClose} disabled={saving}>
                            <Text style={S.btnGhostText}>Cancelar</Text>
                        </Pressable>

                        <Pressable style={S.btnPrimary} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator /> : <Text style={S.btnPrimaryText}>Salvar</Text>}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function styles(C: typeof Colors.light) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
        },
        card: {
            width: "100%",
            backgroundColor: C.background,
            borderRadius: 12,
            padding: 18,
            borderWidth: 1,
            borderColor: C.border,
        },
        title: { fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 12 },
        input: {
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: C.text,
            marginBottom: 16,
        },
        row: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
        btnGhost: { paddingHorizontal: 16, height: 44, alignItems: "center", justifyContent: "center" },
        btnGhostText: { color: C.mutedText, fontWeight: "600" },
        btnPrimary: {
            paddingHorizontal: 16,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: C.primary,
        },
        btnPrimaryText: { color: C.primaryText, fontWeight: "700" },
    });
}
