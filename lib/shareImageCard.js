// The share image's layout (rendered by next/og in app/api/listings/[id]/share-image).
// Plain createElement (no JSX) so a node script can render it too. Pure: everything it
// shows comes in `d`.
//   d: { format: 'story'|'square'|'og', W, H, photoW, photoH, img (data URL|null), logo (data URL),
//        op, price, noPrice, local, title, place, shortLink, qrLink, scan, tld }
import { createElement as h } from 'react';
import { qrMatrix, qrSvgPath } from './qr.js';

export const INK = '#111111';
export const PAPER = '#F9F4EE';
export const SIZES = { story: [1080, 1920], square: [1080, 1080], og: [1200, 630] };
// photo box per format
export const photoBox = (format) => (format === 'og' ? [640, 630] : format === 'story' ? [1080, 1060] : [1080, 600]);

const div = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);

function qr(text, size) {
  const m = qrMatrix(text);
  const n = m.size + 4;
  return div({ width: size, height: size, background: '#ffffff', borderRadius: 18, border: `4px solid ${INK}`, padding: 6 },
    h('svg', { width: size - 20, height: size - 20, viewBox: `0 0 ${n} ${n}` }, h('path', { d: qrSvgPath(m, 2), fill: INK })));
}

function brand(logo, size, tld) {
  return div({ alignItems: 'center', gap: 14 },
    h('img', { src: logo, width: size, height: size, style: { borderRadius: size / 2, border: `3px solid ${INK}` } }),
    div({ fontSize: size * 0.62, fontWeight: 700, color: INK, letterSpacing: -1 }, 'Casa-Libre', h('span', { style: { fontWeight: 500, opacity: 0.6 } }, tld || '')));
}

const chip = (text, size) => div({ alignSelf: 'flex-start', background: INK, color: PAPER, fontSize: size, fontWeight: 700, padding: `${size * 0.3}px ${size * 0.8}px`, borderRadius: 999, textTransform: 'uppercase', letterSpacing: 1 }, text);
const photo = (img, w, hgt) => (img ? h('img', { src: img, width: w, height: hgt, style: { objectFit: 'cover' } }) : div({ width: w, height: hgt, background: '#e8e1d8' }));

export function shareCard(d) {
  const font = { fontFamily: 'Space Grotesk', color: INK };
  if (d.format === 'og') {
    return div({ width: d.W, height: d.H, background: PAPER, ...font },
      photo(d.img, d.photoW, d.H),
      div({ flexDirection: 'column', justifyContent: 'space-between', width: d.W - d.photoW, padding: '44px 44px 40px', borderLeft: `6px solid ${INK}` },
        div({ flexDirection: 'column', gap: 16 },
          chip(d.op, 22),
          div({ fontSize: d.noPrice ? 44 : 60, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }, d.price),
          d.local ? div({ fontSize: 24, fontWeight: 500, opacity: 0.55 }, d.local) : null,
          div({ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }, d.title),
          div({ fontSize: 26, fontWeight: 500, opacity: 0.7, lineHeight: 1.2 }, d.place)),
        brand(d.logo, 56, d.tld)));
  }
  const story = d.format === 'story';
  const qrSize = story ? 300 : 230;
  return div({ flexDirection: 'column', width: d.W, height: d.H, background: PAPER, ...font },
    div({ position: 'relative', width: d.W, height: d.photoH, borderBottom: `8px solid ${INK}` },
      photo(d.img, d.W, d.photoH),
      div({ position: 'absolute', top: story ? 70 : 36, left: story ? 56 : 40, background: PAPER, borderRadius: 999, padding: story ? '12px 26px 12px 14px' : '8px 20px 8px 10px', border: `3px solid ${INK}` },
        brand(d.logo, story ? 60 : 46, d.tld))),
    div({ flexDirection: 'column', flex: 1, padding: story ? '48px 60px 64px' : '30px 44px 32px', gap: story ? 28 : 0, justifyContent: 'space-between' },
      div({ justifyContent: 'space-between', gap: 30 },
        div({ flexDirection: 'column', gap: story ? 14 : 10, flex: 1 },
          chip(d.op, story ? 30 : 22),
          div({ fontSize: story ? (d.noPrice ? 66 : 96) : (d.noPrice ? 50 : 72), fontWeight: 700, letterSpacing: -3, lineHeight: 1 }, d.price),
          d.local ? div({ fontSize: story ? 34 : 26, fontWeight: 500, opacity: 0.55 }, d.local) : null,
          div({ fontSize: story ? 42 : 32, fontWeight: 700, lineHeight: 1.15 }, d.title),
          div({ fontSize: story ? 36 : 28, fontWeight: 500, opacity: 0.7, lineHeight: 1.15 }, d.place)),
        story ? null : qr(d.qrLink, qrSize)),
      story
        ? div({ alignItems: 'center', gap: 36, background: '#ffffff', border: `4px solid ${INK}`, borderRadius: 32, padding: 28, boxShadow: `10px 10px 0 ${INK}` },
          qr(d.qrLink, qrSize),
          div({ flexDirection: 'column', gap: 16, flex: 1 },
            div({ fontSize: 38, fontWeight: 700, lineHeight: 1.15 }, d.scan),
            div({ fontSize: 30, fontWeight: 500, opacity: 0.65 }, d.shortLink)))
        : div({ fontSize: 26, fontWeight: 500, opacity: 0.65 }, d.shortLink)));
}
