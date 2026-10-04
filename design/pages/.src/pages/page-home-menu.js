const p = Page("page-home-menu", { w: 390 });
Header(p, "home", { mobile: true, open: true });
const c = Cont(p, { gap: 0, w: 390, pad: [12, 16, 16, 16] });
const mn = F(c, Object.assign({ name: "mobile-menu 面板", layout: "vertical", gap: 4, padding: 12, width: "fill_container" }, box(3, 18, "$surface-raised", 5)));
function Row1(l, cur) { const n = NavL(mn, l, cur); Update(n, { width: "fill_container", cornerRadius: 14 }); }
Row1("首頁", true); Row1("E-履歷");
const g1 = F(mn, { name: "group", padding: [12, 16, 4, 16] }); T(g1, "GAMES", "pm", "$ink-muted");
["小遊戲", "遊戲室", "Godot遊戲", "糖果消消樂", "多人對戰"].forEach((x) => Row1(x));
const g2 = F(mn, { name: "group", padding: [12, 16, 4, 16] }); T(g2, "TOOLS", "pm", "$ink-muted");
["外部查詢", "Todos", "地圖導覽", "地圖開發"].forEach((x) => Row1(x));
const c2 = Cont(p, { gap: 0, w: 390, pad: [0, 16, 0, 16] });
Note(c2, "面板下方為原頁面（不加遮罩）");
Hero(c2, true);
