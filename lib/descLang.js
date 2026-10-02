// Rough language guess for a listing description. A property page offers the
// "Translate" button only when the text doesn't already look like the language the
// visitor is reading. Counts common Spanish vs English listing words; null = can't
// tell (the button then shows). Same rule in the app (casa-libre-mobile-app/lib/descLang.js).
const ES = new Set(('de la el los las del en y con para por una un que se su sus al muy más está esta este son tiene cuenta '
  + 'cuadras cuadra dormitorios dormitorio baño baños cocina sala comedor venta alquiler terreno casa departamento '
  + 'ubicado ubicada excelente zona amplio amplia patio cochera piscina barrio').split(' '));
const EN = new Set(('the and with for of to in is this that on has have are at from by it its very '
  + 'bedroom bedrooms bathroom bathrooms kitchen living room sale rent house apartment located excellent area '
  + 'large spacious garage pool neighborhood').split(' '));

export function guessLang(text) {
  const words = String(text || '').toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (ES.has(w)) es += 1;
    else if (EN.has(w)) en += 1;
  }
  if (es + en < 3) return null;
  if (es >= en * 2) return 'es';
  if (en >= es * 2) return 'en';
  return null;
}
