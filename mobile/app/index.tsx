import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, I18nManager, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

type Language = "en" | "dv";
type Card = { id: string; headline: string; summary: string; source?: string; sourceUrl?: string; category?: string; breaking?: boolean };
const API_URL = String(Constants.expoConfig?.extra?.apiUrl ?? "https://kurufeetha-maldives.hussainfiraz.chatgpt.site");

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

async function registerPush(language: Language) {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || projectId === "REPLACE_WITH_EAS_PROJECT_ID") return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await fetch(`${API_URL}/api/v1/notifications/subscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, platform: "ios", language, topics: ["breaking"] }) });
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/feed?language=${language}`).then((response) => response.json()).then((result) => setCards(result.items ?? [])).finally(() => setLoading(false));
  }, [language]);
  useEffect(() => { registerPush(language).catch(() => undefined); }, [language]);
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><View><Text style={styles.brand}>KuruFeetha</Text><Text style={styles.tag}>Maldives, in brief.</Text></View><Pressable style={styles.language} onPress={() => setLanguage(language === "en" ? "dv" : "en")}><Text>{language === "en" ? "ދި" : "EN"}</Text></Pressable></View>
    {loading ? <ActivityIndicator color="#006d65" style={{ flex: 1 }} /> : <FlatList data={cards} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyMark}>ކ</Text><Text style={styles.emptyText}>No published stories yet.</Text></View>} renderItem={({ item, index }) => <View style={styles.card}>
      <View style={styles.visual}><Text style={styles.number}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.mark}>ކުރު</Text></View>
      <View style={styles.copy}><Text style={styles.meta}>{item.breaking ? "BREAKING · " : ""}{item.category ?? "MALDIVES"}</Text><Text style={[styles.title, language === "dv" && styles.rtl]}>{item.headline}</Text><Text style={[styles.summary, language === "dv" && styles.rtl]}>{item.summary}</Text>{item.sourceUrl && <Pressable onPress={() => Linking.openURL(item.sourceUrl!)}><Text style={styles.link}>Read at {item.source ?? "source"} ↗</Text></Pressable>}</View>
    </View>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F3EC" }, header: { paddingHorizontal: 22, paddingVertical: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#DADBD4" }, brand: { color: "#14231F", fontSize: 22, fontWeight: "700" }, tag: { color: "#66726E", fontSize: 11, marginTop: 2 }, language: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFEFA", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DADBD4" }, list: { padding: 18, gap: 18 }, card: { overflow: "hidden", backgroundColor: "#FFFEFA", borderRadius: 24, borderWidth: 1, borderColor: "#DADBD4" }, visual: { height: 210, backgroundColor: "#168B85", padding: 20, justifyContent: "space-between" }, number: { color: "#D9EEE9", fontSize: 12 }, mark: { color: "white", fontSize: 58, fontWeight: "700", alignSelf: "center", marginBottom: 45 }, copy: { padding: 24 }, meta: { color: "#006D65", fontSize: 10, fontWeight: "700", marginBottom: 14 }, title: { color: "#14231F", fontSize: 28, fontWeight: "700", lineHeight: 32 }, summary: { color: "#46534F", fontSize: 15, lineHeight: 24, marginTop: 14 }, rtl: { writingDirection: "rtl", textAlign: "right" }, link: { color: "#006D65", fontSize: 12, fontWeight: "700", marginTop: 22 }, empty: { minHeight: 500, justifyContent: "center", alignItems: "center" }, emptyMark: { color: "#B9C8C3", fontSize: 64 }, emptyText: { color: "#66726E", marginTop: 10 },
});
