// A photo's "picture fingerprint" (difference hash): the image shrunk to 9×8 grey pixels,
// one bit per pixel = is it brighter than the pixel to its right → 64 bits, as 16 hex
// characters. The same photo re-uploaded (resized, re-compressed, our logo stamped on it)
// gives almost the same bits; a different photo gives very different ones. Compare two
// with hamming() in lib/duplicateCheck.js.
import 'server-only';
import sharp from 'sharp';

export async function dHash(buf) {
  if (!buf || !buf.length) return null;
  const { data } = await sharp(buf).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let hex = '';
  for (let y = 0; y < 8; y++) {
    let nibble = 0;
    for (let x = 0; x < 8; x++) {
      nibble = (nibble << 1) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1 : 0);
      if (x % 4 === 3) { hex += nibble.toString(16); nibble = 0; }
    }
  }
  return hex;
}
