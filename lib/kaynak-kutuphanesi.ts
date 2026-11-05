import { atifDurumlari } from "@/lib/atif-eslesmesi";
import { kaynakAnahtarlari } from "@/lib/kaynak-aktarim";
import { doiAyikla } from "@/lib/kanit/kunye-karsilastirma";
import type { AtifTuru } from "@/lib/atif/stiller";

/*
  KAYNAK KÜTÜPHANESİ — SAF KARARLAR (Signature OS 4.2, 05.11.2026).

  Kaynaklar sayfasındaki listenin ve ayrıntı panelinin gösterdiği iki şey
  burada hesaplanır; birim testi tests/unit/kaynak-kutuphanesi.test.ts.
  İkisi de YENİ bir ölçüt icat etmez, var olanları bir araya getirir.

  1) OLASI TEKRARLAR. Ölçüt içe aktarmanınkiyle aynı (kaynakAnahtarlari:
     DOI, ya da harf-sayıya indirgenmiş başlık + yıl). İçe aktarma ve DOI
     ile ekleme tekrarı zaten eklemiyor; ama "Manuel kaynak ekle" ve
     arama sonuçlarından ekleme eklerken bakmıyor, eski kayıtlarda da
     tekrar olabilir. Liste tekrarı SİLMEZ, işaretler: hangisinin doğru
     kayıt olduğuna öğrenci karar verir.

  2) KAYNAĞIN ÇALIŞMADAKİ YERİ. Üç ayrı bilgi, birbirinin yerine geçmez:
     - metinde: atıf METİNDEN okunuyor, durum alanından değil (editördeki
       "Kullanılmayı bekleyen kaynaklar" kartıyla aynı kural,
       lib/bekleyen-kaynaklar.ts): ilk yazarın soyadı ve yıl gövdede
       birlikte geçiyorsa. Bilinemiyorsa null — numaralı ve dipnotlu
       stilde metinde soyad yok, yazarsız kaynakta aranacak ad yok, metin
       okunamadıysa bilgi yok. "Bilinmiyor"u "geçmiyor" diye göstermek
       öğrenciyi kaynağı silmeye götürebilirdi.
     - kanıt: kanıt matrisinde bu kaynağa bağlı iddia sayısı
       (kanit_kayitlari.kaynak_id — veritabanındaki gerçek bağ).
     - pdf: çalışma klasöründe DOI'si BİREBİR aynı olan bir PDF. Bu
       kalıcı bir bağ DEĞİL (o, onay bekleyen R2): PDF kaydı kaynakça
       künyesine bağlı; eşleşme ekranda DOI karşılaştırmasıyla kuruluyor
       ve öyle yazılıyor. DOI'siz kaynakta eşleşme aranmaz — başlık
       benzerliğiyle "bu PDF bu kaynak" demek tahmin olurdu.
*/

type TekrarKaydi = { id: string; title: string; year: string | null; doi_or_url: string | null };

/** id → aynı görünen ÖTEKİ kayıtların id'leri. Tekrarı olmayan kayıt haritada yok. */
export function olasiTekrarlar(kaynaklar: TekrarKaydi[]): Map<string, string[]> {
  const anahtarda = new Map<string, string[]>();
  for (const k of kaynaklar) {
    for (const a of new Set(kaynakAnahtarlari(k))) {
      // Başlığı da yılı da olmayan kaydın anahtarı ("b::") her şeyle eşleşirdi.
      if (a === "b::") continue;
      anahtarda.set(a, [...(anahtarda.get(a) ?? []), k.id]);
    }
  }
  const sonuc = new Map<string, Set<string>>();
  for (const ids of anahtarda.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const digerleri = sonuc.get(id) ?? new Set<string>();
      for (const d of ids) if (d !== id) digerleri.add(d);
      sonuc.set(id, digerleri);
    }
  }
  return new Map([...sonuc].map(([id, s]) => [id, [...s]]));
}

export type KaynakBaglami = {
  /** null: bilinemiyor (numaralı/dipnotlu stil, yazarsız kaynak, metin yok ya da okunamadı). */
  metinde: boolean | null;
  kanitSayisi: number;
  /** Çalışma klasöründe DOI'si aynı olan PDF var mı. */
  pdf: boolean;
};

type BaglamKaydi = { id: string; authors: string | null; year: string | null; doi_or_url: string | null };

export function kaynakBaglamlari(
  kaynaklar: BaglamKaydi[],
  girdi: {
    /** Kaynakça bölümü HARİÇ metin; null: okunamadı. */
    govdeMetni: string | null;
    atifTuru: AtifTuru;
    /** Dipnot metinleri (dipnotlu stilde eşleşmeye katılır); verilmezse dipnotlu stilde bilinmiyor. */
    dipnotlar?: string[] | null;
    /** kanit_kayitlari.kaynak_id değerleri (çalışmanın bütün iddiaları). */
    kanitKaynaklari: (string | null)[];
    /** Çalışma klasöründe dosyası OLAN PDF kayıtlarının DOI'leri. */
    pdfDoileri: (string | null)[];
  },
): Record<string, KaynakBaglami> {
  /* Metindeki atıf: editörün "bekleyen kaynaklar" kartıyla AYNI fonksiyon (lib/atif-eslesmesi.ts, 4.3.5). */
  const atif = atifDurumlari(kaynaklar, { atifTuru: girdi.atifTuru, govdeMetni: girdi.govdeMetni, dipnotlar: girdi.dipnotlar });
  const kanit = new Map<string, number>();
  for (const id of girdi.kanitKaynaklari) if (id) kanit.set(id, (kanit.get(id) ?? 0) + 1);
  const pdfler = new Set(girdi.pdfDoileri.map((d) => doiAyikla(d)).filter((d): d is string => Boolean(d)));

  const sonuc: Record<string, KaynakBaglami> = {};
  for (const k of kaynaklar) {
    const metinde = atif[k.id] === "okunamaz" ? null : atif[k.id] === "metinde";
    const doi = doiAyikla(k.doi_or_url);
    sonuc[k.id] = { metinde, kanitSayisi: kanit.get(k.id) ?? 0, pdf: Boolean(doi && pdfler.has(doi)) };
  }
  return sonuc;
}
