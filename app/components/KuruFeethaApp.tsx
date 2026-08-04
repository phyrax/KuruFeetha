"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase-client";

type Language = "en" | "dv";
type View = "feed" | "saved" | "editorial";
type Profile = { id: string; email: string; displayName: string | null; role: "reader" | "admin" | "owner"; preferredLanguage: Language; onboardingCompletedAt: number | null };
type Category = { id: string; slug: string; nameEn: string; nameDv: string };

type Story = {
  id: string;
  category: string;
  time: string;
  source: string;
  sourceUrl: string;
  image: string;
  breaking?: boolean;
  sponsored?: boolean;
  title: Record<Language, string>;
  summary: Record<Language, string>;
};

const stories: Story[] = [
  {
    id: "harbour",
    category: "Maldives",
    time: "18 min ago",
    source: "Mihaaru",
    sourceUrl: "https://mihaaru.com",
    image: "linear-gradient(145deg, #84d7d0 0%, #e7f2d5 48%, #f0b77f 100%)",
    breaking: true,
    title: {
      en: "New harbour project moves into its final construction phase",
      dv: "އާ ބަނދަރުގެ މަޝްރޫޢު ނިމޭ ފިޔަވަހިއަށް",
    },
    summary: {
      en: "Construction on the island harbour has entered its final phase, with breakwater and quay-wall work now complete. Officials say dredging and utility connections remain before the harbour can open. The project is intended to improve passenger safety and make essential supplies more reliable during rough weather.",
      dv: "ރަށުގެ ބަނދަރު އެޅުމުގެ މަޝްރޫޢު ނިމޭ ފިޔަވަހިއަށް ވަނީ ވަންނަމުންނެވެ. އެތެރެފަރާތު ކޮނުމާއި ޔުޓިލިޓީ ގުޅުންތައް ނިމުމުން ބަނދަރު ހުޅުވާލާނެ ކަމަށް މަޤާމުތަކުން ބުނެފިއެވެ.",
    },
  },
  {
    id: "reef",
    category: "Environment",
    time: "1 hr ago",
    source: "Sun",
    sourceUrl: "https://sun.mv",
    image: "linear-gradient(160deg, #063f4c 0%, #12899b 47%, #edcf92 48%, #f5eee0 100%)",
    title: {
      en: "Community reef survey records encouraging coral recovery",
      dv: "ރަށްވެހިންގެ މުރާކާގައި ހިރު އަލުން އުފެދޭކަން ފެނިއްޖެ",
    },
    summary: {
      en: "A community-led reef survey has documented new coral growth at several monitored sites. Marine biologists called the signs encouraging but warned that warmer seas still pose a serious risk. Residents will repeat the survey every three months and share the results with national conservation teams.",
      dv: "ރަށްވެހިން ކުރިއަށް ގެންދާ މުރާކާއެއްގައި ބެލި ތަންތަނުގައި އާ ހިރު އުފެދޭކަން ފެނިއްޖެއެވެ. މޫދުގެ ހޫނުމިން އަދިވެސް ބޮޑު ނުރައްކަލެއް ކަމަށް މާހިރުން އަންގައިފިއެވެ.",
    },
  },
  {
    id: "bank",
    category: "Business",
    time: "2 hrs ago",
    source: "Bank of Maldives",
    sourceUrl: "https://www.bankofmaldives.com.mv",
    image: "linear-gradient(135deg, #f8dd98, #f4a56f 52%, #b64545)",
    sponsored: true,
    title: {
      en: "A simpler way for small businesses to get paid",
      dv: "ކުދި ވިޔަފާރިތަކަށް ފައިސާ ހޯދުމުގެ ފަސޭހަ މަގެއް",
    },
    summary: {
      en: "Accept secure digital payments from customers across the Maldives. New merchant tools provide quick setup, daily sales insights and direct settlement to your business account.",
      dv: "ދިވެހިރާއްޖޭގެ ކޮންމެ ކަންކޮޅަކުން ކަސްޓަމަރުންގެ ޑިޖިޓަލް ފައިސާ ފަސޭހައިން ބަލައިގަންނާށެވެ. އާ މާޗަންޓް ޓޫލްތަކުން ދުވަހުގެ ވިއްކުން ބެލިދާނެއެވެ.",
    },
  },
];

const categories = ["For you", "Maldives", "Politics", "Business", "World", "Sports", "Lifestyle"];

export function KuruFeethaApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("feed");
  const [category, setCategory] = useState("For you");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>(["reef"]);
  const [toast, setToast] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [categoriesAvailable, setCategoriesAvailable] = useState<Category[]>([]);
  const [follows, setFollows] = useState<string[]>([]);
  const rtl = language === "dv";
  const token = session?.access_token;

  useEffect(() => {
    let active = true;
    getSupabaseClient().then(async (client) => {
      if (!client || !active) return;
      const { data } = await client.auth.getSession();
      setSession(data.session);
      const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next));
      return () => listener.subscription.unsubscribe();
    });
    fetch("/api/v1/categories").then((response) => response.json()).then((data) => setCategoriesAvailable(data.items ?? [])).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) { setProfile(null); setFollows([]); return; }
    fetch("/api/v1/me", { headers: { authorization: `Bearer ${token}` } }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error?.message ?? "Could not load account");
      return response.json();
    }).then((data) => {
      setProfile(data.user); setFollows(data.followedCategoryIds ?? []);
      setLanguage(data.user.preferredLanguage);
      if (!data.user.onboardingCompletedAt) setAccountOpen(true);
    }).catch((error) => notify(error.message));
  }, [token]);

  const visible = useMemo(() => stories.filter((story) => {
    if (view === "saved" && !saved.includes(story.id)) return false;
    if (category !== "For you" && story.category !== category) return false;
    const text = `${story.title[language]} ${story.summary[language]} ${story.source}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [category, language, query, saved, view]);

  const copy = {
    en: { tagline: "Maldives, in brief.", search: "Search the news", latest: "Today’s briefing", saved: "Saved", editorial: "Editorial", read: "Read full story", empty: "No stories match this view." },
    dv: { tagline: "ދިވެހިރާއްޖެ، ކުރުކޮށް.", search: "ޚަބަރު ހޯދާ", latest: "މިއަދުގެ ޚުލާޞާ", saved: "ސޭވްކުރި", editorial: "އެޑިޓޯރިއަލް", read: "މުޅި ޚަބަރު ކިޔާ", empty: "މި ބައިގައި ޚަބަރެއް ނެތް." },
  }[language];

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  if (view === "editorial" && profile && (profile.role === "admin" || profile.role === "owner")) {
    return <EditorialDesk language={language} profile={profile} token={token!} onBack={() => setView("feed")} />;
  }

  return (
    <main className="app-shell" dir={rtl ? "rtl" : "ltr"}>
      <header className="topbar">
        <button className="brand" onClick={() => setView("feed")} aria-label="KuruFeetha home">
          <span className="brand-mark">ކ</span>
          <span><strong>KuruFeetha</strong><small>{copy.tagline}</small></span>
        </button>
        <div className="header-actions">
          <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} /></label>
          <button className="language-switch" onClick={() => setLanguage(rtl ? "en" : "dv")}>{rtl ? "EN" : "ދި"}</button>
          <button className="avatar" onClick={() => setAccountOpen(true)} aria-label={profile ? "Open account" : "Sign in"}>{profile?.displayName?.slice(0, 2).toUpperCase() || "IN"}</button>
        </div>
      </header>

      <nav className="category-rail" aria-label="News categories">
        {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
      </nav>

      <section className="feed-head">
        <div><p className="eyebrow">Tuesday · 04 August</p><h1>{view === "saved" ? copy.saved : copy.latest}</h1></div>
        <span className="story-count">{visible.length} {rtl ? "ޚަބަރު" : "stories"}</span>
      </section>

      <section className="story-feed" aria-live="polite">
        {visible.map((story, index) => (
          <article className={`story-card ${story.sponsored ? "sponsored" : ""}`} key={story.id}>
            <div className="story-visual" style={{ background: story.image }}>
              <span className="visual-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="visual-watermark">ކުރު</div>
            </div>
            <div className="story-content">
              <div className="story-meta">
                <span className={`pill ${story.breaking ? "breaking" : ""}`}>{story.sponsored ? (rtl ? "ސްޕޮންސަރޑް" : "Sponsored") : story.breaking ? (rtl ? "މުހިންމު" : "Breaking") : story.category}</span>
                <span>{story.time}</span>
              </div>
              <h2>{story.title[language]}</h2>
              <p className="summary">{story.summary[language]}</p>
              <div className="story-footer">
                <a href={story.sourceUrl} target="_blank" rel="noreferrer"><span>{story.source}</span><strong>{copy.read} ↗</strong></a>
                <div className="card-actions">
                  <button onClick={() => notify(rtl ? "ޝެއަރ ލިންކް ކޮޕީވެއްޖެ" : "Share link copied")} aria-label="Share story">↗</button>
                  <button className={saved.includes(story.id) ? "selected" : ""} onClick={() => toggleSaved(story.id)} aria-label="Save story">{saved.includes(story.id) ? "◆" : "◇"}</button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!visible.length && <div className="empty-state"><span>ކ</span><p>{copy.empty}</p></div>}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}><span>◉</span>{rtl ? "ޚަބަރު" : "Briefing"}</button>
        <button className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}><span>◇</span>{copy.saved}</button>
        {profile && profile.role !== "reader" && <button onClick={() => setView("editorial")}><span>✦</span>{copy.editorial}</button>}
        <button onClick={() => setAccountOpen(true)}><span>○</span>{profile ? (rtl ? "އެކައުންޓް" : "Account") : (rtl ? "ސައިން އިން" : "Sign in")}</button>
      </nav>
      {accountOpen && <AccountPanel session={session} profile={profile} categories={categoriesAvailable} follows={follows} language={language} onFollows={setFollows} onClose={() => setAccountOpen(false)} onProfile={setProfile} notify={notify} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function EditorialDesk({ language, profile, token, onBack }: { language: Language; profile: Profile; token: string; onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<"queue" | "users">("queue");
  const rtl = language === "dv";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage("Extracting article and generating bilingual drafts…");
    const response = await fetch("/api/v1/admin/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID(), authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });
    const result = await response.json() as { status?: string; duplicate?: boolean; error?: { message?: string } };
    if (!response.ok) {
      setStatus("error");
      setMessage(result.error?.message ?? "Could not ingest this article");
      return;
    }
    setStatus("done");
    setMessage(result.duplicate ? "This article is already in the newsroom." : "Bilingual draft created and added to the review queue.");
  }
  return (
    <main className="editorial-shell" dir={rtl ? "rtl" : "ltr"}>
      <aside className="editorial-nav">
        <button className="brand inverted" onClick={onBack}><span className="brand-mark">ކ</span><span><strong>KuruFeetha</strong><small>Editorial desk</small></span></button>
        <p className="nav-label">WORKSPACE</p>
        <button className={`nav-item ${section === "queue" ? "active" : ""}`} onClick={() => setSection("queue")}>▦ Review queue <span>12</span></button>
        <button className="nav-item">⚡ Breaking <span>3</span></button>
        <button className="nav-item">◎ Sources</button>
        <button className="nav-item">▣ Campaigns</button>
        <button className="nav-item">⌁ Audit log</button>
        <button className={`nav-item ${section === "users" ? "active" : ""}`} onClick={() => setSection("users")}>○ Users</button>
        <div className="editor-profile"><span>{profile.displayName?.slice(0, 2).toUpperCase() || "AD"}</span><div><strong>{profile.displayName || profile.email}</strong><small>{profile.role}</small></div></div>
      </aside>
      <section className="editorial-main">
        {section === "users" ? <UserManagement token={token} actor={profile} /> : <>
        <header className="desk-header"><div><p className="eyebrow">EDITORIAL WORKSPACE</p><h1>Review queue</h1></div><button className="secondary" onClick={onBack}>View live site ↗</button></header>
        <section className="ingest-panel">
          <div><span className="spark">✦</span><div><h2>Turn an article into a news card</h2><p>Paste a URL. Kuru AI will extract, cluster and prepare both language drafts.</p></div></div>
          <form onSubmit={submit}>
            <input type="url" required value={url} onChange={(event) => { setUrl(event.target.value); setStatus("idle"); setMessage(""); }} placeholder="https://news-source.mv/article…" />
            <button type="submit" disabled={status === "working"}>{status === "working" ? "Generating…" : status === "done" ? "Added to queue ✓" : "Generate draft"}</button>
          </form>
          {message && <p className={`ingest-status ${status}`}>{message}</p>}
        </section>
        <div className="queue-toolbar"><div className="tabs"><button className="active">Needs review <span>12</span></button><button>In progress <span>4</span></button><button>Scheduled</button></div><button className="filter">☷ Filters</button></div>
        <div className="queue-list">
          <QueueItem urgent source="Mihaaru" time="8 min ago" title="Harbour project enters final phase" confidence="94%" />
          <QueueItem source="Sun" time="31 min ago" title="Community survey records coral recovery" confidence="91%" />
          <QueueItem source="ThePress" time="52 min ago" title="New SME support programme announced" confidence="87%" />
        </div>
        </>}
      </section>
    </main>
  );
}

type ManagedUser = { id: string; email: string; displayName: string | null; role: Profile["role"]; status: "active" | "suspended"; createdAt: number; lastActiveAt: number };
function UserManagement({ token, actor }: { token: string; actor: Profile }) {
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch(`/api/v1/admin/users?search=${encodeURIComponent(search)}`, { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json(); if (response.ok) setItems(data.items ?? []); else setError(data.error?.message ?? "Could not load users");
  }
  useEffect(() => { load(); }, []);
  async function update(user: ManagedUser, change: { role?: "reader" | "admin"; status?: "active" | "suspended" }) {
    const response = await fetch(`/api/v1/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(change) });
    const data = await response.json(); if (!response.ok) setError(data.error?.message ?? "Update failed"); else load();
  }
  return <><header className="desk-header"><div><p className="eyebrow">ADMINISTRATION</p><h1>User management</h1></div></header>
    <div className="user-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Search name or email" /><button onClick={load}>Search</button></div>
    {error && <p className="ingest-status error">{error}</p>}
    <div className="user-list">{items.map((user) => <article className="user-row" key={user.id}><div><strong>{user.displayName || user.email}</strong><small>{user.email} · {user.role} · {user.status}</small></div><div>
      {user.role === "reader" && actor.role === "owner" && <button onClick={() => update(user, { role: "admin" })}>Promote</button>}
      {user.role === "admin" && actor.role === "owner" && <button onClick={() => update(user, { role: "reader" })}>Demote</button>}
      {user.role === "reader" && <button onClick={() => update(user, { status: user.status === "active" ? "suspended" : "active" })}>{user.status === "active" ? "Suspend" : "Restore"}</button>}
    </div></article>)}</div></>;
}

function QueueItem({ source, time, title, confidence, urgent }: { source: string; time: string; title: string; confidence: string; urgent?: boolean }) {
  const [state, setState] = useState("Review");
  return (
    <article className="queue-item">
      <div className="source-token">{source.slice(0, 1)}</div>
      <div className="queue-copy"><div><span>{source}</span><span>·</span><span>{time}</span>{urgent && <span className="urgent">BREAKING</span>}</div><h3>{title}</h3><p>English + ދިވެހި · 2 source articles · AI confidence {confidence}</p></div>
      <div className="queue-actions"><button className={state === "Approved" ? "approved" : ""} onClick={() => setState(state === "Approved" ? "Review" : "Approved")}>{state === "Approved" ? "Approved ✓" : "Review →"}</button></div>
    </article>
  );
}

function AccountPanel({ session, profile, categories, follows, language, onFollows, onClose, onProfile, notify }: {
  session: Session | null; profile: Profile | null; categories: Category[]; follows: string[]; language: Language;
  onFollows: (ids: string[]) => void; onClose: () => void; onProfile: (profile: Profile | null) => void; notify: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const token = session?.access_token;
  async function signIn(provider?: "google" | "apple") {
    const client = await getSupabaseClient();
    if (!client) { notify("Sign-in is awaiting Supabase configuration."); return; }
    setBusy(true);
    if (provider) await client.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    else {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      notify(error ? error.message : "Check your email for the secure sign-in link.");
      setBusy(false);
    }
  }
  async function saveFollows() {
    if (!token) return;
    setBusy(true);
    const response = await fetch("/api/v1/me/categories", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ categoryIds: follows }) });
    const data = await response.json();
    if (response.ok) { onProfile(data.user); notify("Preferences saved."); onClose(); } else notify(data.error?.message ?? "Could not save preferences");
    setBusy(false);
  }
  async function signOut() { const client = await getSupabaseClient(); await client?.auth.signOut(); onProfile(null); onClose(); }
  async function deleteAccount() {
    if (!token || !confirm("Permanently delete your KuruFeetha account and synchronized preferences?")) return;
    const response = await fetch("/api/v1/me", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return notify(data.error?.message ?? "Could not delete account");
    await (await getSupabaseClient())?.auth.signOut(); onProfile(null); onClose();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="account-panel" role="dialog" aria-modal="true" aria-label="Account" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>×</button>
      {!profile ? <>
        <p className="eyebrow">KURUFEETHA ACCOUNT</p><h2>Sign in to personalize your briefing</h2>
        <p>Follow topics, synchronize bookmarks, and manage notifications across web and mobile.</p>
        <div className="oauth-row"><button onClick={() => signIn("google")}>Continue with Google</button><button onClick={() => signIn("apple")}>Continue with Apple</button></div>
        <div className="email-signin"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button disabled={!email || busy} onClick={() => signIn()}>Email me a link</button></div>
      </> : <>
        <p className="eyebrow">{profile.role.toUpperCase()} ACCOUNT</p><h2>{profile.displayName || profile.email}</h2><p>{profile.email}</p>
        <h3>Topics you follow</h3><p>Followed topics appear first, after breaking and pinned stories. Other fresh news remains in your feed.</p>
        <div className="preference-grid">{categories.map((item) => <label key={item.id}><input type="checkbox" checked={follows.includes(item.id)} onChange={() => onFollows(follows.includes(item.id) ? follows.filter((id) => id !== item.id) : [...follows, item.id])} /> {language === "dv" ? item.nameDv : item.nameEn}</label>)}</div>
        <button className="primary-action" disabled={busy} onClick={saveFollows}>{profile.onboardingCompletedAt ? "Save preferences" : "Finish setup"}</button>
        <div className="account-actions"><button onClick={signOut}>Sign out</button>{profile.role !== "owner" && <button className="danger" onClick={deleteAccount}>Delete account</button>}</div>
      </>}
    </section>
  </div>;
}
