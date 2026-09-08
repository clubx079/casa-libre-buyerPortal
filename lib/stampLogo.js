// Stamp the Casa Libre mascot onto a user-uploaded photo — the SAME brand stamp
// the scraper applies to complete listings (centered mascot, scale 0.72,
// opacity 0.22 → webp). Mirrors casa-libre-adminPortal/lib/watermark.js so a
// user's photos look identical to scraped ones on the marketplace.
//
// Best-effort by design: `sharp` is imported dynamically so that if the native
// module is unavailable, the caller catches and falls back to the raw image —
// a listing is never blocked and a photo is never lost.
import 'server-only';
import path from 'path';

// public/mascot.png is byte-identical to the scraper's assets/mascot.png.
const MASCOT_PATH = path.join(process.cwd(), 'public', 'mascot.png');

export async function stampLogo(inputBytes, opts = {}) {
  const { opacity = 0.22, scale = 0.72 } = opts;
  if (!inputBytes || !(Buffer.isBuffer(inputBytes) || inputBytes instanceof Uint8Array)) {
    throw new Error('stampLogo: inputBytes must be a Buffer/Uint8Array');
  }
  const mod = await import('sharp');
  const sharp = mod.default || mod;

  // Respect EXIF orientation first, then read the resulting pixel dimensions.
  const { data: baseBuf, info } = await sharp(inputBytes, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;
  if (!width || !height) throw new Error('stampLogo: could not read image dimensions');

  const targetW = Math.max(24, Math.round(width * scale));
  const mascotBuf = await sharp(MASCOT_PATH).resize({ width: targetW }).png().toBuffer();
  const mm = await sharp(mascotBuf).metadata();
  const mw = mm.width, mh = mm.height;
  const mx = Math.round((width - mw) / 2);
  const my = Math.round((height - mh) / 2);

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><image x="${mx}" y="${my}" width="${mw}" height="${mh}" href="data:image/png;base64,${mascotBuf.toString('base64')}" opacity="${opacity}"/></svg>`;

  return await sharp(baseBuf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: 82 })
    .toBuffer();
}
