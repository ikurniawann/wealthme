"use client";

import * as React from "react";

/**
 * Searchable emoji picker.
 *
 * Replaces the hand-written fixed grids that used to stand in for an icon
 * chooser — 10 emoji in `crud-config.ts`'s `mdkategori`, a different 8 in the
 * budget dialog — so a family whose category is a boat, a syringe, or a
 * violin simply could not represent it.
 *
 * Two deliberate choices:
 *
 *  - **Data is loaded on first open, never at page load.** The emoji set is
 *    ~1,900 entries (~840KB unpacked). A static import would put that in the
 *    bundle of every page that renders a form; the dynamic import keeps it out
 *    until someone actually opens a picker.
 *  - **Our own UI, not a third-party picker component.** The app renders the
 *    prototype's design system (`.input`, `.btn`, `.field`); dropping in a
 *    packaged picker would bring its own visual language and its own theme
 *    handling to fight with. Only the DATA is a dependency.
 */

type EmojiEntry = { emoji: string; name: string; group: string };

/**
 * Indonesian search aliases.
 *
 * The dataset's names are English ("house", "car", "pill"), and this is an
 * Indonesian app — typing "rumah" or "obat" would otherwise return nothing,
 * which reads as a broken search rather than a language mismatch. Scoped to
 * the vocabulary a household budget actually uses; anything not listed still
 * matches on its English name.
 */
const ID_ALIASES: Record<string, string[]> = {
  rumah: ["house", "home", "house with garden", "houses"],
  mobil: ["automobile", "car", "taxi", "sport utility vehicle"],
  motor: ["motorcycle", "motor scooter"],
  bensin: ["fuel pump"],
  kereta: ["train", "locomotive", "railway car", "metro"],
  pesawat: ["airplane"],
  kapal: ["ship", "sailboat", "ferry", "canoe"],
  sepeda: ["bicycle"],
  makan: ["fork and knife", "fork and knife with plate", "pot of food"],
  makanan: ["fork and knife with plate", "rice", "bento box"],
  minum: ["cup with straw", "teacup without handle", "tropical drink"],
  kopi: ["hot beverage"],
  belanja: ["shopping cart", "shopping bags", "convenience store"],
  pasar: ["convenience store", "shopping cart"],
  listrik: ["light bulb", "high voltage"],
  air: ["potable water", "droplet", "water wave"],
  gas: ["fire"],
  internet: ["globe with meridians", "satellite antenna"],
  telepon: ["mobile phone", "telephone receiver"],
  pulsa: ["mobile phone"],
  sekolah: ["school", "graduation cap", "backpack"],
  pendidikan: ["graduation cap", "books", "school"],
  buku: ["books", "closed book", "open book"],
  kuliah: ["graduation cap"],
  kesehatan: ["hospital", "pill", "stethoscope", "syringe"],
  obat: ["pill", "syringe"],
  dokter: ["stethoscope", "hospital"],
  rumahsakit: ["hospital"],
  olahraga: ["flexed biceps", "soccer ball", "person lifting weights"],
  gym: ["person lifting weights", "flexed biceps"],
  hiburan: ["video game", "clapper board", "musical notes"],
  film: ["clapper board", "movie camera"],
  musik: ["musical notes", "musical note", "violin", "guitar"],
  game: ["video game", "joystick"],
  liburan: ["airplane", "beach with umbrella", "palm tree"],
  wisata: ["beach with umbrella", "camera"],
  hadiah: ["wrapped gift"],
  donasi: ["folded hands", "handshake", "heart hands"],
  zakat: ["folded hands", "mosque"],
  amal: ["folded hands", "handshake"],
  gaji: ["money bag", "money with wings", "dollar banknote"],
  uang: ["money bag", "dollar banknote", "coin"],
  tabungan: ["money bag", "bank", "piggy bank"],
  investasi: ["chart increasing", "chart increasing with yen", "money bag"],
  emas: ["coin", "gem stone"],
  saham: ["chart increasing"],
  bank: ["bank", "credit card"],
  kartu: ["credit card"],
  pajak: ["receipt", "page facing up"],
  tagihan: ["receipt", "page facing up"],
  asuransi: ["shield", "umbrella"],
  anak: ["baby", "child", "family"],
  bayi: ["baby", "baby bottle"],
  keluarga: ["family", "family man woman girl"],
  hewan: ["dog face", "cat face", "paw prints"],
  anjing: ["dog face", "dog"],
  kucing: ["cat face", "cat"],
  kucing2: ["cat face"],
  pakaian: ["t-shirt", "dress", "jeans"],
  baju: ["t-shirt", "dress"],
  sepatu: ["running shoe", "athletic shoe"],
  cukur: ["barber pole"],
  salon: ["barber pole", "lipstick"],
  kerja: ["briefcase", "office building", "laptop"],
  kantor: ["office building", "briefcase"],
  laptop: ["laptop"],
  perbaikan: ["hammer and wrench", "wrench", "hammer"],
  bangunan: ["building construction", "brick"],
  parkir: ["p button"],
  tol: ["motorway"],
  darurat: ["shield", "rotating light"],
  target: ["direct hit", "bullseye"],
  doa: ["folded hands"],
  masjid: ["mosque"],
  gereja: ["church"],
};

/** Quick row shown above the grid: what a household budget reaches for most.
 *  Not a limit — just a shortcut past the search box. */
const QUICK_PICKS = [
  "🍽️",
  "🚗",
  "🏥",
  "🎓",
  "🏠",
  "💡",
  "🛒",
  "📱",
  "✈️",
  "🎁",
  "💰",
  "📈",
];

/** Resolves a query into the English terms to match against. */
function expandQuery(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const aliases = Object.entries(ID_ALIASES)
    .filter(([key]) => key.startsWith(q) || q.startsWith(key))
    .flatMap(([, terms]) => terms);
  return [q, ...aliases];
}

export function EmojiPicker({
  value,
  onChange,
  label,
  searchPlaceholder,
  noResultsLabel,
  loadingLabel,
  ariaLabel,
}: {
  value: string;
  onChange: (emoji: string) => void;
  label?: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  loadingLabel: string;
  ariaLabel: string;
}) {
  const [query, setQuery] = React.useState("");
  const [entries, setEntries] = React.useState<EmojiEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    // Dynamic on purpose — see the file header. The `.default` dance is
    // because the package ships a JSON-shaped default export.
    void import("unicode-emoji-json")
      .then((mod) => {
        if (cancelled) return;
        const data = (mod.default ?? mod) as Record<
          string,
          { name: string; group: string }
        >;
        setEntries(
          Object.entries(data).map(([emoji, meta]) => ({
            emoji,
            name: meta.name,
            group: meta.group,
          })),
        );
      })
      .catch(() => {
        // The quick-pick row below still works, so a failed load degrades to
        // the old fixed-grid behaviour instead of an unusable field.
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = React.useMemo(() => {
    if (!entries) return [];
    const terms = expandQuery(query);
    const matches = terms.length
      ? entries.filter((e) =>
          terms.some((term) => e.name.toLowerCase().includes(term)),
        )
      : entries;

    const byGroup = new Map<string, EmojiEntry[]>();
    for (const entry of matches) {
      const list = byGroup.get(entry.group);
      if (list) list.push(entry);
      else byGroup.set(entry.group, [entry]);
    }
    return [...byGroup.entries()];
  }, [entries, query]);

  const totalMatches = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className="field">
      {label && <span className="label">{label}</span>}

      {/* Current selection + quick picks. Always rendered, so the field is
          usable before the emoji data finishes loading (or if it fails). */}
      <div className="row row--wrap items-center gap-2">
        <span
          aria-hidden
          className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg border bg-card text-[18px]"
        >
          {value || "🏷️"}
        </span>
        <div
          role="group"
          aria-label={ariaLabel}
          className="row row--wrap gap-1"
        >
          {QUICK_PICKS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              aria-label={emoji}
              aria-pressed={value === emoji}
              className={`flex size-8 items-center justify-center rounded-lg border text-[15px] transition-colors hover:bg-accent ${
                value === emoji ? "border-primary bg-accent" : ""
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="input mt-2"
      />

      <div className="hide-scrollbar mt-2 max-h-[168px] overflow-y-auto rounded-lg border p-2">
        {entries === null && !loadFailed && (
          <p className="py-2 text-center text-[12px] text-muted-foreground">
            {loadingLabel}
          </p>
        )}
        {loadFailed && (
          <p className="py-2 text-center text-[12px] text-muted-foreground">
            {noResultsLabel}
          </p>
        )}
        {entries !== null && totalMatches === 0 && (
          <p className="py-2 text-center text-[12px] text-muted-foreground">
            {noResultsLabel}
          </p>
        )}
        {groups.map(([group, list]) => (
          <div key={group} className="mb-2 last:mb-0">
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              {group}
            </div>
            <div className="flex flex-wrap gap-1">
              {list.map((entry) => (
                <button
                  key={entry.emoji}
                  type="button"
                  onClick={() => onChange(entry.emoji)}
                  title={entry.name}
                  aria-label={entry.name}
                  aria-pressed={value === entry.emoji}
                  className={`flex size-8 items-center justify-center rounded-lg text-[15px] transition-colors hover:bg-accent ${
                    value === entry.emoji ? "bg-accent ring-1 ring-primary" : ""
                  }`}
                >
                  {entry.emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
