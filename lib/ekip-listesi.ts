/*
  EKİP YÖNETİMİ LİSTESİ (26.10.2026, kurum sahibinin isteği: "ekip
  yönetimi sayfasına geçelim" — sayfa öbür modüller gibi tek ekran, iki
  kart). Arama, süzgeç, sayaçlar ve seçim adres satırında
  (?q=…&rol=…&kurum=…&durum=…&sec=…): yenileyince ve paylaşınca korunur.

  Eskiden sayfa bütün kullanıcıları alt alta uzun kartlarla diziyordu;
  her kartta üç form vardı ve yüz kullanıcıda aranan kişiyi bulmanın
  tek yolu tarayıcının sayfa içi aramasıydı.

  Sayaçlar FİLTREDİR: sayı, basınca açılan listenin uzunluğu (aynı
  ekipSuz çağrısı) — Çalışmalarım'daki sayaçlarla aynı kural
  (lib/personel-sayaclari.ts).

  Saf modül; testi tests/unit/ekip-listesi.test.ts.
*/

export type EkipDurumu = "tumu" | "personel" | "uye" | "davet" | "durdurulmus" | "kurumsuz";

export type EkipFiltresi = { q: string; rol: string; kurum: string; durum: EkipDurumu };

export type EkipUyesi = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  organization_id: string | null;
  disabled: boolean;
  pendingInvite: boolean;
};

export const VARSAYILAN_EKIP_FILTRESI: EkipFiltresi = { q: "", rol: "", kurum: "", durum: "tumu" };

const DURUMLAR: EkipDurumu[] = ["tumu", "personel", "uye", "davet", "durdurulmus", "kurumsuz"];
/** Öğrenci/üye dışındaki her rol personeldir. */
const UYE_ROLU = "client";

const tek = (d: string | string[] | undefined) => (Array.isArray(d) ? d[0] : d) ?? "";

export function ekipFiltresiOku(params: Record<string, string | string[] | undefined>, roller: readonly string[]): EkipFiltresi {
  const rol = tek(params.rol);
  const durum = tek(params.durum) as EkipDurumu;
  return {
    q: tek(params.q).trim().slice(0, 100),
    rol: roller.includes(rol) ? rol : "",
    // Kurum kimliği doğrulanmıyor: listede olmayan kimlik sıfır satır verir, hata değil.
    kurum: tek(params.kurum).slice(0, 64),
    durum: DURUMLAR.includes(durum) ? durum : "tumu",
  };
}

const katla = (m: string) => m.toLocaleLowerCase("tr-TR").normalize("NFC");

export function ekipSuz<T extends EkipUyesi>(uyeler: T[], f: EkipFiltresi): T[] {
  const igne = katla(f.q);
  return uyeler.filter((u) => {
    if (igne && !katla(`${u.full_name ?? ""} ${u.email ?? ""}`).includes(igne)) return false;
    if (f.rol && u.role !== f.rol) return false;
    if (f.kurum && u.organization_id !== f.kurum) return false;
    switch (f.durum) {
      case "personel":
        return u.role !== UYE_ROLU;
      case "uye":
        return u.role === UYE_ROLU;
      case "davet":
        return u.pendingInvite;
      case "durdurulmus":
        return u.disabled;
      case "kurumsuz":
        return !u.organization_id;
      default:
        return true;
    }
  });
}

export function ekipAdresi(f: EkipFiltresi, sec?: string | null): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.rol) p.set("rol", f.rol);
  if (f.kurum) p.set("kurum", f.kurum);
  if (f.durum !== "tumu") p.set("durum", f.durum);
  if (sec) p.set("sec", sec);
  const s = p.toString();
  return s ? `/dashboard/team?${s}` : "/dashboard/team";
}

export type EkipSayaci = { durum: EkipDurumu; etiket: string; sayi: number; href: string; secili: boolean; ton?: "warning" | "danger" };

const SAYACLAR: { durum: EkipDurumu; etiket: string; ton?: "warning" | "danger" }[] = [
  { durum: "tumu", etiket: "Tüm kullanıcılar" },
  { durum: "personel", etiket: "Personel" },
  { durum: "uye", etiket: "Öğrenci / üye" },
  { durum: "davet", etiket: "Davet bekliyor", ton: "warning" },
  { durum: "kurumsuz", etiket: "Kurumsuz", ton: "warning" },
  { durum: "durdurulmus", etiket: "Erişimi durdurulmuş", ton: "danger" },
];

/* Sayaçlar arama ve rol/kurum süzgecinden bağımsız: "kurumun bütününde
   kaç tane" sorusunu yanıtlıyor. Basınca arama sıfırlanır. */
export function ekipSayaclari<T extends EkipUyesi>(uyeler: T[], f: EkipFiltresi): EkipSayaci[] {
  return SAYACLAR.map((s) => {
    const filtre = { ...VARSAYILAN_EKIP_FILTRESI, durum: s.durum };
    const secili = f.durum === s.durum && !f.rol && !f.kurum;
    return {
      durum: s.durum,
      etiket: s.etiket,
      sayi: ekipSuz(uyeler, filtre).length,
      href: ekipAdresi(secili && s.durum !== "tumu" ? VARSAYILAN_EKIP_FILTRESI : filtre),
      secili,
      ton: s.ton,
    };
  });
}

/** Ad soyadın baş harfleri: listede kim olduğu bir bakışta görünsün. */
export function basHarfler(ad: string | null, eposta: string | null): string {
  const kaynak = (ad ?? "").trim() || (eposta ?? "").split("@")[0] || "?";
  return (
    kaynak
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toLocaleUpperCase("tr-TR"))
      .join("") || "?"
  );
}
