import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/api/auth";
import { Button, Muted } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";

const MIN_PASSWORD = 8; // the API's Better Auth minimum

/** Email + password sign-in and sign-up (DESIGN.md §8.5). Google comes later. */
export default function SignInScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === "signup";

  async function submit() {
    setError(null);
    setBusy(true);
    const result = signingUp
      ? await authClient.signUp.email({ name: name.trim() || email, email, password })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) setError(result.error.message ?? "Sign in failed");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.title}>Real Life Overall</Text>
          <Muted>{signingUp ? "Create your player." : "Welcome back."}</Muted>
        </View>

        {signingUp && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.court500}
            textContentType="name"
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.court500}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={signingUp ? `Password (${MIN_PASSWORD}+ characters)` : "Password"}
          placeholderTextColor={colors.court500}
          secureTextEntry
          textContentType={signingUp ? "newPassword" : "password"}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={signingUp ? "Create account" : "Sign in"}
          onPress={submit}
          busy={busy}
          disabled={!email || password.length < (signingUp ? MIN_PASSWORD : 1)}
        />
        <Button
          variant="ghost"
          title={signingUp ? "I have an account" : "Create an account"}
          onPress={() => {
            setError(null);
            setMode(signingUp ? "signin" : "signup");
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.court950 },
  container: { flex: 1, justifyContent: "center", padding: space.xl, gap: space.md },
  brand: { gap: space.xs, marginBottom: space.xl },
  title: {
    color: colors.neon,
    fontFamily: fonts.heavy,
    fontSize: 40,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.court100,
    fontSize: 16,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  error: { color: colors.flare, fontSize: 14 },
});
