// Replaces {{variavel}} placeholders with contact data.
// Built-ins: nome, telefone. Anything else is looked up in contact.extras (case-insensitive).
export function renderTemplate(content, contact) {
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, rawKey) => {
    const key = rawKey.trim().toLowerCase();
    if (key === 'nome') return contact.name ?? '';
    if (key === 'telefone') return contact.phone ?? '';

    const extraKey = Object.keys(contact.extras ?? {}).find(
      (k) => k.toLowerCase() === key
    );
    if (extraKey) return String(contact.extras[extraKey] ?? '');

    return match;
  });
}
