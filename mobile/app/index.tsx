import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { authConfigured, supabase } from "../lib/supabase";

type Language = "en" | "dv";
type Card = { id: string; headline: string; summary: string; source?: string; sourceUrl?: string; category?: string; breaking?: boolean };
const API_URL = String(Constants.expoConfig?.extra?.apiUrl ?? "https://kurufeetha-maldives.hussainfiraz.chatgpt.site");

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

async function registerPush(language: Language, accessToken?: string) {
  if (!accessToken) return;
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || projectId === "REPLACE_WITH_EAS_PROJECT_ID") return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await fetch(`${API_URL}/api/v1/notifications/subscribe`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ token, platform: "ios", language, topics: ["breaking"] }) });
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = supabase.auth.onAuthStateChange((_e, value) => setSession(value)); return () => data.subscription.unsubscribe(); }, []);
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/feed?language=${language}`, { headers: session ? { authorization: `Bearer ${session.access_token}` } : {} }).then((response) => response.json()).then((result) => setCards(result.items ?? [])).finally(() => setLoading(false));
  }, [language, session]);
  useEffect(() => { registerPush(language, session?.access_token).catch(() => undefined); }, [language, session]);
  async function oauth(provider: "google" | "apple") {
    if (!authConfigured) return;
    const callback = Linking.createURL("auth");
    const { data } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback, skipBrowserRedirect: true } });
    if (!data.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, callback);
    if (result.type === "success") { const params = new URL(result.url.replace("#", "?")); const access_token = params.searchParams.get("access_token"); const refresh_token = params.searchParams.get("refresh_token"); if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token }); }
  }
  async function magicLink() { if (authConfigured && email) await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: Linking.createURL("auth") } }); }
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><View><Text style={styles.brand}>KuruFeetha</Text><Text style={styles.tag}>Maldives, in brief.</Text></View><View style={styles.headerButtons}><Pressable style={styles.language} onPress={() => setLanguage(language === "en" ? "dv" : "en")}><Text>{language === "en" ? "ދި" : "EN"}</Text></Pressable><Pressable style={styles.language} onPress={() => setAccountOpen(!accountOpen)}><Text>{session ? "●" : "○"}</Text></Pressable></View></View>
    {accountOpen && <View style={styles.account}>{session ? <><Text style={styles.accountTitle}>{session.user.email}</Text><Pressable style={styles.authButton} onPress={() => supabase.auth.signOut()}><Text style={styles.authButtonText}>Sign out</Text></Pressable></> : <><Text style={styles.accountTitle}>Personalize your briefing</Text><Pressable style={styles.authButton} onPress={() => oauth("google")}><Text style={styles.authButtonText}>Continue with Google</Text></Pressable><Pressable style={styles.authButton} onPress={() => oauth("apple")}><Text style={styles.authButtonText}>Continue with Apple</Text></Pressable><TextInput style={styles.email} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" /><Pressable style={styles.authButton} onPress={magicLink}><Text style={styles.authButtonText}>Email me a sign-in link</Text></Pressable>{!authConfigured && <Text style={styles.warning}>Authentication awaits Supabase project credentials.</Text>}</>}</View>}
    {loading ? <ActivityIndicator color="#006d65" style={{ flex: 1 }} /> : <FlatList data={cards} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyMark}>ކ</Text><Text style={styles.emptyText}>No published stories yet.</Text></View>} renderItem={({ item, index }) => <View style={styles.card}>
      <View style={styles.visual}><Text style={styles.number}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.mark}>ކުރު</Text></View>
      <View style={styles.copy}><Text style={styles.meta}>{item.breaking ? "BREAKING · " : ""}{item.category ?? "MALDIVES"}</Text><Text style={[styles.title, language === "dv" && styles.rtl]}>{item.headline}</Text><Text style={[styles.summary, language === "dv" && styles.rtl]}>{item.summary}</Text>{item.sourceUrl && <Pressable onPress={() => Linking.openURL(item.sourceUrl!)}><Text style={styles.link}>Read at {item.source ?? "source"} ↗</Text></Pressable>}</View>
    </View>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F3EC" }, header: { paddingHorizontal: 22, paddingVertical: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#DADBD4" }, headerButtons: { flexDirection: "row", gap: 8 }, brand: { color: "#14231F", fontSize: 22, fontWeight: "700" }, tag: { color: "#66726E", fontSize: 11, marginTop: 2 }, language: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFEFA", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DADBD4" }, account: { padding: 18, gap: 9, backgroundColor: "#E4EFEB", borderBottomWidth: 1, borderColor: "#BDD1CA" }, accountTitle: { color: "#14231F", fontSize: 16, fontWeight: "700", marginBottom: 6 }, authButton: { minHeight: 42, borderRadius: 10, backgroundColor: "#14231F", alignItems: "center", justifyContent: "center" }, authButtonText: { color: "white", fontWeight: "700" }, email: { height: 42, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "white", borderWidth: 1, borderColor: "#DADBD4" }, warning: { color: "#A33120", fontSize: 11 }, list: { padding: 18, gap: 18 }, card: { overflow: "hidden", backgroundColor: "#FFFEFA", borderRadius: 24, borderWidth: 1, borderColor: "#DADBD4" }, visual: { height: 210, backgroundColor: "#168B85", padding: 20, justifyContent: "space-between" }, number: { color: "#D9EEE9", fontSize: 12 }, mark: { color: "white", fontSize: 58, fontWeight: "700", alignSelf: "center", marginBottom: 45 }, copy: { padding: 24 }, meta: { color: "#006D65", fontSize: 10, fontWeight: "700", marginBottom: 14 }, title: { color: "#14231F", fontSize: 28, fontWeight: "700", lineHeight: 32 }, summary: { color: "#46534F", fontSize: 15, lineHeight: 24, marginTop: 14 }, rtl: { writingDirection: "rtl", textAlign: "right" }, link: { color: "#006D65", fontSize: 12, fontWeight: "700", marginTop: 22 }, empty: { minHeight: 500, justifyContent: "center", alignItems: "center" }, emptyMark: { color: "#B9C8C3", fontSize: 64 }, emptyText: { color: "#66726E", marginTop: 10 },
});
