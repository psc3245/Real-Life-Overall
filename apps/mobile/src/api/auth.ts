import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_URL, APP_SCHEME } from "@/lib/config";

/** Better Auth with the session cookie kept in the Keychain (SecureStore). */
export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
  plugins: [expoClient({ scheme: APP_SCHEME, storagePrefix: APP_SCHEME, storage: SecureStore })],
});
