const p = Page("page-home-sections");
Header(p, "home");
const c = Cont(p, { gap: 0, pad: [0, 24, 72, 24] });
Note(c, "首頁 mockup 沒畫的三區：About → Journey（含 CodeSnippet 展開）；位置在作品區之後、CtaPanel 之前");
About(c, false);
Journey(c, false, true);
Footer(p);
