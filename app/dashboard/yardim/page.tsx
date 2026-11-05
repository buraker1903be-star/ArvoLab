import type { Metadata } from "next";
import { ceviri } from "@/lib/dil-sunucu";
import { getAuthContext } from "@/lib/auth-guards";
import { kilavuzBolumleri, kilavuzSorulari } from "@/lib/yardim/kullanim-kilavuzu";
import SayfaBasligi from "../_components/sayfa/sayfa-basligi";
import KilavuzGorunumu, { type KilavuzBolumGorunumu, type KilavuzSoruGorunumu } from "./kilavuz-gorunumu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Kullanım Kılavuzu", en: "User Guide" }) };
}

/*
  KULLANIM KILAVUZU (30.10.2026). İçerik ve role göre süzme
  lib/yardim/kullanim-kilavuzu.ts'te; bu sayfa yalnızca çizer.

  Abonelik kapısı bu sayfayı kapatmaz (lib/abonelik-kapisi.ts): aboneliği
  kapanan kullanıcı ne yapacağını burada okuyabilmeli. Sayfa hiçbir şey
  yazmıyor, dış maliyet de üretmiyor.

  Metinler burada (sunucuda) çevrilir; görünüm, arama ve açılır bölümler
  kilavuz-gorunumu.tsx'te (4.4). Sayfa sunucuda tam çizilir: bölümler
  <details>, içindekiler çapa bağlantısı; JavaScript yüklenmeden de okunur
  ve açılıp kapanır, arama JavaScript gelince çalışır.
*/
export default async function KullanimKilavuzu() {
  const t = await ceviri();
  const ctx = await getAuthContext();
  // Oturum yoksa yerleşim zaten girişe yönlendirir; burada rolsüz (öğrenci) içerik yeter.
  const bolumler: KilavuzBolumGorunumu[] = kilavuzBolumleri(ctx?.role).map((b) => ({
    id: b.id,
    baslik: t(b.baslik),
    ozet: t(b.ozet),
    adimlar: (b.adimlar ?? []).map((a) => t(a)),
    notlar: (b.notlar ?? []).map((n) => t(n)),
    baglanti: b.baglanti ? { href: b.baglanti.href, etiket: t(b.baglanti.etiket) } : null,
  }));
  const sorular: KilavuzSoruGorunumu[] = kilavuzSorulari().map((s, i) => ({ id: `soru-${i + 1}`, soru: t(s.soru), cevap: t(s.cevap) }));

  return (
    <main className="dashboard-page kk-sayfa">
      <SayfaBasligi
        baslik={t({ tr: "Kullanım Kılavuzu", en: "User Guide" })}
        aciklama={t({
          tr: "ArvoLab'a yeni başlıyorsanız buradan başlayın: panelin düzeni, ilk çalışmanız ve her ekranın ne işe yaradığı.",
          en: "New to ArvoLab? Start here: the panel layout, your first work and what each screen is for.",
        })}
      />
      <KilavuzGorunumu bolumler={bolumler} sorular={sorular} />
    </main>
  );
}
