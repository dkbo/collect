const p = Page("page-search");
Header(p, "tools");
const c = Cont(p, { gap: 32 });
SecHead(c, "SEARCH", "外部查詢 (External Search)", { lead: "輸入關鍵字，即可透過 API 同步檢索 GitHub 熱門開源倉庫與 Wikipedia 中文維基百科條目。" });
const sb = F(c, { name: "search", layout: "vertical", gap: 12, width: 672 });
const si = F(sb, Object.assign({ name: "tb-input h-13", height: 52, padding: [0, 8, 0, 16], gap: 12, alignItems: "center", width: "fill_container" }, box(3, 14, "$surface-raised")));
I(si, "search", 20); TW(si, "React", "bl", "$ink"); IBtn(si, "x", { z: 36 });
const sg = F(sb, { name: "推薦", gap: 8, alignItems: "center" }); T(sg, "推薦探索:", "cap", "$ink-muted");
["React", "TypeScript", "Vite", "Tailwind", "Zustand", "CSS"].forEach((w) => { const b = F(sg, Object.assign({ name: "kw " + w, height: 44, padding: [0, 16], alignItems: "center" }, box(2, 8, "$surface-raised", 3))); T(b, w, "cap"); });
const g = Row(c, { gap: 32, alignItems: "start" });
function ColHead(par, ic, tone, t, s) { const h = F(par, { name: "欄頭", gap: 12, alignItems: "center", width: "fill_container", padding: [0, 0, 12, 0], stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner" }); IBox(h, ic, tone); const tt = F(h, { name: "t", layout: "vertical", gap: 2 }); T(tt, t, "hm"); T(tt, s, "cap", "$ink-muted"); }
const L = Col(g, 560), R = Col(g, 560);
ColHead(L, "github", "pop", "GitHub 開源倉庫", "按星數 (Stars) 排序的前 10 項專案");
[["facebook/react", "JavaScript", "The library for web and native user interfaces.", "236k", "48.9k"], ["vercel/next.js", "JavaScript", "The React Framework", "131k", "28.2k"], ["facebook/create-react-app", "JavaScript", "Set up a modern web app by running one command.", "103k", "26.9k"]].forEach(([n, l, d, s, f]) => {
  const k = Panel(L, { name: "結果卡", p: 20, gap: 8 });
  const t = F(k, { name: "t", width: "fill_container", justifyContent: "space_between", alignItems: "start", gap: 8 }); T(t, n, "hm", "$ink", { underline: true }); Tag(t, l, "sky");
  TW(k, d, "bs", "$ink-muted");
  const m = F(k, { name: "meta", gap: 16, alignItems: "center" }); I(m, "star", 16, "$ink-muted"); T(m, s, "pm", "$ink-muted"); I(m, "git-fork", 16, "$ink-muted"); T(m, f, "pm", "$ink-muted");
});
ColHead(R, "book-open", "sky", "維基百科條目", "Wikipedia 中文百科前 10 項開放資料");
[["React", "React（也稱為 React.js 或 ReactJS）是一個自由及開放原始碼的前端 JavaScript 工具庫，用於基於 UI 元件構建使用者介面。"], ["React Native", "React Native 是一個開源的 UI 軟體框架，由 Meta 建立。"]].forEach(([t, d], i) => {
  const k = Panel(R, { name: "結果卡", p: 20, gap: 8 }); const h = F(k, { name: "t", gap: 12, alignItems: "center" }); T(h, "0" + (i + 1), "pm", "$ink-muted"); T(h, t, "hm", "$ink", { underline: true }); TW(k, d, "bs", "$ink-muted");
});
Note(R, "載入骨架");
const sk = Panel(R, { name: "骨架", p: 20, gap: 10 }); ["50%", "fill_container", "66%"].forEach((w, i) => F(sk, { name: "bar", width: i === 1 ? "fill_container" : (i === 0 ? 260 : 340), height: i === 0 ? 16 : 12, cornerRadius: 8, fill: "$surface-sunken" }));
Alert(R, "error", "檢索失敗：Network Error");
Note(c, "歡迎狀態（無關鍵字）");
const wl = Panel(c, { name: "welcome", w: 448, gap: 12, ex: { alignItems: "center" } }); IBox(wl, "globe", "sky"); T(wl, "等待搜尋中", "hm"); TW(wl, "請在上方搜尋欄輸入任何感興趣的單字，或是點選推薦探索的標籤。", "bs", "$ink-muted", "fill_container", { textAlign: "center" });
Footer(p);
