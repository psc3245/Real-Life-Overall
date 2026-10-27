import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/api/auth";
import { Button, Muted } from "@/components/ui";
import { WEB_URL } from "@/lib/config";
import { colors, fonts, space } from "@/lib/theme";

const MIN_PASSWORD = 8; // the API's Better Auth minimum

// Email links open in a browser, so they land on the website (which signs the browser in);
// the player then signs in here.
const VERIFY_CALLBACK = `${WEB_URL}/signin`;
const RESET_REDIRECT = `${WEB_URL}/reset-password`;

/** Email + password sign-in and sign-up (DESIGN.md §8.5). Google comes later. */
export default function SignInScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === "signup";
  const forgot = mode === "forgot";

  function switchTo(next: typeof mode) {
    setError(null);
    setNotice(null);
    setMode(next);
  }

  async function submit() {
    setError(null);
    setNotice(null);
    setBusy(true);
    if (forgot) {
      const result = await authClient.requestPasswordReset({ email, redirectTo: RESET_REDIRECT });
      setBusy(false);
      if (result.error) setError(result.error.message ?? "Couldn't send the email");
      else {
        setMode("signin");
        setNotice(`If ${email} has an account, a reset link is on its way.`);
      }
      return;
    }
    const result = signingUp
      ? await authClient.signUp.email({
          name: name.trim() || email,
          email,
          password,
          callbackURL: VERIFY_CALLBACK,
        })
      : await authClient.signIn.email({ email, password, callbackURL: VERIFY_CALLBACK });
    setBusy(false);
    if (result.error?.code === "EMAIL_NOT_VERIFIED") {
      setNotice(`Confirm your email first. We sent a fresh link to ${email}.`);
    } else if (result.error) {
      setError(result.error.message ?? "Sign in failed");
    } else if (signingUp) {
      setMode("signin");
      setNotice(`Check ${email} for a link to confirm your account, then sign in.`);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.title}>Real Life Overall</Text>
          <Muted>
            {signingUp ? "Create your player." : forgot ? "Reset your password." : "Welcome back."}
          </Muted>
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
        {!forgot && (
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
        )}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={signingUp ? "Create account" : forgot ? "Send reset link" : "Sign in"}
          onPress={submit}
          busy={busy}
          disabled={!email || (!forgot && password.length < (signingUp ? MIN_PASSWORD : 1))}
        />
        <Button
          variant="ghost"
          title={signingUp || forgot ? "I have an account" : "Create an account"}
          onPress={() => switchTo(signingUp || forgot ? "signin" : "signup")}
        />
        {mode === "signin" && (
          <Button variant="ghost" title="Forgot password?" onPress={() => switchTo("forgot")} />
        )}
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
  notice: { color: colors.neon, fontSize: 14 },
});
