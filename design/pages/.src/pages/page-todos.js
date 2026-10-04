const p = Page("page-todos");
Header(p, "tools");
const c = Cont(p, { gap: 32 });
const h = SecHead(c, "TO DO LIST", "Todos (4)", {});
const act = F(h.id, { name: "actions", gap: 12 }); Btn(act, "Clear Completed", { s: "s", icon: "square-check" }); Btn(act, "Clear All", { s: "s", icon: "trash" });
const bx = Panel(c, { name: "todos-box", w: 672, gap: 20 });
const ir = F(bx, { name: "input row", gap: 12, width: "fill_container" }); Input(ir, "What needs to be done?"); Btn(ir, "新增", { v: "primary", s: "s", icon: "plus" });
Seg(bx, ["All", "Active", "Completed"], 0, { width: "fill_container", eq: true });
const ls = F(bx, { name: "todos-list", layout: "vertical", gap: 12, width: "fill_container" });
[["買牛奶", 0], ["寫 toybox 設計稿", 0, 1], ["整理房間", 1], ["回覆 email", 0, 0, 1]].forEach(([t, done, edit, hover]) => {
  const li = F(ls, Object.assign({ name: "todos-item " + t, height: 52, padding: [0, 8, 0, 16], gap: 12, alignItems: "center", width: "fill_container" }, box(3, 14, done ? "$surface-sunken" : "$surface")));
  const ck = F(li, Object.assign({ name: "check", width: 24, height: 24, alignItems: "center", justifyContent: "center" }, box(3, 8, done ? "$mint" : "$surface-raised"))); if (done) I(ck, "check", 16, "$on-fill");
  if (edit) { const e = F(li, Object.assign({ name: "edit input", height: 36, padding: [0, 8], alignItems: "center", width: "fill_container" }, box(3, 14, "$surface-raised"), { effect: { type: "shadow", shadowType: "outer", offset: { x: 0, y: 0 }, blur: 0, spread: 6, color: "$focus" } })); T(e, t, "b"); }
  else TW(li, t, "b", done ? "$ink-muted" : "$ink", "fill_container", done ? { strikethrough: true } : {});
  if (!done && !edit) IBtn(li, "pencil", { z: 36, ex: hover ? { effect: SH(5), x: -2, y: -2 } : {} });
  if (!edit) IBtn(li, "trash-2", { z: 36 });
});
Note(c, "第 2 列：編輯中（tb-input 縮版＋焦點外框）；第 3 列：完成態；第 4 列 ✎ 示意 hover");
Note(c, "空清單狀態");
const em = F(c, { name: "empty", width: 672, layout: "vertical", gap: 8, padding: 40, alignItems: "center", cornerRadius: 14, stroke: "$line", strokeWidth: 3, strokeAlignment: "inner" });
T(em, "EMPTY", "pl", "$ink-muted"); T(em, "No tasks yet. Prefill a task above to get started!", "bs", "$ink-muted");
Footer(p);
