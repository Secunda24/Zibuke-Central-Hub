import snapshot from "./knowledge.json";

export type Reference = { id: string; title: string; url: string; text: string; fetchedAt: string };
const stop = new Set("a an the is are was were be been and or for to of in on at with my me i you your we our it this that do does can could please how what which tell about help use using hi hello hey thanks thank welcome morning afternoon evening".split(" "));
function terms(text: string) {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 1 && !stop.has(t)).map(t => t.length > 4 ? t.replace(/s$/, "") : t))];
}
const chunks = snapshot.documents.flatMap(doc => {
  const result: Omit<Reference, "id">[] = [];
  const words = doc.text.split(/\s+/);
  for (let i = 0; i < words.length; i += 230) result.push({ title: doc.title, url: doc.url, text: words.slice(i, i + 280).join(" "), fetchedAt: doc.fetchedAt });
  return result;
});
export const knowledgeUpdatedAt = snapshot.updatedAt;
export function retrieveReferences(question: string, currentPath = "", isAdmin = false): Reference[] {
  const query = terms(question);
  const expansions: Record<string, string[]> = { pricing: ["price", "cost", "plan"], cost: ["price", "pricing"], contact: ["phone", "email"], founder: ["founded", "founder", "mawabo"], call: ["meeting", "microphone", "camera"], summarize: ["summary", "tldr"], password: ["settings"], upload: ["file", "document"] };
  const expanded = [...new Set(query.flatMap(term => [term, ...(expansions[term] || [])]))];
  if (!expanded.length) return [];
  const candidates = chunks.filter(doc => isAdmin || doc.url !== "/dashboard/admin");
  const scored = candidates.map(doc => {
    const titleTerms = terms(doc.title + " " + doc.url);
    const textTerms = terms(doc.text);
    let score = 0;
    for (const term of expanded) {
      if (titleTerms.includes(term)) score += 4;
      if (textTerms.includes(term)) score += query.includes(term) ? 2 : 1;
    }
    if (score && currentPath === doc.url) score += 2;
    return { doc, score };
  }).filter(row => row.score > 0).sort((a,b) => b.score - a.score);
  const selected: Reference[] = []; const perPage = new Map<string, number>();
  for (const { doc } of scored) {
    const n = perPage.get(doc.url) || 0; if (n >= 2) continue;
    selected.push({ ...doc, id: `S${selected.length + 1}` }); perPage.set(doc.url, n + 1);
    if (selected.length >= 7) break;
  }
  return selected;
}
