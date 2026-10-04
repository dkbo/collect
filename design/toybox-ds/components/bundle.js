/* @ds-bundle: {"format":4,"namespace":"Toybox","components":[{"name":"Button"},{"name":"IconButton"},{"name":"NavLink"},{"name":"SiteHeader"},{"name":"StatusPill"},{"name":"Tag"},{"name":"StatTile"},{"name":"IconBox"},{"name":"SegmentedControl"},{"name":"CartridgeCard"},{"name":"FeatureCard"},{"name":"SectionHeader"},{"name":"Marquee"},{"name":"CtaPanel"},{"name":"Handheld"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function omit(p, keys) {
    var o = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && keys.indexOf(k) < 0) o[k] = p[k];
    return o;
  }
  function stateClass(s) { return s ? 'is-' + s : null; }

  var ICONS = {
    'arrow-down': [['path', { d: 'M12 5v14M5 12l7 7 7-7' }]],
    'arrow-up-right': [['path', { d: 'M7 17L17 7M8 7h9v9' }]],
    play: [['path', { d: 'M7 5l12 7-12 7z' }]],
    moon: [['path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }]],
    sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-4-4' }]],
    list: [['path', { d: 'M3 6l2 2 3-3M3 13l2 2 3-3M11 6h10M11 13h10M11 20h10' }]],
    pin: [['path', { d: 'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z' }], ['circle', { cx: 12, cy: 10, r: 2.5 }]],
    grid: [['rect', { x: 3, y: 3, width: 7, height: 7 }], ['rect', { x: 14, y: 3, width: 7, height: 7 }], ['rect', { x: 3, y: 14, width: 7, height: 7 }], ['rect', { x: 14, y: 14, width: 7, height: 7 }]],
    menu: [['path', { d: 'M4 7h16M4 12h16M4 17h16' }]],
    'chevron-down': [['path', { d: 'M6 9l6 6 6-6' }]]
  };

  function Icon(p) {
    var spec = ICONS[p.name] || [];
    var s = p.size || 20;
    return h('svg', {
      width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', className: cx('tb-icon', p.className)
    }, spec.map(function (e, i) { return h(e[0], Object.assign({ key: i }, e[1])); }));
  }
  function iconNode(icon) { return typeof icon === 'string' ? h(Icon, { name: icon }) : icon; }

  var TONES = ['sky', 'mint', 'pink', 'pop'];
  function normTags(tags) {
    return (tags || []).map(function (t, i) {
      return typeof t === 'string' ? { label: t, tone: TONES[i % TONES.length] } : t;
    });
  }

  function Button(p) {
    var tag = p.href ? 'a' : 'button';
    var rest = omit(p, ['variant', 'size', 'icon', 'iconEnd', 'className', 'children', 'state']);
    if (tag === 'button' && !rest.type) rest.type = 'button';
    rest.className = cx('tb-btn', p.size === 's' ? 'tb-lift-s' : 'tb-lift', 'tb-btn--' + (p.variant || 'secondary'), 'tb-btn--' + (p.size || 'l'), stateClass(p.state), p.className);
    return h(tag, rest, p.icon ? iconNode(p.icon) : null, p.children, p.iconEnd ? iconNode(p.iconEnd) : null);
  }

  function IconButton(p) {
    var rest = omit(p, ['icon', 'label', 'className', 'state']);
    rest.type = rest.type || 'button';
    rest['aria-label'] = p.label;
    rest.className = cx('tb-iconbtn', 'tb-lift-s', stateClass(p.state), p.className);
    return h('button', rest, iconNode(p.icon));
  }

  function NavLink(p) {
    var rest = omit(p, ['current', 'menu', 'className', 'children', 'state']);
    rest.className = cx('tb-nav', 'tb-focus', stateClass(p.state), p.className);
    if (p.current) rest['aria-current'] = 'page';
    return h('a', rest, p.children, p.menu ? h(Icon, { name: 'chevron-down', size: 16 }) : null);
  }

  function SiteHeader(p) {
    var links = p.links || [];
    return h('header', { className: 'tb-header' },
      h('nav', { className: 'tb-header__in', 'aria-label': p.label || '主選單' },
        h('a', { className: 'tb-logo tb-focus', href: p.homeHref || '#' },
          h('span', { className: 'tb-logo__mark', 'aria-hidden': 'true' }, p.letter || 'D'),
          h('span', { className: 'tb-logo__name' }, p.name || 'DKBO')),
        h('div', { className: 'tb-header__nav' },
          links.map(function (l, i) { return h(NavLink, { key: i, href: l.href || '#', current: l.current, menu: l.menu }, l.label); }),
          h(IconButton, { icon: p.dark ? 'sun' : 'moon', label: '切換深色模式', onClick: p.onToggleTheme }))));
  }

  function StatusPill(p) {
    return h('span', { className: cx('tb-status', p.tone && 'tb-status--' + p.tone, p.className) },
      h('span', { className: 'tb-status__dot', 'aria-hidden': 'true' }), p.children);
  }

  function Tag(p) {
    return h('span', { className: cx('tb-tag', 'tb-tag--' + (p.tone || 'sky'), p.size === 'l' && 'tb-tag--l', p.tilt && 'tb-tilt-' + p.tilt, p.className) }, p.children);
  }

  function StatTile(p) {
    return h('div', { className: cx('tb-stat', p.className) },
      h('div', { className: 'tb-stat__num' }, p.value, p.suffix ? h('span', null, p.suffix) : null),
      h('div', { className: 'tb-stat__label' }, p.label));
  }

  function IconBox(p) {
    return h('span', { className: cx('tb-iconbox', p.tone && p.tone !== 'sky' && 'tb-iconbox--' + p.tone, p.className), 'aria-hidden': 'true' }, iconNode(p.icon));
  }

  function SegmentedControl(p) {
    var opts = p.options || [];
    var init = p.defaultValue != null ? p.defaultValue : (opts[0] && opts[0].value);
    var st = React.useState(init);
    var value = p.value != null ? p.value : st[0];
    return h('div', { className: cx('tb-seg', p.className), role: 'group', 'aria-label': p.label },
      opts.map(function (o) {
        return h('button', {
          key: o.value, type: 'button', className: 'tb-seg__opt', 'aria-pressed': o.value === value ? 'true' : 'false',
          onClick: function () { st[1](o.value); if (p.onChange) p.onChange(o.value); }
        }, o.label);
      }));
  }

  function TagList(tags) {
    var list = normTags(tags);
    if (!list.length) return null;
    return h('div', { className: 'tb-tags' }, list.map(function (t, i) { return h(Tag, { key: i, tone: t.tone }, t.label); }));
  }

  function CartridgeCard(p) {
    var tool = p.kind === 'tool';
    return h('a', { href: p.href || '#', className: cx('tb-card', 'tb-lift', tool && 'tb-card--tool', stateClass(p.state), p.className) },
      h('div', { className: 'tb-card__strip' },
        h('span', null, 'No.' + (p.no || '00')),
        h('span', null, tool ? 'TOOL ▸' : 'GAME ▸')),
      p.image ? h('img', { className: 'tb-card__media', src: p.image, alt: p.imageAlt || '' }) : null,
      h('div', { className: 'tb-card__body' },
        h('div', { className: 'tb-card__head' },
          p.icon ? h(IconBox, { icon: p.icon, tone: p.iconTone }) : null,
          h('h3', { className: 'tb-card__title' }, p.title)),
        p.desc ? h('p', { className: 'tb-card__desc' }, p.desc) : null,
        TagList(p.tags)));
  }

  function FeatureCard(p) {
    return h('a', { href: p.href || '#', className: cx('tb-feature', 'tb-lift', stateClass(p.state), p.className) },
      h('div', { className: 'tb-feature__media' },
        p.image ? h('img', { src: p.image, alt: p.imageAlt || '' }) : null,
        p.badge ? h('span', { className: 'tb-feature__badge' }, p.badge) : null),
      h('div', { className: 'tb-feature__panel' },
        p.meta ? h('span', { className: 'tb-feature__meta' }, p.meta) : null,
        h('h3', { className: 'tb-feature__title' }, p.title),
        p.desc ? h('p', { className: 'tb-feature__desc' }, p.desc) : null,
        TagList(p.tags),
        p.cta ? h('span', { className: 'tb-feature__cta' }, h(Icon, { name: 'play', size: 16 }), p.cta) : null));
  }

  function SectionHeader(p) {
    return h('div', { className: cx('tb-sechead', p.className) },
      h('div', { className: 'tb-sechead__text' },
        p.eyebrow ? h('span', { className: 'tb-sechead__eyebrow' }, p.eyebrow) : null,
        h('h2', { className: 'tb-sechead__title', id: p.id }, p.title)),
      p.children || null);
  }

  function Marquee(p) {
    var items = p.items || [];
    var line = '★ ' + items.join(' ★ ') + ' ★';
    return h('div', { className: cx('tb-marquee', p.className), role: 'note', 'aria-label': items.join('、') },
      h('div', { className: 'tb-marquee__track', 'aria-hidden': 'true' }, line + ' ' + line));
  }

  function CtaPanel(p) {
    return h('div', { className: cx('tb-cta', 'tb-on-inverse', p.className) },
      h('div', { className: 'tb-cta__text' },
        p.eyebrow ? h('span', { className: 'tb-cta__eyebrow' }, p.eyebrow) : null,
        h('h2', { className: 'tb-cta__title' }, p.title),
        p.body ? h('p', { className: 'tb-cta__body' }, p.body) : null),
      h('div', { className: 'tb-cta__actions' }, p.children));
  }

  function Handheld(p) {
    return h('div', { className: cx('tb-hand', p.className) },
      h('div', { className: 'tb-hand__screen' },
        p.image ? h('img', { src: p.image, alt: p.imageAlt || '' }) : null,
        h('div', { className: 'tb-hand__caption' }, h('span', null, p.left || 'NOW PLAYING'), h('span', null, p.right))),
      h('div', { className: 'tb-hand__pad' },
        h('div', { className: 'tb-hand__dpad', 'aria-hidden': 'true' }, h('span'), h('span')),
        h('div', { className: 'tb-hand__ab' },
          h('button', { type: 'button', className: 'tb-hand__key', 'aria-label': 'B 鍵', onClick: p.onB }, 'B'),
          h('button', { type: 'button', className: 'tb-hand__key', 'aria-label': 'A 鍵', onClick: p.onA }, 'A'))),
      h('div', { className: 'tb-hand__pills', 'aria-hidden': 'true' }, h('span'), h('span')),
      h('div', { className: 'tb-hand__model' }, p.model || 'DKBO·BOY'));
  }

  window.Toybox = window.Toybox || {};
  Object.assign(window.Toybox, {
    Button: Button, IconButton: IconButton, NavLink: NavLink, SiteHeader: SiteHeader, StatusPill: StatusPill,
    Tag: Tag, StatTile: StatTile, IconBox: IconBox, SegmentedControl: SegmentedControl, CartridgeCard: CartridgeCard,
    FeatureCard: FeatureCard, SectionHeader: SectionHeader, Marquee: Marquee, CtaPanel: CtaPanel, Handheld: Handheld, Icon: Icon
  });
})();
