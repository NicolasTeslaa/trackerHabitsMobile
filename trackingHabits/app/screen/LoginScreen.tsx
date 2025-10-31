import { UsersService } from "@/services/usersService";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const SS_KEYS = {
  phone: "auth_phone",
  pass: "auth_pass",
};

export default function LoginScreen() {
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // ===== helpers SecureStore =====
  async function saveCreds(phone: string, pass: string) {
    await SecureStore.setItemAsync(SS_KEYS.phone, phone);
    await SecureStore.setItemAsync(SS_KEYS.pass, pass, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  async function loadCreds() {
    const [p, s] = await Promise.all([
      SecureStore.getItemAsync(SS_KEYS.phone),
      SecureStore.getItemAsync(SS_KEYS.pass),
    ]);
    return { p: p ?? "", s: s ?? "" };
  }
  async function clearCreds() {
    await Promise.all([
      SecureStore.deleteItemAsync(SS_KEYS.phone),
      SecureStore.deleteItemAsync(SS_KEYS.pass),
    ]);
  }

  // Auto-preenche ao montar
  useEffect(() => {
    (async () => {
      try {
        const { p, s } = await loadCreds();
        if (p) setTelefone(p);
        if (s) setSenha(s);
      } finally {
        setLoadingSaved(false);
      }
    })();
  }, []);

  const telefoneError = useMemo(() => {
    if (!telefone) return undefined;
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
      await UsersService.login({
        telefone: telefone.trim(),
        senha: senha,
      });
      if (remember) {
        await saveCreds(telefone.trim(), senha);
      } else {
        await clearCreds();
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  // ===== Fake Google Sign-In (estético) =====
  async function handleGoogleLoginFake() {
    setErr(null);
    try {
      setLoadingGoogle(true);
      // Delay curto para simular fluxo
      await new Promise((r) => setTimeout(r, 900));
      // Preenche com um “mock” elegante e navega
      setTelefone("google.user@mock");
      setSenha("oauth-mock");
      router.replace("/(tabs)");
    } catch {
      setErr("Não foi possível continuar com Google.");
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        {/* Branding minimal */}
        <View style={styles.header}>
          {/* <View style={styles.logoWrap}>
            <Image
              source={{ uri: "https://drive.google.com/file/d/1zWq6C_s9avb2xT1pDW2UZEZgQR2vMcou/view" }}
              style={styles.logo}
            />
          </View> */}
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>
            Acesse sua conta para continuar acompanhando seus lançamentos.
          </Text>
        </View>

        {/* Botão Google (fake) */}
        <TouchableOpacity
          onPress={handleGoogleLoginFake}
          style={[styles.googleBtn, (loading || loadingGoogle) && styles.btnDisabled]}
          disabled={loading || loadingGoogle}
        >
          {loadingGoogle ? (
            <ActivityIndicator />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#111827" />
              <Text style={styles.googleBtnText}>Continuar com Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divisor */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.divider} />
        </View>

        {/* Campos */}
        <View style={styles.field}>
          <Text style={styles.label}>Telefone</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={18} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, !!telefoneError && styles.inputError]}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#6B7280"
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={setTelefone}
              autoCapitalize="none"
            />
          </View>
          {!!telefoneError && <Text style={styles.error}>{telefoneError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.passRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.passInput, !!senhaError && styles.inputError]}
              placeholder="Sua senha"
              placeholderTextColor="#6B7280"
              secureTextEntry={!showPass}
              value={senha}
              onChangeText={setSenha}
              autoCapitalize="none"
              textContentType="password"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass((s) => !s)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={showPass ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#93C5FD"
              />
            </TouchableOpacity>
          </View>
          {!!senhaError && <Text style={styles.error}>{senhaError}</Text>}
        </View>

        {!!err && <Text style={styles.errorBox}>{err}</Text>}

        {/* Lembrar dados */}
        <View style={styles.rememberRow}>
          <Text style={styles.rememberLabel}>Lembrar dados</Text>
          <Switch
            value={remember}
            onValueChange={setRemember}
            thumbColor={remember ? "#93C5FD" : "#e5e7eb"}
            trackColor={{ false: "#374151", true: "#1f2937" }}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          disabled={!canSubmit || loading}
          style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
          onPress={handleLogin}
        >
          {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>Entrar</Text>}
        </TouchableOpacity>

        {/* Rodapé sutil */}
        <Text style={styles.hint}>
          Ao continuar, você concorda com nossos Termos e Política de Privacidade.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#0F1423",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  header: { alignItems: "center", marginBottom: 14 },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  logo: { width: 28, height: 28, borderRadius: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#E5E7EB" },
  subtitle: { marginTop: 6, color: "#9CA3AF", textAlign: "center" },

  googleBtn: {
    marginTop: 14,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  googleBtnText: { color: "#111827", fontWeight: "700", fontSize: 15 },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  divider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  dividerText: { color: "#6B7280", fontSize: 12 },

  field: { marginBottom: 12 },
  label: { color: "#9CA3AF", marginBottom: 6, fontSize: 13 },
  inputRow: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#0D1322",
    color: "#E5E7EB",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingLeft: 38,
    paddingRight: 12,
    paddingVertical: 12,
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  inputError: { borderColor: "#ef4444" },

  passRow: {
    position: "relative",
    justifyContent: "center",
  },
  passInput: { paddingRight: 42 },
  eyeBtn: {
    position: "absolute",
    right: 10,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.7)",
  },

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

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 6,
  },
  rememberLabel: { color: "#9CA3AF", fontSize: 14 },

  btn: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  hint: {
    marginTop: 12,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
  },
});
