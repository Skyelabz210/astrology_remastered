function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\bft\b/g, 'fort').replace(/\bst\b/g, 'saint').replace(/\bmt\b/g, 'mount')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
export function matchesPlace(query, haystack) {
  const q = normalize(query), hay = normalize(haystack);
  if (!q || hay.includes(q)) return true;
  const words = hay.split(' ');
  return q.split(' ').every(token => words.some(word => word.startsWith(token)
    || (token.length >= 4 && word[0] === token[0] && Math.abs(word.length - token.length) <= 2 && distance(token, word) <= (token.length >= 6 ? 2 : 1))));
}
if (typeof window !== 'undefined') window.PlaceSearch = { matchesPlace };
