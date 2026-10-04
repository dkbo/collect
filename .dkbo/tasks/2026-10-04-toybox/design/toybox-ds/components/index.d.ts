import type * as React from 'react';

/** 預覽用：把 hover／active／focus 狀態固定顯示出來。正式頁面不要傳。 */
export type PreviewState = 'hover' | 'active' | 'focus';
export type IconName = 'arrow-down' | 'arrow-up-right' | 'play' | 'moon' | 'sun' | 'search' | 'list' | 'pin' | 'grid' | 'menu' | 'chevron-down';
export type StickerTone = 'pop' | 'sky' | 'mint' | 'pink' | 'plain';
export type TagInput = string | { label: string; tone?: StickerTone };

export interface IconProps { name: IconName; size?: number; className?: string }
export declare function Icon(props: IconProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = action 橘紅（每畫面最多一顆）；secondary = 白底；pop = 品牌黃；ink = 反白 */
  variant?: 'primary' | 'secondary' | 'pop' | 'ink';
  /** l = 52px 高（預設）；s = 44px 高 */
  size?: 'l' | 's';
  icon?: IconName | React.ReactNode;
  iconEnd?: IconName | React.ReactNode;
  /** 有 href 時渲染成 <a> */
  href?: string;
  state?: PreviewState;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName | React.ReactNode; label: string; state?: PreviewState }
export declare function IconButton(props: IconButtonProps): React.ReactElement;

export interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> { current?: boolean; menu?: boolean; state?: PreviewState }
export declare function NavLink(props: NavLinkProps): React.ReactElement;

export interface SiteHeaderProps {
  name?: string; letter?: string; homeHref?: string; label?: string; dark?: boolean;
  links?: { label: string; href?: string; current?: boolean; menu?: boolean }[];
  onToggleTheme?: () => void;
}
export declare function SiteHeader(props: SiteHeaderProps): React.ReactElement;

export interface StatusPillProps { tone?: 'success' | 'pop' | 'action'; children?: React.ReactNode; className?: string }
export declare function StatusPill(props: StatusPillProps): React.ReactElement;

export interface TagProps { tone?: StickerTone; size?: 's' | 'l'; tilt?: 1 | 2 | 3; children?: React.ReactNode; className?: string }
export declare function Tag(props: TagProps): React.ReactElement;

export interface StatTileProps { value: React.ReactNode; suffix?: string; label: string; className?: string }
export declare function StatTile(props: StatTileProps): React.ReactElement;

export interface IconBoxProps { icon: IconName | React.ReactNode; tone?: 'sky' | 'pop' | 'mint' | 'pink'; className?: string }
export declare function IconBox(props: IconBoxProps): React.ReactElement;

export interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value?: string; defaultValue?: string; onChange?: (value: string) => void;
  /** 群組的 aria-label */
  label: string; className?: string;
}
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export interface CartridgeCardProps {
  no: string; title: string; desc?: string; kind?: 'game' | 'tool';
  /** 16:9 WebP 截圖；game 用 */
  image?: string; imageAlt?: string;
  /** tool 用：標題左側的 IconBox */
  icon?: IconName; iconTone?: IconBoxProps['tone'];
  tags?: TagInput[]; href?: string; state?: PreviewState; className?: string;
}
export declare function CartridgeCard(props: CartridgeCardProps): React.ReactElement;

export interface FeatureCardProps {
  title: string; desc?: string; meta?: string; badge?: string; cta?: string;
  image?: string; imageAlt?: string; tags?: TagInput[]; href?: string; state?: PreviewState; className?: string;
}
export declare function FeatureCard(props: FeatureCardProps): React.ReactElement;

export interface SectionHeaderProps { eyebrow?: string; title: string; id?: string; children?: React.ReactNode; className?: string }
export declare function SectionHeader(props: SectionHeaderProps): React.ReactElement;

export interface MarqueeProps { items: string[]; className?: string }
export declare function Marquee(props: MarqueeProps): React.ReactElement;

export interface CtaPanelProps { eyebrow?: string; title: string; body?: string; children?: React.ReactNode; className?: string }
export declare function CtaPanel(props: CtaPanelProps): React.ReactElement;

export interface HandheldProps { image?: string; imageAlt?: string; left?: string; right?: string; model?: string; onA?: () => void; onB?: () => void; className?: string }
export declare function Handheld(props: HandheldProps): React.ReactElement;

declare global {
  interface Window {
    Toybox: {
      Button: typeof Button; IconButton: typeof IconButton; NavLink: typeof NavLink; SiteHeader: typeof SiteHeader;
      StatusPill: typeof StatusPill; Tag: typeof Tag; StatTile: typeof StatTile; IconBox: typeof IconBox;
      SegmentedControl: typeof SegmentedControl; CartridgeCard: typeof CartridgeCard; FeatureCard: typeof FeatureCard;
      SectionHeader: typeof SectionHeader; Marquee: typeof Marquee; CtaPanel: typeof CtaPanel; Handheld: typeof Handheld; Icon: typeof Icon;
    };
  }
}
