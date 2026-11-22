// Renders the share image card (lib/shareImageCard.js) with sample data to PNG files, without
// the Next server — next/og can't load its font in a Windows production build, this can.
//   node scripts/share-image-preview.mjs <out dir> [photo.jpg]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { shareCard, SIZES, photoBox } from '../lib/shareImageCard.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
// OG_MODULE: another copy of @vercel/og's index.node.js (on Windows its own font path breaks)
const ogPath = process.env.OG_MODULE || require.resolve('next/dist/compiled/@vercel/og/index.node.js');
const { ImageResponse } = await import(pathToFileURL(ogPath).href);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = process.argv[2] || '.';
const photoFile = process.argv[3] || path.join(root, 'public/no-photo/casa-libre-sin-foto-1200x900.jpg');
const fonts = [
  { name: 'Space Grotesk', data: fs.readFileSync(path.join(root, 'lib/fonts/SpaceGrotesk-Medium.ttf')), weight: 500, style: 'normal' },
  { name: 'Space Grotesk', data: fs.readFileSync(path.join(root, 'lib/fonts/SpaceGrotesk-Bold.ttf')), weight: 700, style: 'normal' },
];
const logo = `data:image/png;base64,${(await sharp(path.join(root, 'public/logo.png')).resize(160, 160).png().toBuffer()).toString('base64')}`;
for (const format of Object.keys(SIZES)) {
  const [W, H] = SIZES[format];
  const [photoW, photoH] = photoBox(format);
  const img = `data:image/jpeg;base64,${(await sharp(photoFile).resize(photoW, photoH, { fit: 'cover' }).jpeg().toBuffer()).toString('base64')}`;
  const tree = shareCard({
    format, W, H, photoW, photoH, img, logo, tld: '.py', noPrice: false, op: 'En venta', price: 'US$ 180.000', local: '≈ ₲ 1.314.000.000',
    title: 'Casa · 3 dormitorios · 180 m²', place: 'Villa Morra, Asunción', shortLink: 'casa-libre.com.py/l/3o5mxh1m',
    qrLink: 'https://casa-libre.com.py/l/3o5mxh1m?c=qr', scan: 'Escaneá para ver fotos y escribir al dueño',
  });
  const png = Buffer.from(await new ImageResponse(tree, { width: W, height: H, fonts }).arrayBuffer());
  fs.writeFileSync(path.join(out, `share-${format}.png`), png);
  console.log(format, png.length);
}
