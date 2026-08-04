export async function sendExpoPush(tokens: string[], notification: { title: string; body: string; data?: Record<string, unknown> }, accessToken?: string) {
  const expoTokens = tokens.filter((token) => token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
  if (!expoTokens.length) return { sent: 0 };
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(expoTokens.map((to) => ({ to, sound: "default", title: notification.title, body: notification.body, data: notification.data ?? {} }))),
  });
  if (!response.ok) throw new Error(`Expo Push returned ${response.status}`);
  return { sent: expoTokens.length, result: await response.json() };
}
