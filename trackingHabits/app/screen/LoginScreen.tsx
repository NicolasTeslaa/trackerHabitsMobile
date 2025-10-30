import { UsersService } from "@/services/usersService";
import { router } from 'expo-router';
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function LoginScreen() {
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const telefoneError = useMemo(() => {
    if (!telefone) return undefined;
    // regra mínima: 8+ dígitos (ajuste se quiser DDI/DDD)
    const onlyDigits = telefone.replace(/\D/g, "");
    return onlyDigits.length >= 8 ? undefined : "Informe um telefone válido";
  }, [telefone]);

  const senhaError = useMemo(() => {
    if (!senha) return undefined;
    return senha.length >= 6 ? undefined : "Mínimo de 6 caracteres";
  }, [senha]);

  const canSubmit = useMemo(() => {
    return (
      telefone.trim().length > 0 &&
      senha.trim().length > 0 &&
      !telefoneError &&
      !senhaError
    );
  }, [telefone, senha, telefoneError, senhaError]);

  async function handleLogin() {
    setErr(null);
    if (!canSubmit) return;

    try {
      setLoading(true);
      const resp = await UsersService.login({
        telefone: telefone.trim(),
        senha: senha,
      });

      router.replace('/(tabs)'); // vai para o seu stack de tabs
    } catch (e: any) {
      setErr(e?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Entrar</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={[styles.input, !!telefoneError && styles.inputError]}
            placeholder="(11) 99999-9999"
            keyboardType="phone-pad"
            value={telefone}
            onChangeText={setTelefone}
            autoCapitalize="none"
          />
          {!!telefoneError && <Text style={styles.error}>{telefoneError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, styles.passInput, !!senhaError && styles.inputError]}
              placeholder="Sua senha"
              secureTextEntry={!showPass}
              value={senha}
              onChangeText={setSenha}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => setShowPass((s) => !s)}
            >
              <Text style={styles.toggleText}>{showPass ? "Ocultar" : "Mostrar"}</Text>
            </TouchableOpacity>
          </View>
          {!!senhaError && <Text style={styles.error}>{senhaError}</Text>}
        </View>

        {!!err && <Text style={styles.errorBox}>{err}</Text>}

        <TouchableOpacity
          disabled={!canSubmit || loading}
          style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
          onPress={handleLogin}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "#0B1220" },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16, color: "#E5E7EB" },
  field: { marginBottom: 14 },
  label: { color: "#9CA3AF", marginBottom: 6 },
  input: {
    backgroundColor: "#0F172A",
    color: "#E5E7EB",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputError: { borderColor: "#ef4444" },
  passRow: { flexDirection: "row", alignItems: "center" },
  passInput: { flex: 1 },
  toggle: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#0F172A" },
  toggleText: { color: "#93C5FD", fontWeight: "600" },
  error: { marginTop: 6, color: "#f87171" },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "#ef4444",
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    color: "#fecaca",
    marginBottom: 8,
  },
  btn: {
    marginTop: 6,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
