// Delete account asks the person to type a word first, so it can't happen by an
// accidental tap. Either word works in either language. Same rule in the app.
export const DELETE_WORD = { es: 'ELIMINAR', en: 'DELETE' };

export function deleteWordOk(input) {
  const s = String(input ?? '').trim().toUpperCase();
  return s === DELETE_WORD.es || s === DELETE_WORD.en;
}
