// src/app/screen/EditHabitModal.tsx
import Colors from "@/constants/Colors";
import { updateHabit, type Habit } from "@/services/habits.service";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function EditHabitModal({
  visible,
  onClose,
  habit,
  onUpdated,
}: {
  visible: boolean;
  onClose: () => void;
  habit: Habit | null;
  onUpdated: () => void;
}) {
  const scheme = "light";
  const C = Colors[scheme];
  const styles = createStyles(C);

  const [name, setName] = useState(habit?.name || "");
  const [loading, setLoading] = useState(false);

  // Atualiza o nome quando o modal abre com outro hábito
  useEffect(() => {
    setName(habit?.name || "");
  }, [habit]);

  async function handleSave() {
    if (!habit) return;

    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Aviso", "O nome do hábito não pode estar vazio.");
      return;
    }
    if (trimmed === habit.name) {
      Alert.alert("Nada alterado", "O nome continua igual, nada foi modificado.");
      return;
    }

    try {
      setLoading(true);
      await updateHabit(habit.id, { name: trimmed });
      onUpdated(); // recarrega lista
      onClose();   // fecha modal
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao atualizar o hábito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Editar hábito</Text>

          <TextInput
            style={styles.input}
            placeholder="Novo nome do hábito"
            placeholderTextColor={C.mutedText}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, { backgroundColor: C.border }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: C.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: C.primary }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.primaryText} />
              ) : (
                <Text style={[styles.btnText, { color: C.primaryText }]}>Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(C: typeof Colors.light) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modal: {
      width: "85%",
      backgroundColor: C.background,
      borderRadius: 14,
      padding: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      color: C.text,
      textAlign: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      padding: 10,
      color: C.text,
      marginBottom: 16,
    },
    buttons: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    btn: {
      flex: 1,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      fontWeight: "700",
      fontSize: 14,
    },
  });
}
