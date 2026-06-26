"use client";

import { useMemo, useState } from "react";
import nabidkyData from "../data/nabidky.json";
import recenzeData from "../data/recenze.json";
import type { Nabidka, HotelRecenze, Recenze, Vlastnosti } from "./types";

// Vybavení použité pro filtr i pro odznaky na kartě
const VYBAVENI: { key: keyof Vlastnosti; label: string; icon: string }[] = [
  { key: "bazen", label: "Bazén", icon: "🏊" },
  { key: "bazen_detsky", label: "Dětský bazén", icon: "👶" },
  { key: "aquapark_tobogan", label: "Aquapark / tobogán", icon: "🛝" },
  { key: "detsky_klub", label: "Dětský klub", icon: "🧸" },
  { key: "detske_hriste", label: "Dětské hřiště", icon: "🎠" },
  { key: "animace", label: "Animace", icon: "🎭" },
  { key: "wellness_spa", label: "Wellness / SPA", icon: "💆" },
  { key: "wifi", label: "Wi-Fi", icon: "📶" },
  { key: "klimatizace", label: "Klimatizace", icon: "❄️" },
];

const nabidky = (nabidkyData.nabidky as unknown as Nabidka[]) ?? [];
const hotelyRecenze = (recenzeData.hotely as unknown as HotelRecenze[]) ?? [];

const recenzeKlic = (zdroj_id: string, hotel: string) =>
  `${zdroj_id}::${hotel.toLowerCase().trim()}`;

const recenzeMap = new Map<string, HotelRecenze>(
  hotelyRecenze.map((h) => [recenzeKlic(h.zdroj_id, h.hotel), h])
);

const czk = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("cs-CZ").format(n) + " Kč";

const datum = (s: string) => {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${Number(d)}. ${Number(m)}. ${y}`;
  }
  return s; // už lidsky čitelné (např. "Červen 2026")
};

type Negativum = HotelRecenze["negativa_agregace"][number];

// Spočítá agregaci opakujících se negativ – z uložené agregace, jinak z recenzí.
function agregujNegativa(h: HotelRecenze): Negativum[] {
  if (h.negativa_agregace?.length) {
    return [...h.negativa_agregace].sort((a, b) => b.cetnost - a.cetnost);
  }
  const mapa = new Map<string, { tema: string; cetnost: number }>();
  for (const r of h.recenze) {
    for (const p of r.proti ?? []) {
      const k = p.toLowerCase().trim();
      const e = mapa.get(k) ?? { tema: p, cetnost: 0 };
      e.cetnost += 1;
      mapa.set(k, e);
    }
  }
  return [...mapa.values()].sort((a, b) => b.cetnost - a.cetnost);
}

type Razeni = "cena-asc" | "cena-desc" | "termin-asc";

export default function Home() {
  const [odlet, setOdlet] = useState("vse");
  const [zeme, setZeme] = useState("vse");
  const [jenPrazdniny, setJenPrazdniny] = useState(false);
  const [maxCena, setMaxCena] = useState(60000);
  const [razeni, setRazeni] = useState<Razeni>("cena-asc");
  const [minHvezdy, setMinHvezdy] = useState(0);
  const [strava, setStrava] = useState("vse");
  const [maxPlaz, setMaxPlaz] = useState(0); // 0 = bez omezení
  const [vyb, setVyb] = useState<Record<string, boolean>>({});
  const [zdroj, setZdroj] = useState("vse");
  const [terminOd, setTerminOd] = useState(""); // YYYY-MM-DD odlet od
  const [terminDo, setTerminDo] = useState(""); // YYYY-MM-DD odlet do
  const [limit, setLimit] = useState(48);

  const zemeMoznosti = useMemo(
    () => Array.from(new Set(nabidky.map((n) => n.destinace_zeme))).sort(),
    []
  );
  const odletMoznosti = ["Brno", "Ostrava"];
  const zdrojMoznosti = useMemo(
    () => Array.from(new Set(nabidky.map((n) => n.zdroj_nazev))).sort(),
    []
  );
  const stravaMoznosti = useMemo(
    () =>
      Array.from(
        new Set(nabidky.map((n) => n.vlastnosti?.strava ?? n.strava).filter(Boolean) as string[])
      ).sort(),
    []
  );

  const { nad, pod } = useMemo(() => {
    // Stav nabídky vůči filtrům:
    //  "ven"   = známý nesoulad → vyřadit
    //  "pod"   = nabídce chybí data pro některý aktivní filtr → pod čáru
    //  "nad"   = vyhovuje všem aktivním filtrům
    const klasifikuj = (n: Nabidka): "ven" | "pod" | "nad" => {
      // Tvrdé filtry (data jsou vždy k dispozici) → mismatch = ven
      if (odlet !== "vse" && !(n.odlet_letiste || "").includes(odlet)) return "ven";
      if (zeme !== "vse" && n.destinace_zeme !== zeme) return "ven";
      if (zdroj !== "vse" && n.zdroj_nazev !== zdroj) return "ven";
      if (jenPrazdniny && !n.splnuje_kriteria) return "ven";
      if (strava !== "vse" && (n.vlastnosti?.strava ?? n.strava) !== strava)
        return "ven";
      // Kalendář: datum odletu (termin_od) v rozsahu
      if (terminOd && (n.termin_od || "") < terminOd) return "ven";
      if (terminDo && (n.termin_od || "") > terminDo) return "ven";

      const v = n.vlastnosti;
      let chybiData = false;

      // Cena
      if (n.cena_celkem_kc == null) chybiData = true;
      else if (n.cena_celkem_kc > maxCena) return "ven";

      // Min. hvězdy
      if (minHvezdy > 0) {
        if (v?.hvezdy == null) chybiData = true;
        else if (v.hvezdy < minHvezdy) return "ven";
      }

      // Max. vzdálenost od pláže
      if (maxPlaz > 0) {
        if (v?.vzdalenost_od_plaze_m == null) chybiData = true;
        else if (v.vzdalenost_od_plaze_m > maxPlaz) return "ven";
      }

      // Vybavení (musí mít)
      for (const it of VYBAVENI) {
        if (!vyb[it.key]) continue;
        const hod = v?.[it.key];
        if (hod === true) continue;
        if (hod === false) return "ven";
        chybiData = true; // null/undefined = neuvedeno
      }

      return chybiData ? "pod" : "nad";
    };

    const cmp = (a: Nabidka, b: Nabidka) => {
      if (razeni === "cena-asc")
        return (a.cena_celkem_kc ?? Infinity) - (b.cena_celkem_kc ?? Infinity);
      if (razeni === "cena-desc")
        return (b.cena_celkem_kc ?? -1) - (a.cena_celkem_kc ?? -1);
      return a.termin_od.localeCompare(b.termin_od);
    };

    const nad: Nabidka[] = [];
    const pod: Nabidka[] = [];
    for (const n of nabidky) {
      const stav = klasifikuj(n);
      if (stav === "nad") nad.push(n);
      else if (stav === "pod") pod.push(n);
    }
    return { nad: nad.sort(cmp), pod: pod.sort(cmp) };
  }, [odlet, zeme, zdroj, jenPrazdniny, maxCena, razeni, minHvezdy, strava, maxPlaz, vyb, terminOd, terminDo]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">🏖️ Dovolená k moři</h1>
        <p className="mt-1 text-gray-600">
          Rodina 2 dospělí + 2 děti (5 a 8 let) · k moři, ne Egypt · odlet Brno /
          Ostrava · prázdniny · 7–14 nocí · do 60 000 Kč
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>{nabidky.length} nabídek</strong> ze zdrojů{" "}
        {zdrojMoznosti.join(", ")}. Ceny jsou <strong>za rodinu 2+2</strong> (2
        dospělí + děti 5 a 8 let). Badge{" "}
        <span className="font-mono">💬 x/y</span> = recenze lokálně / celkem na
        zdroji.
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-5">
        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-gray-700">Odlet</span>
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5"
            value={odlet}
            onChange={(e) => setOdlet(e.target.value)}
          >
            <option value="vse">Vše</option>
            {odletMoznosti.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-gray-700">Země</span>
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5"
            value={zeme}
            onChange={(e) => setZeme(e.target.value)}
          >
            <option value="vse">Vše</option>
            {zemeMoznosti.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-gray-700">Řazení</span>
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5"
            value={razeni}
            onChange={(e) => setRazeni(e.target.value as Razeni)}
          >
            <option value="cena-asc">Cena ↑</option>
            <option value="cena-desc">Cena ↓</option>
            <option value="termin-asc">Termín</option>
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 font-medium text-gray-700">
            Max. cena: {czk(maxCena)}
          </span>
          <input
            type="range"
            min={20000}
            max={80000}
            step={1000}
            value={maxCena}
            onChange={(e) => setMaxCena(Number(e.target.value))}
            className="mt-2"
          />
        </label>

        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={jenPrazdniny}
            onChange={(e) => setJenPrazdniny(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-medium text-gray-700">Jen splňující kritéria</span>
        </label>
      </section>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium text-gray-700">Min. hvězdy</span>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5"
              value={minHvezdy}
              onChange={(e) => setMinHvezdy(Number(e.target.value))}
            >
              <option value={0}>Vše</option>
              <option value={3}>3★ a víc</option>
              <option value={4}>4★ a víc</option>
              <option value={5}>5★</option>
            </select>
          </label>

          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium text-gray-700">Strava</span>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5"
              value={strava}
              onChange={(e) => setStrava(e.target.value)}
            >
              <option value="vse">Vše</option>
              {stravaMoznosti.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium text-gray-700">
              Max. od pláže: {maxPlaz === 0 ? "bez limitu" : `${maxPlaz} m`}
            </span>
            <input
              type="range"
              min={0}
              max={500}
              step={50}
              value={maxPlaz}
              onChange={(e) => setMaxPlaz(Number(e.target.value))}
              className="mt-2"
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium text-gray-700">Zdroj</span>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5"
              value={zdroj}
              onChange={(e) => setZdroj(e.target.value)}
            >
              <option value="vse">Vše</option>
              {zdrojMoznosti.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">
            📅 Termín odletu
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            {[
              { l: "Celé prázdniny", od: "2026-07-01", do: "2026-08-31" },
              { l: "Červenec", od: "2026-07-01", do: "2026-07-31" },
              { l: "Srpen", od: "2026-08-01", do: "2026-08-31" },
              { l: "1. půlka srpna", od: "2026-08-01", do: "2026-08-15" },
            ].map((c) => {
              const on = terminOd === c.od && terminDo === c.do;
              return (
                <button
                  key={c.l}
                  type="button"
                  onClick={() => {
                    setTerminOd(on ? "" : c.od);
                    setTerminDo(on ? "" : c.do);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    on
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {c.l}
                </button>
              );
            })}
            {(terminOd || terminDo) && (
              <button
                type="button"
                onClick={() => {
                  setTerminOd("");
                  setTerminDo("");
                }}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-gray-400"
              >
                ✕ zrušit
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>odlet od</span>
            <input
              type="date"
              min="2026-07-01"
              max="2026-08-31"
              value={terminOd}
              onChange={(e) => setTerminOd(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1"
            />
            <span>do</span>
            <input
              type="date"
              min="2026-07-01"
              max="2026-08-31"
              value={terminDo}
              onChange={(e) => setTerminDo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1"
            />
          </div>
        </div>

        <p className="mb-2 text-sm font-medium text-gray-700">Vybavení (musí mít)</p>
        <div className="flex flex-wrap gap-2">
          {VYBAVENI.map((it) => {
            const on = !!vyb[it.key];
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => setVyb((p) => ({ ...p, [it.key]: !p[it.key] }))}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {it.icon} {it.label}
              </button>
            );
          })}
        </div>
      </section>

      <p className="mb-4 text-sm text-gray-500">
        Vyhovuje filtru: {nad.length}
        {pod.length > 0 &&
          ` · ${pod.length} pod čarou (chybí data pro některý filtr)`}
      </p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {nad.slice(0, limit).map((n) => (
          <Karta
            key={n.id}
            n={n}
            rec={recenzeMap.get(recenzeKlic(n.zdroj_id, n.hotel)) ?? null}
          />
        ))}
      </div>

      {nad.length > limit && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 48)}
            className="rounded-lg border border-sky-600 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
          >
            Zobrazit další ({nad.length - limit})
          </button>
        </div>
      )}

      {nad.length === 0 && (
        <p className="py-10 text-center text-gray-400">
          Žádná nabídka plně neodpovídá filtru.
        </p>
      )}

      {pod.length > 0 && (
        <>
          <div className="my-8 flex items-center gap-3">
            <hr className="flex-1 border-t border-gray-300" />
            <span className="text-center text-xs font-medium text-gray-500">
              Níže: nabídky, u kterých chybí data pro některý zvolený filtr
            </span>
            <hr className="flex-1 border-t border-gray-300" />
          </div>
          <div className="grid grid-cols-1 gap-5 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {pod.slice(0, 24).map((n) => (
              <Karta
                key={n.id}
                n={n}
                rec={recenzeMap.get(recenzeKlic(n.zdroj_id, n.hotel)) ?? null}
              />
            ))}
          </div>
          {pod.length > 24 && (
            <p className="mt-4 text-center text-xs text-gray-400">
              … a dalších {pod.length - 24} pod čarou
            </p>
          )}
        </>
      )}
    </main>
  );
}

function Badge({ rec }: { rec: HotelRecenze }) {
  const barva = rec.kompletni
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
  return (
    <span
      title={`Lokálně uloženo ${rec.pocet_recenzi_lokalne} z ${rec.pocet_recenzi_vzdalene} recenzí na zdroji`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${barva}`}
    >
      💬 {rec.pocet_recenzi_lokalne}/{rec.pocet_recenzi_vzdalene}
      {!rec.kompletni && <span aria-hidden>⟳</span>}
    </span>
  );
}

function Skore({ rec }: { rec: HotelRecenze }) {
  const ok = rec.prosel_prahem;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        ok ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"
      }`}
      title={ok ? "Splňuje práh ≥ 3,5/5" : "Pod prahem 3,5/5"}
    >
      ★ {rec.skore.toLocaleString("cs-CZ")}/{rec.skore_skala}
      {!ok && " ⚠"}
    </span>
  );
}

function HodnoceniBadge({ h }: { h: NonNullable<Nabidka["hodnoceni"]> }) {
  const prah = h.skala === 5 ? 3.5 : h.skala === 10 ? 7.5 : 75; // 5 / 10 / %
  const ok = h.skore >= prah;
  const skalaTxt = h.skala === 100 ? "%" : `/${h.skala}`;
  return (
    <span
      title={`Hodnocení ${h.skore}${skalaTxt} (${h.zdroj ?? "zdroj"}${
        h.pocet ? `, ${h.pocet} hodnocení` : ""
      }) — práh ${h.skala === 5 ? "3,5/5" : h.skala === 10 ? "7,5/10" : "75 %"}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        ok ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700"
      }`}
    >
      ★ {h.skore.toLocaleString("cs-CZ")}
      {h.skala === 100 ? " %" : `/${h.skala}`}
      {h.pocet ? ` (${h.pocet})` : ""}
      {!ok && " ⚠"}
    </span>
  );
}

function VlastnostiBlok({ v }: { v: Vlastnosti }) {
  const [info, setInfo] = useState(false);
  const ma = VYBAVENI.filter((it) => v[it.key] === true);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        {v.hvezdy != null && (
          <span className="font-medium text-amber-600">{"★".repeat(v.hvezdy)}</span>
        )}
        {v.vzdalenost_od_plaze_m != null && (
          <span>
            🏖 {v.vzdalenost_od_plaze_m} m
            {v.typ_plaze ? ` (${v.typ_plaze})` : ""}
          </span>
        )}
        {v.strava && <span>🍽 {v.strava}</span>}
      </div>

      {ma.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {ma.map((it) => (
            <span
              key={String(it.key)}
              title={it.label}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
            >
              {it.icon} {it.label}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setInfo((x) => !x)}
        className="mt-2 text-xs font-medium text-sky-700 hover:underline"
      >
        {info ? "Skrýt info ▲" : "Info o hotelu ▼"}
      </button>
      {info && (
        <div className="mt-1 space-y-1 rounded bg-gray-50 p-2 text-xs text-gray-700">
          {v.typy_pokoju?.length > 0 && (
            <p>
              <strong>Pokoje:</strong> {v.typy_pokoju.join(", ")}
            </p>
          )}
          <p>
            <strong>Vzdálenosti:</strong> pláž {v.vzdalenost_od_plaze_m ?? "?"} m ·
            centrum {v.vzdalenost_centrum_m ?? "?"} m · letiště{" "}
            {v.vzdalenost_letiste_km ?? "?"} km
          </p>
          {v.co_je_v_cene?.length > 0 && (
            <p>
              <strong>V ceně:</strong> {v.co_je_v_cene.join(", ")}
            </p>
          )}
          {v.povinne_priplatky?.length > 0 && (
            <p className="text-amber-800">
              <strong>Příplatky:</strong> {v.povinne_priplatky.join(", ")}
            </p>
          )}
          {v.lehatka_slunecniky && (
            <p>
              <strong>Lehátka:</strong> {v.lehatka_slunecniky}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Karta({ n, rec }: { n: Nabidka; rec: HotelRecenze | null }) {
  const [otevreno, setOtevreno] = useState(false);
  const [otevrenaKat, setOtevrenaKat] = useState<string | null>(null);
  const recById = useMemo(() => {
    const m = new Map<string, Recenze>();
    rec?.recenze.forEach((r) => m.set(r.id, r));
    return m;
  }, [rec]);
  const negativa = rec ? agregujNegativa(rec) : [];
  const topNeg = negativa.slice(0, 2).map((x) => x.tema);
  const maxCet = negativa[0]?.cetnost ?? 1;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative h-44 w-full bg-gray-100">
        {n.foto_nahled_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={n.foto_nahled_url}
            alt={n.hotel}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            bez fotky
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            {n.destinace_zeme}
          </span>
          <span className="rounded-full bg-sky-600/90 px-2 py-0.5 text-xs font-medium text-white">
            ✈ {n.odlet_letiste}
          </span>
        </div>
        {n.splnuje_kriteria && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
            ✓ v termínu
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="text-lg font-semibold leading-tight">{n.hotel}</h2>
        <p className="text-sm text-gray-500">{n.destinace_oblast}</p>

        {n.vlastnosti && <VlastnostiBlok v={n.vlastnosti} />}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rec ? (
            <>
              <Skore rec={rec} />
              <Badge rec={rec} />
            </>
          ) : n.hodnoceni ? (
            <HodnoceniBadge h={n.hodnoceni} />
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              💬 bez recenzí
            </span>
          )}
        </div>

        {rec && topNeg.length > 0 && (
          <p className="mt-2 text-xs text-amber-800">
            ⚠ opakuje se: {topNeg.join(", ")}
          </p>
        )}

        <dl className="mt-3 space-y-1 text-sm text-gray-700">
          <div className="flex justify-between">
            <dt className="text-gray-500">Termín</dt>
            <dd>
              {datum(n.termin_od)} – {datum(n.termin_do)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Délka</dt>
            <dd>{n.delka_noci} nocí</dd>
          </div>
          {n.strava && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Strava</dt>
              <dd>{n.strava}</dd>
            </div>
          )}
        </dl>

        {n.poznamka_filtr && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
            {n.poznamka_filtr}
          </p>
        )}

        {rec && (
          <button
            onClick={() => setOtevreno((v) => !v)}
            className="mt-3 self-start text-sm font-medium text-sky-700 hover:underline"
          >
            {otevreno ? "Skrýt recenze ▲" : `Recenze (${rec.pocet_recenzi_lokalne}) ▼`}
          </button>
        )}

        {rec && otevreno && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-1 text-sm font-semibold text-gray-800">
              Na co si dát pozor{" "}
              <span className="font-normal text-gray-500">
                {rec.komentaru_s_textem != null
                  ? `(% ze všech ${rec.komentaru_s_textem} komentářů s textem)`
                  : `(z ${rec.pocet_recenzi_lokalne} uložených recenzí)`}
              </span>
            </p>
            <p className="mb-2 text-xs text-gray-400">
              Klikni na téma pro rozbalení konkrétních recenzí.
            </p>
            {negativa.length === 0 ? (
              <p className="text-xs text-gray-500">Zatím žádná negativa.</p>
            ) : (
              <ul className="space-y-1">
                {negativa.map((g) => {
                  const aktivni = otevrenaKat === g.tema;
                  const matched = (g.recenze_ids ?? [])
                    .map((id) => recById.get(id))
                    .filter((r): r is Recenze => Boolean(r));
                  const procNeg = g.procento_z_negativnich ?? g.procento;
                  const procCelku = g.procento_z_celku;
                  const klik = (g.recenze_ids?.length ?? 0) > 0;
                  return (
                    <li key={g.tema}>
                      <button
                        type="button"
                        disabled={!klik}
                        onClick={() => setOtevrenaKat(aktivni ? null : g.tema)}
                        title={
                          procCelku != null
                            ? `${procCelku}% ze všech komentářů · ${procNeg}% z negativních`
                            : undefined
                        }
                        className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-xs ${
                          klik ? "hover:bg-gray-100" : "cursor-default"
                        }`}
                      >
                        <span className="w-32 shrink-0 text-left text-gray-700">
                          {klik && (aktivni ? "▾ " : "▸ ")}
                          {g.tema}
                        </span>
                        <span className="h-2 flex-1 rounded bg-gray-200">
                          <span
                            className="block h-2 rounded bg-amber-500"
                            style={{ width: `${(g.cetnost / maxCet) * 100}%` }}
                          />
                        </span>
                        <span className="w-24 shrink-0 text-right text-gray-500">
                          {g.cetnost}×
                          {procCelku != null && (
                            <span className="ml-1 font-medium text-gray-700">
                              {procCelku}%
                            </span>
                          )}
                        </span>
                      </button>

                      {aktivni && matched.length > 0 && (
                        <ul className="ml-3 mt-1 space-y-1 border-l-2 border-amber-300 pl-2">
                          {matched.slice(0, 20).map((r) => (
                            <li key={r.id} className="text-xs">
                              <span className="text-gray-500">
                                ★ {r.skore}/{r.skore_skala} · {r.autor} ·{" "}
                                {datum(r.datum)}
                              </span>
                              <p className="text-gray-700">{r.text}</p>
                            </li>
                          ))}
                          {matched.length > 20 && (
                            <li className="text-xs text-gray-400">
                              … a dalších {matched.length - 20} recenzí
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mb-1 mt-3 text-sm font-semibold text-gray-800">
              Jednotlivé recenze{" "}
              <span className="font-normal text-gray-500">
                (zobrazeno{" "}
                {Math.min(50, rec.recenze.filter((r) => r.text).length)} z{" "}
                {rec.recenze.filter((r) => r.text).length} s textem)
              </span>
            </p>
            <ul className="space-y-2">
              {rec.recenze
                .filter((r) => r.text)
                .slice(0, 50)
                .map((r) => (
                <li
                  key={r.id}
                  className="rounded border border-gray-200 bg-white p-2 text-xs"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{r.autor}</span>
                    <span className="text-gray-500">
                      ★ {r.skore}/{r.skore_skala} · {datum(r.datum)}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-700">{r.text}</p>
                  {r.proti?.length > 0 && (
                    <p className="mt-1 text-red-600">− {r.proti.join(", ")}</p>
                  )}
                  {r.pro?.length > 0 && (
                    <p className="text-emerald-700">+ {r.pro.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
            <a
              href={rec.odkaz_recenze}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-sky-700 hover:underline"
            >
              Všechny recenze na zdroji →
            </a>
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {czk(n.cena_celkem_kc)}
              </p>
              <p className="text-xs text-gray-500">
                {n.cena_zaklad === "za_obsazeni_2_2" ? "za rodinu 2+2" : "za 2 os."}
                {n.cena_za_osobu_od_kc ? ` · ${czk(n.cena_za_osobu_od_kc)}/os` : ""}
              </p>
            </div>
            <a
              href={n.odkaz}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              Detail →
            </a>
          </div>
          <p className="mt-2 text-right text-xs text-gray-400">
            zdroj: {n.zdroj_nazev}
          </p>
        </div>
      </div>
    </article>
  );
}
