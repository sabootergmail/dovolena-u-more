export type Obsazeni = {
  dospeli: number;
  deti: number[];
};

export type Vlastnosti = {
  hvezdy: number | null;
  vzdalenost_od_plaze_m: number | null;
  typ_plaze: string | null;
  vzdalenost_centrum_m: number | null;
  vzdalenost_letiste_km: number | null;
  strava: string | null;
  typy_pokoju: string[];
  bazen: boolean | null;
  bazen_detsky: boolean | null;
  aquapark_tobogan: boolean | null;
  detsky_klub: boolean | null;
  detske_hriste: boolean | null;
  animace: boolean | null;
  wellness_spa: boolean | null;
  wifi: boolean | null;
  klimatizace: boolean | null;
  lehatka_slunecniky: string | null;
  doprava: string | null;
  transfer_v_cene: boolean | null;
  co_je_v_cene: string[];
  povinne_priplatky: string[];
};

export type Nabidka = {
  id: string;
  zdroj_id: string;
  zdroj_nazev: string;
  poradajici_ck?: string | null;
  hotel: string;
  destinace_zeme: string;
  destinace_oblast?: string | null;
  odlet_letiste: string;
  termin_od: string;
  termin_do: string;
  delka_noci: number;
  strava?: string | null;
  obsazeni: Obsazeni;
  cena_celkem_kc?: number | null;
  cena_za_osobu_od_kc?: number | null;
  cena_zaklad: string;
  foto_nahled_url?: string | null;
  foto_galerie_urls?: string[];
  odkaz: string;
  splnuje_kriteria: boolean;
  poznamka_filtr?: string;
  vlastnosti?: Vlastnosti;
  hodnoceni?: {
    skore: number;
    skala: number;
    pocet?: number | null;
    zdroj?: string;
  } | null;
  "staženo"?: string;
};

export type Recenze = {
  id: string;
  datum: string;
  autor: string;
  skore: number;
  skore_skala: number;
  typ_cesty?: string | null;
  text: string;
  pro: string[];
  proti: string[];
  strana: number;
};

export type HotelRecenze = {
  hotel_id: string;
  hotel: string;
  destinace?: string;
  zdroj_id: string;
  odkaz_recenze: string;
  skore: number;
  skore_skala: number;
  prosel_prahem: boolean;
  pocet_recenzi_vzdalene: number;
  pocet_recenzi_lokalne: number;
  kompletni: boolean;
  recenze: Recenze[];
  negativa_zaklad?: number;
  komentaru_s_textem?: number;
  negativa_agregace: {
    tema: string;
    cetnost: number;
    procento?: number;
    procento_z_negativnich?: number;
    procento_z_celku?: number;
    recenze_ids?: string[];
    ukazka?: string;
  }[];
  negativa_shrnuti?: string | null;
};

export type NabidkySoubor = {
  _meta: {
    popis: string;
    stazeno: string;
    dulezite: string[];
    filtr_kriteria: Record<string, unknown>;
  };
  nabidky: Nabidka[];
};
