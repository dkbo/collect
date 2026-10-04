const IMG = "../../../../public/";
const TY = {
  dxl: ["Rubik", "900", 76, 82], dl: ["Rubik", "900", 48, 53], dlm: ["Rubik", "900", 34, 40], hl: ["Rubik", "900", 36, 44], hlm: ["Rubik", "900", 26, 34],
  hm: ["Rubik", "900", 22, 30], btn: ["Rubik", "900", 16, 20], btns: ["Rubik", "900", 15, 20],
  bl: ["Noto Sans TC", "500", 17, 30], b: ["Noto Sans TC", "500", 16, 28], bs: ["Noto Sans TC", "500", 14, 24],
  lab: ["Noto Sans TC", "700", 15, 20], cap: ["Noto Sans TC", "700", 13, 18],
  pxl: ["VT323", "400", 46, 42], pl: ["VT323", "400", 30, 32], pm: ["VT323", "400", 22, 24],
};
const SH = (s, c) => ({ type: "shadow", shadowType: "outer", offset: { x: s, y: s }, blur: 0, spread: 0, color: c || "$ink" });
function box(bw, r, fill, sh, shc) {
  const o = { cornerRadius: r, fill: fill };
  if (bw) { o.stroke = "$line"; o.strokeWidth = bw; o.strokeAlignment = "inner"; }
  if (sh) o.effect = SH(sh, shc);
  return o;
}
function F(par, o) { return Insert(par, Object.assign({ type: "frame", name: "frame" }, o)); }
function T(par, txt, ty, fill, ex) {
  const t = TY[ty];
  return Insert(par, Object.assign({ type: "text", name: String(txt).slice(0, 24), content: String(txt), fontFamily: t[0], fontWeight: t[1], fontSize: t[2], lineHeight: t[3] / t[2], fill: fill || "$ink" }, ex || {}));
}
function TW(par, txt, ty, fill, w, ex) { return T(par, txt, ty, fill, Object.assign({ textGrowth: "fixed-width", width: w || "fill_container" }, ex || {})); }
function I(par, icon, size, fill) { return Insert(par, { type: "icon", name: "icon " + icon, library: "lucide", icon: icon, width: size || 20, height: size || 20, fill: fill || "$ink" }); }
function Img(par, path, w, h, ex) { return F(par, Object.assign({ name: "img " + path, width: w, height: h, fill: { type: "image", url: IMG + path, mode: "fill" } }, ex || {})); }
const BG = { primary: "$action", secondary: "$surface-raised", pop: "$pop", ink: "$inverse" };
const FG = { primary: "$on-fill", secondary: "$ink", pop: "$on-fill", ink: "$pop" };
function Btn(par, label, o) {
  o = o || {}; const v = o.v || "secondary", s = o.s || "l", dis = !!o.disabled;
  const id = F(par, Object.assign({ name: "Button " + label, height: s === "l" ? 52 : 44, padding: [0, s === "l" ? 24 : 16], gap: 8, alignItems: "center", justifyContent: "center" },
    box(3, 14, dis ? "$surface-sunken" : BG[v], (dis || o.flat) ? 0 : (o.sh || (s === "l" ? 5 : 3)), o.shc), o.w ? { width: o.w } : {}, dis ? { stroke: "$ink-muted" } : {}));
  const fg = dis ? "$ink-muted" : FG[v];
  if (o.icon) I(id, o.icon, 20, fg);
  T(id, label, s === "l" ? "btn" : "btns", fg);
  if (o.iconEnd) I(id, o.iconEnd, 20, fg);
  return id;
}
function IBtn(par, icon, o) { o = o || {}; const z = o.z || 44; const id = F(par, Object.assign({ name: "IconButton " + icon, width: z, height: z, alignItems: "center", justifyContent: "center" }, box(3, 14, "$surface-raised", o.sh === undefined ? 3 : o.sh), o.ex || {})); I(id, icon, z < 44 ? 16 : 20); return id; }
const TONE = { pop: "$pop", sky: "$sky", mint: "$mint", pink: "$pink", plain: "$surface-raised", action: "$action" };
function Tag(par, label, tone, size, ex) {
  tone = tone || "plain"; const l = size === "l"; const px = ex && ex.pixel; const e2 = Object.assign({}, ex || {}); delete e2.pixel;
  const id = F(par, Object.assign({ name: "Tag " + label, padding: l ? [8, 16] : [4, 12], alignItems: "center", gap: 6 }, box(l ? 3 : 2, 8, TONE[tone], l ? 3 : 0), e2));
  T(id, label, px ? "pm" : (l ? "lab" : "cap"), tone === "plain" ? "$ink" : "$on-fill");
  return id;
}
function Pill(par, label, tone) {
  const id = F(par, Object.assign({ name: "StatusPill", padding: [8, 16], gap: 8, alignItems: "center" }, box(3, 999, "$surface-raised")));
  Insert(id, { type: "ellipse", name: "dot", width: 12, height: 12, fill: { success: "$success", pop: "$pop", action: "$action" }[tone || "success"], stroke: "$line", strokeWidth: 2, strokeAlignment: "inner" });
  T(id, label, "lab"); return id;
}
function Stat(par, num, label, w) {
  const id = F(par, Object.assign({ name: "StatTile " + label, layout: "vertical", gap: 4, padding: [12, 16], width: w || "fill_container" }, box(3, 14, "$surface-raised")));
  T(id, num, "pxl"); T(id, label, "cap", "$ink-muted"); return id;
}
function IBox(par, icon, tone, txt) {
  const id = F(par, Object.assign({ name: "IconBox", width: 44, height: 44, alignItems: "center", justifyContent: "center" }, box(3, 14, TONE[tone || "sky"])));
  if (txt) T(id, txt, "pl", "$on-fill"); else I(id, icon, 20, "$on-fill"); return id;
}
function Seg(par, opts, sel, ex) {
  const e2 = Object.assign({}, ex || {}); delete e2.eq;
  const id = F(par, Object.assign({ name: "SegmentedControl", clip: true }, box(3, 14, "$surface-raised", 3), e2));
  opts.forEach((o, i) => {
    const on = i === sel;
    const op = F(id, Object.assign({ name: "opt " + o, height: 44, padding: [0, 20], alignItems: "center", justifyContent: "center", fill: on ? "$inverse" : "$surface-raised" },
      i > 0 ? { stroke: "$line", strokeWidth: { left: 3 }, strokeAlignment: "inner" } : {}, (ex && ex.eq) ? { width: "fill_container" } : {}));
    T(op, o, "btns", on ? "$pop" : "$ink");
  });
  return id;
}
function Strip(par, l, r, fill, fg) {
  const id = F(par, { name: "strip", width: "fill_container", padding: [4, 16], justifyContent: "space_between", fill: fill || "$pop", stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner" });
  T(id, l, "pm", fg || "$on-fill"); if (r) T(id, r, "pm", fg || "$on-fill"); return id;
}
function Cart(par, c) {
  const id = F(par, Object.assign({ name: "Cartridge " + c.title, layout: "vertical", width: c.w || "fill_container", clip: true }, box(3, 18, "$surface-raised", c.sh === undefined ? 5 : c.sh), c.ex || {}));
  Strip(id, "No." + c.no, c.kind === "tool" ? "TOOL ▸" : (c.right || "GAME ▸"), c.kind === "tool" ? "$surface-sunken" : "$pop", c.kind === "tool" ? "$ink" : "$on-fill");
  if (c.img) Img(id, c.img, "fill_container", c.ih || 160, { stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner" });
  if (c.nosignal) { const n = F(id, { name: "no signal", width: "fill_container", height: c.ih || 160, fill: "$inverse", alignItems: "center", justifyContent: "center", stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner" }); T(n, "NO SIGNAL", "pm", "$pop"); }
  const b = F(id, { name: "body", layout: "vertical", gap: 12, padding: 20, width: "fill_container" });
  const h = F(b, { name: "head", gap: 12, alignItems: "center", width: "fill_container" });
  if (c.icon) IBox(h, c.icon, c.tone || "sky");
  T(h, c.title, "hm");
  if (c.desc) TW(b, c.desc, "bs", "$ink-muted");
  if (c.tags) { const tg = F(b, { name: "tags", layout: "vertical", gap: 8 }); const tn = ["sky", "mint", "pink", "pop"]; let r; c.tags.forEach((t, i) => { if (i % 2 === 0) r = F(tg, { name: "tag row", gap: 8 }); Tag(r, t, tn[(i + 1) % 4]); }); }
  return id;
}
function SecHead(par, eb, title, o) {
  o = o || {};
  const id = F(par, { name: "SectionHeader", width: "fill_container", justifyContent: "space_between", alignItems: "end", gap: 20 });
  const l = F(id, { name: "text", layout: "vertical", gap: 8, width: o.tw || "fit_content" });
  T(l, "— " + eb + " —", "pm", "$ink-muted");
  T(l, title, o.m ? "dlm" : "dl");
  if (o.lead) TW(l, o.lead, "b", "$ink-muted", o.leadW || 672);
  return { id: id, right: id };
}
function Screen(par, title, meta, h, o) {
  o = o || {};
  const id = F(par, Object.assign({ name: "ScreenFrame tb-screen", layout: "vertical", gap: 8, padding: o.p || 12, width: o.w || "fill_container" }, box(4, 14, "$inverse", o.sh === undefined ? 8 : o.sh)));
  const bar = F(id, { name: "tb-screen__bar", width: "fill_container", justifyContent: "space_between", alignItems: "center", padding: [0, 4] });
  T(bar, title, "pm", "$pop"); if (meta) T(bar, meta, "pm", "$on-inverse-muted");
  const v = F(id, Object.assign({ name: "tb-screen__view", width: "fill_container", height: h, cornerRadius: 8, clip: true, fill: o.img ? { type: "image", url: IMG + o.img, mode: "fill" } : "$inverse", layout: "none" }));
  return { id: id, view: v };
}
function Input(par, txt, o) {
  o = o || {};
  const id = F(par, Object.assign({ name: "tb-input", height: o.h || 44, padding: [0, 16], alignItems: "center", gap: 10, width: o.w || "fill_container", justifyContent: o.center ? "center" : "start" }, box(3, 14, o.disabled ? "$surface-sunken" : "$surface-raised"), o.focus ? { effect: { type: "shadow", shadowType: "outer", offset: { x: 0, y: 0 }, blur: 0, spread: 6, color: "$focus" } } : {}));
  if (o.icon) I(id, o.icon, 20, "$ink");
  T(id, txt, o.pixel ? "pl" : (o.big ? "bl" : "b"), o.value ? "$ink" : "$ink-muted", o.pixel ? { letterSpacing: 3 } : {});
  if (o.select) { F(id, { name: "spacer", width: "fill_container", height: 1 }); I(id, "chevron-down", 16); }
  return id;
}
function Field(par, label, txt, o) { const id = F(par, { name: "field " + label, layout: "vertical", gap: 8, width: (o && o.fw) || "fill_container" }); T(id, label, "lab"); Input(id, txt, o); return id; }
const ALERT = { info: ["$sky", "info"], warn: ["$pop", "triangle-alert"], error: ["$pink", "triangle-alert"] };
function Alert(par, tone, txt, ex) {
  const id = F(par, Object.assign({ name: "alert " + tone, gap: 12, padding: [12, 16], width: "fill_container", alignItems: "start" }, box(3, 14, ALERT[tone][0]), ex || {}));
  I(id, ALERT[tone][1], 20, "$on-fill"); TW(id, txt, "bs", "$on-fill"); return id;
}
function Panel(par, o) { o = o || {}; return F(par, Object.assign({ name: o.name || "panel", layout: "vertical", gap: o.gap || 20, padding: o.p || 24, width: o.w || "fill_container" }, box(o.bw || 3, o.r || 18, o.fill || "$surface-raised", o.sh === undefined ? 5 : o.sh), o.ex || {})); }
function Divider(par, txt) { const id = F(par, { name: "divider", width: "fill_container", gap: 12, alignItems: "center" }); F(id, { name: "l", width: "fill_container", height: 3, fill: "$line" }); T(id, txt, "cap", "$ink-muted"); F(id, { name: "r", width: "fill_container", height: 3, fill: "$line" }); return id; }
function NavL(par, label, cur, menu) {
  const id = F(par, Object.assign({ name: "NavLink " + label, height: 44, padding: [0, 16], gap: 4, alignItems: "center", cornerRadius: 999, stroke: cur ? "$line" : "#00000000", strokeWidth: 3, strokeAlignment: "inner", fill: cur ? "$pop" : "#00000000" }));
  T(id, label, "lab", cur ? "$on-fill" : "$ink"); if (menu) I(id, "chevron-down", 16, cur ? "$on-fill" : "$ink"); return id;
}
function Logo(par, short) {
  const id = F(par, { name: "Logo", gap: 12, alignItems: "center" });
  const m = F(id, Object.assign({ name: "mark", width: 44, height: 44, alignItems: "center", justifyContent: "center" }, box(3, 14, "$pop", 3)));
  T(m, "D", "pl", "$on-fill"); T(id, short ? "DKBO" : "DKBO's Collect", "hm"); return id;
}
function Header(page, cur, o) {
  o = o || {};
  const hd = F(page, { name: "SiteHeader", width: "fill_container", fill: "$surface", stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner", justifyContent: "center" });
  const inn = F(hd, { name: "in", width: o.mobile ? "fill_container" : 1200, padding: o.mobile ? [16, 16] : [16, 24], justifyContent: "space_between", alignItems: "center" });
  Logo(inn, o.mobile);
  const nav = F(inn, { name: "nav", gap: 8, alignItems: "center" });
  if (o.mobile) { IBtn(nav, o.dark ? "sun" : "moon"); IBtn(nav, o.open ? "x" : "menu"); return hd; }
  NavL(nav, "首頁", cur === "home"); NavL(nav, "E-履歷", cur === "resume"); NavL(nav, "遊戲", cur === "games", true); NavL(nav, "工具", cur === "tools", true);
  F(nav, { name: "sp", width: 8, height: 1 }); IBtn(nav, o.dark ? "sun" : "moon");
  return hd;
}
function Footer(page) { const f = F(page, { name: "Footer", width: "fill_container", padding: 24, justifyContent: "center", stroke: "$line", strokeWidth: { top: 3 }, strokeAlignment: "inner" }); T(f, "© 2026 DKBO · GAME OVER? PRESS START", "pm", "$ink-muted"); return f; }
function Page(name, o) {
  o = o || {};
  SetVariables(VARS);
  const p = F(document, Object.assign({ name: name, x: o.x || 0, y: o.y || 0, width: o.w || 1440, height: "fit_content", layout: "vertical", alignItems: "center", fill: "$surface", clip: true }, o.dark ? { theme: { mode: "dark" } } : { theme: { mode: "light" } }));
  return p;
}
function Cont(page, o) { o = o || {}; return F(page, { name: o.name || "tb-container", layout: "vertical", width: o.w || 1200, padding: o.pad || [48, 24, 72, 24], gap: o.gap === undefined ? 32 : o.gap }); }
function Note(par, txt) { const id = F(par, { name: "note", gap: 8, alignItems: "center", padding: [6, 12], cornerRadius: 8, fill: "#3d7bff", }); T(id, txt, "cap", "#ffffff"); return id; }
function Row(par, o) { return F(par, Object.assign({ name: "row", width: "fill_container", gap: 24 }, o || {})); }
function Col(par, w, o) { return F(par, Object.assign({ name: "col", layout: "vertical", width: w, gap: 24 }, o || {})); }
function GameCol(page, o) { const c = Cont(page, { gap: 24 }); Update(c, { alignItems: "center" }); return F(c, { name: "game column max-w-4xl", layout: "vertical", width: 896, gap: 24 }); }
function Toolbar(par, btns) { const r = F(par, { name: "toolbar", width: "fill_container", gap: 12 }); btns.forEach((b) => Btn(r, b[0], { s: "s", icon: b[1] })); return r; }
function FsBtns(view, x, icons) { const r = F(view, { name: "浮鈕", x: x, y: 12, gap: 8 }); (icons || ["maximize-2"]).forEach((ic) => IBtn(r, ic, { z: 36 })); return r; }
function KeyRow(par, label, key, last) { const r = F(par, Object.assign({ name: "key " + label, width: "fill_container", justifyContent: "space_between", alignItems: "center", padding: [8, 0] }, last ? {} : { stroke: "$line", strokeWidth: { bottom: 3 }, strokeAlignment: "inner" })); T(r, label, "lab"); Tag(r, key, "plain", "s"); return r; }
function Dialog(par, title, o) {
  o = o || {};
  const d = F(par, Object.assign({ name: "*-dialog 卡", layout: "vertical", gap: 16, padding: 24, width: o.w || 400 }, box(4, 18, "$surface-raised", 8), o.ex || {}));
  const h = F(d, { name: "head", width: "fill_container", gap: 12, alignItems: "center", justifyContent: "space_between" });
  const hl = F(h, { name: "t", gap: 12, alignItems: "center" }); IBox(hl, o.icon || "gamepad-2", "pop"); T(hl, title, "hm");
  IBtn(h, "x", { z: 36 });
  return d;
}
function Controller(par, fire) {
  const c = F(par, Object.assign({ name: "控制器面板", width: "fill_container", padding: 20, gap: 24, alignItems: "center", justifyContent: "space_between" }, box(4, 26, "$pop", 5)));
  const l = F(c, { name: "l", gap: 16, alignItems: "center" });
  const dp = F(l, { name: "d-pad", layout: "vertical", gap: 6, alignItems: "center" });
  IBtn(dp, "arrow-up"); const mid = F(dp, { name: "mid", gap: 6, alignItems: "center" }); IBtn(mid, "arrow-left"); const t = F(mid, { name: "c", width: 44, height: 44, alignItems: "center", justifyContent: "center" }); T(t, "D-PAD", "cap", "$on-fill"); IBtn(mid, "arrow-right"); IBtn(dp, "arrow-down");
  const k = F(l, { name: "keys", layout: "vertical", gap: 4 }); T(k, "鍵盤控制指南", "lab", "$on-fill"); T(k, "移動：W A S D / 方向鍵", "bs", "$on-fill"); T(k, fire || "開火：空白鍵 (Space)", "bs", "$on-fill");
  const r = F(c, { name: "fire", layout: "vertical", gap: 8, alignItems: "center" });
  const a = F(r, { name: "A", width: 64, height: 64, cornerRadius: 999, alignItems: "center", justifyContent: "center", fill: "$action", stroke: "$on-fill", strokeWidth: 3, strokeAlignment: "inner", effect: SH(3, "$on-fill") }); T(a, "FIRE", "pm", "$on-fill");
  T(r, "點擊按鈕或按空白鍵發射", "cap", "$on-fill");
  return c;
}
function ChatBox(view, x, y, w, who, txt) {
  const b = F(view, Object.assign({ name: "*-chat-box NPC 對話框", x: x, y: y, width: w, layout: "vertical", gap: 8, padding: 16, fill: "$inverse", stroke: "$on-inverse", strokeWidth: 4, strokeAlignment: "inner", cornerRadius: 14, effect: SH(5) }));
  const h = F(b, { name: "speaker", width: "fill_container", gap: 8, alignItems: "center", padding: [0, 0, 8, 0], stroke: "$on-inverse-muted", strokeWidth: { bottom: 2 }, strokeAlignment: "inner" }); I(h, "message-square", 16, "$pop"); T(h, who, "lab", "$pop");
  TW(b, txt, "b", "$on-inverse"); const e = F(b, { name: "next", width: "fill_container", justifyContent: "end", alignItems: "center", gap: 6 }); T(e, "按 SPACE / 點 A 繼續", "cap", "$on-inverse-muted"); T(e, "▼", "pm", "$pop");
  return b;
}
function ShooterView(view, w, h) {
  [[0.2, 0.3], [0.45, 0.6], [0.6, 0.2], [0.72, 0.5], [0.8, 0.75], [0.35, 0.8], [0.9, 0.35]].forEach(([a, b], i) => F(view, { name: "obstacle", x: Math.round(w * a), y: Math.round(h * b), width: 6, height: 34, fill: "#ff3b5c", cornerRadius: 2 }));
  Insert(view, { type: "polygon", name: "ship", x: 40, y: Math.round(h / 2) - 10, width: 20, height: 20, polygonCount: 3, rotation: -90, fill: "#b48cff" });
}
const WORKS = [
  ["02", "RPG 遊戲室", "從 2015 年的第一版一路重寫到現在，Canvas 離屏預渲染的 2D 地圖與 NPC 對話。", ["Canvas", "React"], "game", "rpgroom"],
  ["03", "小遊戲", "Babylon.js 3D 單機練手場，多人對戰的原型都從這裡長出來。", ["Babylon.js", "WebGL"], "game", "minigame"],
  ["04", "Godot 遊戲", "Godot 4 匯出 Web，React 透過 bridge 與引擎互傳 NPC 對話與地圖狀態。", ["Godot 4", "GDScript", "iframe bridge"], "game", "godot"],
  ["05", "糖果消消樂", "三消玩法、關卡 JSON 驗證與 board 單元測試，Godot 引擎第二作。", ["Godot 4", "關卡 JSON"], "game", "candy"],
  ["06", "外部查詢", "GitHub 倉庫與維基百科條目搜尋，Axios 封裝與 Store 非同步流程。", ["REST API"], "tool", "search"],
  ["07", "Todos", "待辦清單，Zustand 狀態與路由參數篩選。", ["Zustand"], "tool", "list-checks"],
  ["08", "地圖導覽", "Google Maps 路線規劃與自訂資訊視窗。", ["Maps API"], "tool", "map-pin"],
  ["09", "地圖開發", "RPG 遊戲室的地圖編輯器，畫完直接匯出場景 JSON。", ["Canvas", "JSON"], "tool", "layout-grid"],
];
function Handheld(par, w) {
  w = w || 380; const iw = w - 48 - 8 - 24;
  const h = F(par, Object.assign({ name: "Handheld", layout: "vertical", gap: 20, padding: [24, 24, 32, 24], width: w, rotation: -3, cornerRadius: [26, 26, 64, 26] }, box(4, 0, "$pop", 8), { cornerRadius: [26, 26, 64, 26] }));
  const sc = F(h, { name: "screen", layout: "vertical", gap: 8, padding: [12, 12, 8, 12], width: "fill_container", fill: "$inverse", stroke: "$on-fill", strokeWidth: 4, strokeAlignment: "inner", cornerRadius: 14 });
  Img(sc, "works/battle.webp", "fill_container", Math.round(iw * 10 / 16), { cornerRadius: 4 });
  const cap = F(sc, { name: "caption", width: "fill_container", justifyContent: "space_between" }); T(cap, "NOW PLAYING", "pm", "$pop", { fontSize: 20 }); T(cap, "多人對戰 ▸", "pm", "$pop", { fontSize: 20 });
  const pad = F(h, { name: "pad", width: "fill_container", justifyContent: "space_between", alignItems: "center", padding: [0, 8] });
  const dp = F(pad, { name: "dpad", width: 88, height: 88, layout: "none" }); F(dp, { name: "v", x: 30, y: 0, width: 28, height: 88, cornerRadius: 5, fill: "$on-fill" }); F(dp, { name: "h", x: 0, y: 30, width: 88, height: 28, cornerRadius: 5, fill: "$on-fill" });
  const ab = F(pad, { name: "A/B", gap: 12, rotation: 20, alignItems: "start" });
  ["B", "A"].forEach((k, i) => { const b = F(ab, { name: k, width: 52, height: 52, cornerRadius: 999, alignItems: "center", justifyContent: "center", fill: "$action", stroke: "$on-fill", strokeWidth: 3, strokeAlignment: "inner", effect: SH(3, "$on-fill") }); T(b, k, "pl", "$on-fill", { fontSize: 26 }); });
  const pl = F(h, { name: "pills", width: "fill_container", justifyContent: "center", gap: 16 }); F(pl, { name: "p", width: 54, height: 12, cornerRadius: 999, fill: "#17140fcc" }); F(pl, { name: "p", width: 54, height: 12, cornerRadius: 999, fill: "#17140fcc" });
  const md = F(h, { name: "model", width: "fill_container", justifyContent: "end" }); T(md, "DKBO·BOY", "pm", "$on-fill", { letterSpacing: 2.6 });
  return h;
}
function Hero(par, m) {
  const W = m ? 358 : 662;
  const hero = F(par, { name: "Hero", width: "fill_container", layout: m ? "vertical" : "horizontal", gap: m ? 56 : 24, alignItems: "center", padding: m ? [48, 0, 72, 0] : [72, 0, 96, 0] });
  const L = F(hero, { name: "文案", layout: "vertical", gap: 24, width: W });
  Pill(L, m ? "目前在做：Babylon.js 多人對戰" : "目前在做：Babylon.js 多人對戰 + AI 協作開發", "success");
  const h1 = F(L, { name: "H1", gap: 16, alignItems: "center", width: "fill_container", layout: m ? "vertical" : "horizontal" });
  Update(h1, { alignItems: m ? "start" : "center" });
  T(h1, "嗨，我是", m ? "dxl" : "dxl", "$ink", m ? { fontSize: 44, lineHeight: 1.1 } : {});
  const st = F(h1, Object.assign({ name: "名字貼紙 tilt-1", padding: [0, 18], rotation: 3 }, box(4, 18, "$pop", 6))); T(st, "DKBO", "dxl", "$on-fill", m ? { fontSize: 44, lineHeight: 1.2 } : {});
  T(L, "把新技術拿來做有趣的東西", m ? "hlm" : "hl");
  TW(L, "13 年前端資歷。這裡放的是我用 React、Babylon.js、Godot 與 WebRTC 做出來的網頁遊戲和工具，全部純前端，打開就能玩。", "bl", "$ink-muted", m ? "fill_container" : 520);
  const bt = F(L, { name: "buttons", gap: 16, layout: m ? "vertical" : "horizontal", width: m ? "fill_container" : "fit_content" });
  Btn(bt, "▶ 開始玩", { v: "primary", w: m ? "fill_container" : undefined }); Btn(bt, "E-履歷", { iconEnd: "arrow-up-right", w: m ? "fill_container" : undefined });
  const sg = F(L, { name: "StatTile ×4", layout: "vertical", gap: 12, width: "fill_container" });
  const rows = m ? [[["13+", "年前端經驗"], ["9", "個站內作品"]], [["4", "款多人對戰遊戲"], ["2", "套遊戲引擎"]]] : [[["13+", "年前端經驗"], ["9", "個站內作品"], ["4", "款多人對戰遊戲"], ["2", "套遊戲引擎"]]];
  rows.forEach((r) => { const rr = F(sg, { name: "r", gap: 12, width: "fill_container" }); r.forEach(([a, b]) => Stat(rr, a, b)); });
  const R = F(hero, { name: "主視覺", width: m ? "fill_container" : 466, height: m ? 560 : 600, layout: "none" });
  const hh = Handheld(R, m ? 320 : 380); Update(hh, { x: m ? 16 : 40, y: m ? 26 : 50 });
  if (!m) { [["WebRTC", "sky", 0, 10, 8], ["Godot 4", "mint", 352, 420, -7], ["Babylon.js", "pink", 0, 520, 4]].forEach(([t, tn, x, y, r]) => { const id = Tag(R, t, tn, "l"); Update(id, { x: x, y: y, rotation: r }); }); }
  return hero;
}
function Marquee(par, w) {
  const wrap = F(par, { name: "Marquee wrap", width: w, height: 90, layout: "none", clip: true });
  const mq = F(wrap, { name: "Marquee tilt-band", x: -20, y: 20, width: w + 40, padding: [12, 20], fill: "$inverse", stroke: "$line", strokeWidth: { top: 3, bottom: 3 }, strokeAlignment: "inner", rotation: 1, clip: true });
  T(mq, "★ INSERT COIN ★ REACT 19 ★ BABYLON.JS ★ GODOT 4 ★ WEBRTC ★ FIREBASE ★ ZUSTAND ★ TAILWIND ★ INSERT COIN ★ REACT 19 ★", "pl", "$pop", { letterSpacing: 1.8 });
  return wrap;
}
function Feature(par, m) {
  const f = F(par, Object.assign({ name: "FeatureCard", width: "fill_container", layout: m ? "vertical" : "horizontal", clip: true }, box(4, 26, "$surface-raised", 8)));
  const md = F(f, { name: "media", width: m ? "fill_container" : 662, height: m ? 200 : 360, layout: "none", fill: { type: "image", url: IMG + "works/battle.webp", mode: "fill" } });
  const bd = F(md, Object.assign({ name: "badge", x: 16, y: 16, padding: [4, 12] }, box(3, 8, "$action"))); T(bd, "★ FEATURED", "pm", "$on-fill");
  const pn = F(f, Object.assign({ name: "panel", layout: "vertical", gap: 16, padding: m ? 24 : 32, width: "fill_container", fill: "$pop", stroke: "$line", strokeAlignment: "inner" }, m ? { strokeWidth: { top: 4 } } : { strokeWidth: { left: 4 }, height: "fill_container" }));
  T(pn, "No.01 · 2-4P · ONLINE", "pm", "$on-fill"); T(pn, "多人對戰", m ? "hlm" : "hl", "$on-fill");
  TW(pn, "開房間邀朋友，WebRTC 點對點同步。坦克對戰、極速賽車、炸彈超人、廚房快手四款遊戲，Host 權威架構。", "b", "$on-fill");
  const tg = F(pn, { name: "tags", layout: "vertical", gap: 8 }); let tr; ["Babylon.js", "WebRTC", "Firebase", "Zustand"].forEach((t, i) => { if (i % (m ? 2 : 4) === 0) tr = F(tg, { name: "tag row", gap: 8 }); Tag(tr, t, "plain"); });
  const cta = F(pn, Object.assign({ name: "假按鈕", height: 44, padding: [0, 20], gap: 8, alignItems: "center" }, box(3, 14, "$inverse"))); T(cta, "▶ 開房間", "btn", "$pop");
  return f;
}
function Works(par, m, n) {
  const s = F(par, { name: "作品區", layout: "vertical", gap: 32, width: "fill_container", padding: m ? [72, 0, 48, 0] : [96, 0, 72, 0] });
  const sh = SecHead(s, "SELECT GAME", "作品卡帶", { m: m }); if (m) Update(sh.id, { layout: "vertical", alignItems: "start" });
  Seg(sh.id, ["全部", "遊戲", "工具"], 0);
  Feature(s, m);
  const list = WORKS.slice(0, n || 8); const per = m ? 1 : 4;
  for (let i = 0; i < list.length; i += per) { const r = F(s, { name: "grid row", gap: 24, width: "fill_container" }); list.slice(i, i + per).forEach((w) => Cart(r, { no: w[0], title: w[1], desc: w[2], tags: w[3], kind: w[4], img: w[4] === "game" ? "works/" + w[5] + ".webp" : null, ih: m ? 201 : 152, icon: w[4] === "tool" ? w[5] : null, w: m ? "fill_container" : 270 })); }
  if (m && n) Note(s, "…其餘卡帶同樣式（1 欄）");
  return s;
}
function Cta(par, m) {
  const c = F(par, Object.assign({ name: "CtaPanel", width: "fill_container", layout: m ? "vertical" : "horizontal", gap: 32, padding: m ? [32, 24] : [48, 40], alignItems: m ? "start" : "center", justifyContent: "space_between" }, box(4, 26, "$inverse", 8, "$action")));
  const t = F(c, { name: "text", layout: "vertical", gap: 12, width: m ? "fill_container" : 560 });
  T(t, "CONTINUE? 10 … 9 … 8", "pm", "$pop"); T(t, "程式碼全部公開", m ? "hlm" : "hl", "$on-inverse"); TW(t, "這個站本身也是作品之一。想看實作細節或聊聊 AI 協作開發，都歡迎。", "b", "$on-inverse-muted");
  const a = F(c, { name: "actions", gap: 16, layout: m ? "vertical" : "horizontal", width: m ? "fill_container" : "fit_content" });
  Btn(a, "GitHub", { v: "pop", iconEnd: "arrow-up-right", sh: 4, shc: "$on-inverse", w: m ? "fill_container" : undefined }); Btn(a, "Blog", { iconEnd: "arrow-up-right", sh: 4, shc: "$on-inverse", w: m ? "fill_container" : undefined }); Btn(a, "Codepen", { iconEnd: "arrow-up-right", sh: 4, shc: "$on-inverse", w: m ? "fill_container" : undefined });
  return c;
}
function About(par, m) {
  const s = F(par, { name: "home-about", layout: "vertical", gap: 32, width: "fill_container", padding: m ? [72, 0, 0, 0] : [96, 0, 0, 0] });
  SecHead(s, "ABOUT", "關於我", { m: m });
  const r = F(s, { name: "grid", gap: 24, width: "fill_container", layout: m ? "vertical" : "horizontal", alignItems: "start" });
  const a = Panel(r, { name: "home-about-card", w: m ? "fill_container" : 662, p: m ? 24 : 32, gap: 24 });
  TW(a, "資深前端工程師，13 年來用 Vue 與 React 做過大型 B2B / B2C 平台、財務系統和 RWD 網頁遊戲，帶過團隊也規劃過架構。近兩年把重心放在 AI 輔助開發：讓 Claude Code 與 Agent 流程真的進到日常產出裡，而不只是 demo。", "bl");
  Btn(a, "完整經歷看 E-履歷", { s: "s", iconEnd: "arrow-right" });
  const n = F(r, Object.assign({ name: "home-now", layout: "vertical", width: m ? "fill_container" : 466, clip: true }, box(3, 18, "$surface-raised", 5)));
  Strip(n, "NOW PLAYING");
  const ul = F(n, { name: "list", layout: "vertical", gap: 16, padding: 20, width: "fill_container" });
  [["多人對戰", "收斂 host 權威與重連流程", "$sky"], ["AI 協作", "用 agent team 跑架構與安全審查", "$mint"], ["Side project", "Web3 與量化交易 Bot", "$pink"]].forEach(([t, d, c]) => { const li = F(ul, { name: "li", gap: 12, alignItems: "center", width: "fill_container" }); Insert(li, { type: "ellipse", name: "dot", width: 12, height: 12, fill: c, stroke: "$line", strokeWidth: 2, strokeAlignment: "inner" }); T(li, t, "lab"); T(li, d, "bs", "$ink-muted"); });
  return s;
}
function Journey(par, m, expand) {
  const s = F(par, { name: "home-journey", layout: "vertical", gap: 32, width: "fill_container", padding: m ? [72, 0, 0, 0] : [96, 0, 0, 0] });
  SecHead(s, "HIGH SCORE", "開發歷程", { m: m });
  const tl = F(s, { name: "timeline", layout: "vertical", width: "fill_container" });
  const J = [
    ["2015", "jQuery + Bootstrap 的第一版首頁", "當時最流行的組合。標題用 h1 到 h6 一路排下去，只為了展示 Bootstrap 的級距。", 0, "彩蛋：2015 年的首頁原始碼"],
    ["2016", "邊學 React 邊做 RPG 遊戲室", "仿 RPG 製作大師的風格，還不懂生命週期和 flux，硬是做完了。", 1, "看 requestAnimationFrame 片段"],
    ["2017 – 2023", "Vue / React 大型平台與團隊帶領", "B2B / B2C 平台、財務系統、RWD 網頁遊戲。前端架構規劃、效能優化，帶團隊。"],
    ["2025", "整站重寫：React 19 + Tailwind v4 + Godot", "RPG 遊戲室搬進 Canvas 離屏渲染，糖果消消樂與 Godot 遊戲透過 iframe bridge 接進來。"],
    ["2026 · Now", "Babylon.js 多人對戰 + AI 協作開發", "WebRTC mesh、Host 權威同步、Firestore 房間。開發流程全面改成 Claude Code agent team 拆解、派工、審查。", 0, null, 1],
  ];
  J.forEach(([y, t, b, lessons, snip, cur], i) => {
    const row = F(tl, { name: "node " + y, gap: m ? 12 : 0, width: "fill_container", alignItems: "start" });
    if (!m) { const yy = F(row, { name: "year", width: 112, padding: [2, 8, 0, 0], justifyContent: "end" }); T(yy, y, "pm", cur ? "$ink" : "$ink-muted"); }
    if (!m) F(row, { name: "axis 左半", width: 18, height: 1 }); else F(row, { name: "axis 左半", width: 1, height: 1 });
    const ct = F(row, Object.assign({ name: "content", layout: "vertical", gap: 12, width: "fill_container", padding: [0, 0, 40, m ? 24 : 30] }, i < J.length - 1 ? { stroke: "$line", strokeWidth: { left: 3 }, strokeAlignment: "inner" } : {}));
    const dz = cur ? 24 : 20; const dot = { type: "ellipse", name: "dot", layoutPosition: "absolute", x: 1.5 - dz / 2, y: 2, width: dz, height: dz, fill: cur ? "$pop" : "$surface-raised", stroke: "$line", strokeWidth: 3, strokeAlignment: "inner" }; if (cur) dot.effect = SH(3); Insert(ct, dot);
    if (m) T(ct, y, "pm", cur ? "$ink" : "$ink-muted");
    TW(ct, t, "hm"); TW(ct, b, "b", "$ink-muted");
    if (lessons) { const lg = F(ct, { name: "lessons", gap: 12, width: "fill_container", layout: m ? "vertical" : "horizontal" }); [["問題", "按住方向鍵，人物像打字一樣「a… a.a.a」一頓一頓地走。"], ["解法", "改用 requestAnimationFrame 每幀讀取按鍵狀態，位移改 translate3d。"], ["教訓", "別用幾百個 div 加 background-position 拼畫面，效能會很慘。"]].forEach(([l, x]) => { const c = F(lg, Object.assign({ name: "lesson", layout: "vertical", gap: 4, padding: 16, width: "fill_container" }, box(3, 14, "$surface-raised"))); T(c, l, "cap", "$ink-muted"); TW(c, x, "bs"); }); }
    if (snip) {
      const ac = F(ct, { name: "actions", gap: 16, width: "fill_container", layout: m ? "vertical" : "horizontal" });
      const sm = F(ac, Object.assign({ name: "summary", height: 44, padding: [0, 16], gap: 8, alignItems: "center" }, box(3, 14, "$surface-raised", 3))); I(sm, (expand && i === 1) ? "chevron-down" : "chevron-right", 16); T(sm, snip, "btns");
      if (lessons) Btn(ac, "Codepen 最早的實作", { s: "s", icon: "arrow-up-right" });
      if (expand && i === 1) Code(ct, m);
    }
  });
  return s;
}
function Code(par, m) {
  const c = F(par, Object.assign({ name: "CodeSnippet 小 ScreenFrame", layout: "vertical", gap: 8, padding: 12, width: "fill_container" }, box(3, 14, "$inverse", 5)));
  const b = F(c, { name: "bar", width: "fill_container", justifyContent: "space_between", padding: [0, 4] }); T(b, "SOURCE", "pm", "$pop"); T(b, "JAVASCRIPT", "pm", "$on-inverse-muted");
  const v = F(c, { name: "code", layout: "vertical", gap: 2, padding: 12, width: "fill_container" });
  const L = [["// 一開始就跑 requestAFrame", "#75715e"], ["var requestAFrame =", "#66d9ef"], ["  window.requestAnimationFrame ||", "#f8f8f2"], ["  window.webkitRequestAnimationFrame ||", "#f8f8f2"], ["  function (callback) {", "#a6e22e"], ["    window.setTimeout(callback, 1000 / 60)", "#f8f8f2"], ["  }", "#f8f8f2"], ["function moveAframe() {", "#a6e22e"], ["  if (keyDownLeft) {", "#f92672"], ["    // setLeftMove()", "#75715e"], ["  }", "#f8f8f2"], ["}", "#f8f8f2"], ["requestAFrame(moveAframe)", "#f8f8f2"]];
  L.forEach(([t, col], i) => { const r = F(v, { name: "line", gap: 16 }); T(r, String(i + 1).padStart(2, " "), "bs", "#75715e", { fontFamily: "JetBrains Mono" }); T(r, t, "bs", col, { fontFamily: "JetBrains Mono" }); });
  return c;
}
