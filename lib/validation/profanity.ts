// Pure helper. STARTER list for display names and bios: extend it (including Nepali/Hindi romanized terms)
// and review reports in the admin queue; no word list catches everything.
const TOKENS = new Set([
  "fuck", "fucker", "fucking", "shit", "shitty", "bitch", "asshole", "ass", "dick", "cock", "pussy", "cunt",
  "slut", "whore", "bastard", "porn", "nigger", "nigga", "faggot", "retard",
]);
const STEMS = ["fuck", "cunt", "bitch", "nigger", "faggot", "whore"]; // long enough to match inside a collapsed string

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[01345 7@$!]/g, (c) => LEET[c] ?? c);
}

const dedupe = (t: string) => t.replace(/(.)\1+/g, "$1");
const STEM_DEDUPED = STEMS.map(dedupe);

export function containsProfanity(text: string): boolean {
  const raw = normalize(text).split(/[^a-z]+/).filter(Boolean);
  // merge runs of single letters: "f u c k" / "f.u.c.k" -> "fuck"
  const tokens: string[] = [];
  let run = "";
  for (const t of raw) {
    if (t.length === 1) { run += t; continue; }
    if (run) { tokens.push(run); run = ""; }
    tokens.push(t);
  }
  if (run) tokens.push(run);
  // whole-token matching (never substring matching inside normal words, so "classic" and "Scunthorpe" pass)
  return tokens.some((t) => {
    const d = dedupe(t);
    return TOKENS.has(t) || STEM_DEDUPED.some((s) => d === s || d.startsWith(s));
  });
}
