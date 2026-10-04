const p = Page("page-resume");
Header(p, "resume");
const c = Cont(p, { gap: 32 });
SecHead(c, "PLAYER PROFILE", "E-履歷 (E-Resume)", { lead: "以互動式的圖表、時序線以及動態標籤雲，呈現個人開發歷程與專業技能組合。" });
const cols = Row(c, { alignItems: "start" });
const L = Col(cols, 564), R = Col(cols, 564);
function RP(par, title, code, pop) { const k = F(par, Object.assign({ name: "resume-panel " + title, layout: "vertical", width: "fill_container", clip: true }, box(3, 18, "$surface-raised", 5))); const h = F(k, { name: "head", width: "fill_container", padding: [8, 20], justifyContent: "space_between", alignItems: "center", fill: pop ? "$pop" : "$surface-sunken", stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner" }); T(h, title, "hm", pop ? "$on-fill" : "$ink"); T(h, code, "pm", pop ? "$on-fill" : "$ink-muted"); return F(k, { name: "body", layout: "vertical", gap: 24, padding: 24, width: "fill_container" }); }
function Ring(par, pct, label, size, big, tagTone) {
  const w = F(par, { name: "ring " + label, layout: "vertical", gap: 6, alignItems: "center", width: "fill_container" });
  const r = F(w, { name: "r", width: size, height: size, layout: "none" });
  Insert(r, { type: "ellipse", name: "track", x: 0, y: 0, width: size, height: size, innerRadius: 0.82, fill: "$surface-sunken" });
  Insert(r, { type: "ellipse", name: "progress", x: 0, y: 0, width: size, height: size, innerRadius: 0.82, startAngle: 90, sweepAngle: -360 * pct / 100, fill: "$ink" });
  const t = F(r, { name: "pct", x: 0, y: 0, width: size, height: size, alignItems: "center", justifyContent: "center", layout: "vertical", gap: 4 }); T(t, pct + "%", big ? "pl" : "pm");
  if (tagTone) Tag(t, label, tagTone); else T(w, label, "cap", "$ink-muted");
  return w;
}
const ab = RP(L, "關於我 (About Me)", "P1", true);
const pr = F(ab, { name: "profile", gap: 24, width: "fill_container", alignItems: "start" });
const av = F(pr, Object.assign({ name: "avatar -rotate-3", width: 128, height: 128, rotation: 3, fill: "$sky", alignItems: "center", justifyContent: "center", clip: true }, box(4, 18, "$sky", 5))); T(av, "DK", "pxl", "$on-fill");
const pt = F(pr, { name: "t", layout: "vertical", gap: 10, width: "fill_container" });
const nr = F(pt, { name: "name", gap: 12, alignItems: "center" }); T(nr, "盧宏寶", "hl"); I(nr, "award", 20);
Pill(pt, "Open to Work / 歡迎聯繫", "success"); T(pt, "SENIOR FRONTEND ARCHITECT", "pm", "$ink-muted");
TW(ab, "擁有超過 13 年資訊相關經驗，其中 10 年以上專注於前端開發與系統架構設計。熟悉 Vue、React、Nuxt、Next.js 等主流框架，參與過大型 B2B / B2C 平台、財務系統與遊戲平台開發，並擔任技術帶領角色，負責程式碼審查與新人培訓。", "b");
const rg = F(ab, Object.assign({ name: "能力環", width: "fill_container", padding: 16, gap: 12 }, box(3, 14, "$surface")));
[[95, "前端架構"], [90, "介面互動"], [88, "效能優化"], [92, "AI 協作開發"]].forEach(([a, b]) => Ring(rg, a, b, 72));
const ig = F(ab, { name: "資訊四格", layout: "vertical", gap: 12, width: "fill_container" });
[[["user", "sky", "CLASS", "資深前端工程師"], ["calendar", "mint", "LEVEL", "13+ 年資歷"]], [["mail", "pink", "EMAIL", "dk880842@gmail.com", 1], ["map-pin", "pop", "LOCATION", "台灣高雄市"]]].forEach((row) => {
  const rr = F(ig, { name: "r", gap: 12, width: "fill_container" });
  row.forEach(([ic, tn, k, v, link]) => { const t = F(rr, Object.assign({ name: "tile " + k, gap: 12, padding: 12, alignItems: "center", width: "fill_container" }, box(3, 14, "$surface", link ? 3 : 0))); IBox(t, ic, tn); const tt = F(t, { name: "t", layout: "vertical", gap: 2, width: "fill_container" }); const kk = F(tt, { name: "k", gap: 4, alignItems: "center" }); T(kk, k, "pm", "$ink-muted"); if (link) I(kk, "arrow-up-right", 16); T(tt, v, "lab"); });
});
const hi = RP(L, "經歷", "LOG");
const tl = F(hi, { name: "resume-timeline", layout: "vertical", gap: 12, width: "fill_container", padding: [0, 0, 0, 8], stroke: "$line", strokeWidth: { left: 3 }, strokeAlignment: "inner" });
[["中華系統整合股份有限公司", "資深前端工程師", "2022-2025"], ["光曳資訊有限公司", "資深前端工程師", "2017-2022"], ["中冠資訊股份有限公司", "前端工程師", "2016-2017"], ["台灣惠多笑有限公司", "前端工程師", "2013-2016"]].forEach(([a, b, y], i) => {
  const it = F(tl, { name: "item", gap: 16, alignItems: "center", width: "fill_container" });
  Insert(it, { type: "ellipse", name: "dot", width: 20, height: 20, fill: i === 0 ? "$pop" : "$surface-raised", stroke: "$line", strokeWidth: 3, strokeAlignment: "inner" });
  const cd = F(it, Object.assign({ name: "card", layout: "vertical", gap: 4, padding: 16, width: "fill_container" }, box(3, 14, "$surface"))); T(cd, a, "lab"); T(cd, b, "bs", "$ink-muted"); Tag(cd, y, "plain", "s", { pixel: true });
});
T(hi, "…其餘 3 筆同樣式", "cap", "$ink-muted");
const au = RP(R, "人物介紹", "BIO");
["個性率真不做作，平常喜歡聽聽音樂哼哼歌、玩玩遊戲、吸收新知等來紓解壓力，不喜歡拖泥帶水的事情纏身。", "以 JavaScript / TypeScript 為核心，跨足前端架構、後端服務與網頁遊戲開發，並運用 Docker、Nginx、CI/CD 等工具確保開發與部署的穩定性。", "長期維持 Side Project 開發習慣，涵蓋 Web3、遊戲資料分析、自動化 Bot、量化交易與 Firebase 即時應用，持續將新技術實踐於實際產品中。", "近兩年積極投入 AI 輔助開發，熟悉 Claude Code、Codex CLI、Copilot 等工具，運用 AI Agent Workflow 與 Vibe Coding 加速產品原型驗證與系統建置。"].forEach((t, i) => { const r = F(au, { name: "p", gap: 16, width: "fill_container" }); T(r, "0" + (i + 1), "pm", "$ink-muted"); TW(r, t, "b"); });
const stt = RP(R, "狀態", "STATS");
const sg = F(stt, { name: "grid", layout: "vertical", gap: 16, width: "fill_container" });
[[[92, "Vue", "mint"], [85, "React", "sky"], [82, "TypeScript", "pink"]], [[88, "HTML / CSS", "pink"], [90, "Javascript", "mint"], [90, "AI 協作", "sky"]]].forEach((row) => { const r = F(sg, { name: "r", gap: 16, width: "fill_container" }); row.forEach(([a, b, t]) => Ring(r, a, b, 120, true, t)); });
const sk = RP(R, "技能", "SKILLS");
const cl = F(sk, { name: "cloud", layout: "vertical", gap: 12, width: "fill_container", alignItems: "center" });
const rows = [[["Vue2 / Vue3", 6], ["React", 6], ["TypeScript", 6]], [["JavaScript (ES6+)", 6], ["Claude Code", 6], ["Nuxt.js", 4], ["Next.js", 4]], [["Pinia", 4], ["Vuex", 4], ["TailwindCSS", 4], ["Vite", 4], ["Webpack", 4], ["Node.js", 4]], [["SSR / SPA", 4], ["Micro Frontend", 4], ["AI Agent Workflow", 4], ["Codex CLI", 3]], [["HTML", 3], ["CSS / Sass", 3], ["Docker", 3], ["Nginx", 3], ["Git", 3], ["效能優化", 3]]];
let k = 0; rows.forEach((row) => { const r = F(cl, { name: "r", gap: 12, alignItems: "center" }); row.forEach(([t, w]) => { if (w === 6) Tag(r, t, "pop", "l"); else if (w === 4) Tag(r, t, ["sky", "mint", "pink"][k++ % 3]); else Tag(r, t, "plain"); }); });
Footer(p);
