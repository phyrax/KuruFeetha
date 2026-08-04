"use client";

import { useMemo, useState } from "react";

type Language = "en" | "dv";
type View = "feed" | "saved" | "editorial";

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
  const rtl = language === "dv";

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

  if (view === "editorial") {
    return <EditorialDesk language={language} onBack={() => setView("feed")} />;
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
          <button className="avatar" onClick={() => notify("Account sign-in is ready to connect")}>HF</button>
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
        <button onClick={() => setView("editorial")}><span>✦</span>{copy.editorial}</button>
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function EditorialDesk({ language, onBack }: { language: Language; onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const rtl = language === "dv";
  return (
    <main className="editorial-shell" dir={rtl ? "rtl" : "ltr"}>
      <aside className="editorial-nav">
        <button className="brand inverted" onClick={onBack}><span className="brand-mark">ކ</span><span><strong>KuruFeetha</strong><small>Editorial desk</small></span></button>
        <p className="nav-label">WORKSPACE</p>
        <button className="nav-item active">▦ Review queue <span>12</span></button>
        <button className="nav-item">⚡ Breaking <span>3</span></button>
        <button className="nav-item">◎ Sources</button>
        <button className="nav-item">▣ Campaigns</button>
        <button className="nav-item">⌁ Audit log</button>
        <div className="editor-profile"><span>HF</span><div><strong>Hussain Firaz</strong><small>Administrator</small></div></div>
      </aside>
      <section className="editorial-main">
        <header className="desk-header"><div><p className="eyebrow">EDITORIAL WORKSPACE</p><h1>Review queue</h1></div><button className="secondary" onClick={onBack}>View live site ↗</button></header>
        <section className="ingest-panel">
          <div><span className="spark">✦</span><div><h2>Turn an article into a news card</h2><p>Paste a URL. Kuru AI will extract, cluster and prepare both language drafts.</p></div></div>
          <form onSubmit={(event) => { event.preventDefault(); if (url) setSubmitted(true); }}>
            <input type="url" required value={url} onChange={(event) => { setUrl(event.target.value); setSubmitted(false); }} placeholder="https://news-source.mv/article…" />
            <button type="submit">{submitted ? "Added to queue ✓" : "Generate draft"}</button>
          </form>
        </section>
        <div className="queue-toolbar"><div className="tabs"><button className="active">Needs review <span>12</span></button><button>In progress <span>4</span></button><button>Scheduled</button></div><button className="filter">☷ Filters</button></div>
        <div className="queue-list">
          <QueueItem urgent source="Mihaaru" time="8 min ago" title="Harbour project enters final phase" confidence="94%" />
          <QueueItem source="Sun" time="31 min ago" title="Community survey records coral recovery" confidence="91%" />
          <QueueItem source="ThePress" time="52 min ago" title="New SME support programme announced" confidence="87%" />
        </div>
      </section>
    </main>
  );
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
