import knowledge from "@/src/modules/assistant/knowledge.json";

export type SearchSource = "platform" | "africa" | "oncall";
export type SearchResult = { id: string; type: string; title: string; excerpt: string; href: string; source: SearchSource; score: number };
export function excerpt(value: string, query = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  const start = index > 65 ? index - 65 : 0;
  return (start ? "..." : "") + text.slice(start, start + 180) + (text.length > start + 180 ? "..." : "");
}
export function rank(title: string, text: string, query: string) {
  const q = query.toLowerCase(); const t = title.toLowerCase(); const body = text.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.every(word => (t + " " + body).includes(word))) return 0;
  return (t === q ? 100 : t.includes(q) ? 40 : 0) + words.reduce((sum,w) => sum + (t.includes(w) ? 8 : 1), 0);
}
export function searchLibrary(query: string, isAdmin: boolean): SearchResult[] {
  const found = new Map<string, SearchResult>();
  for (const doc of knowledge.documents) {
    if (doc.url === "/dashboard/admin" && !isAdmin) continue;
    const score = rank(doc.title, doc.text, query); if (!score) continue;
    const result: SearchResult = { id: doc.url, type: doc.kind === "platform" ? "Platform help" : "Website", title: doc.title, excerpt: excerpt(doc.text, query), href: doc.url, source: doc.kind === "platform" ? "platform" : doc.url.includes("zibukeoncall.co.za") ? "oncall" : "africa", score };
    if ((found.get(doc.url)?.score || 0) < score) found.set(doc.url, result);
  }
  return [...found.values()];
}
export const websiteIndexedAt = knowledge.updatedAt;
export function escapeLike(value: string) { return value.replace(/[!%_]/g, (character) => "!" + character); }
