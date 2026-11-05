import { FolderSearch, Layers } from "lucide-react";
import BosDurum from "./bos-durum";
import { ListeSatiri } from "./genel-bakis";
import { ceviri } from "@/lib/dil-sunucu";
import { secimAdresi } from "@/lib/calisma-secimi";

/*
  ÇALIŞMA SEÇİMİ / BULUNAMADI (Signature OS 4.3.5, B1; karar
  lib/calisma-secimi.ts). Kaynaklar, Analiz Merkezi ve Belge Kontrol
  ortak kullanır.

  "Bulunamadı" adresteki kimlik hakkında HİÇBİR ŞEY söylemez (başlık,
  sahip, var olup olmadığı): bulunamayan ile erişilemeyen aynı ekranı
  görür. Altındaki liste yalnızca kullanıcının KENDİ çalışmaları.
  Eskiden bu iki durumda sayfa sessizce ilk çalışmayı açıyordu.
*/
export default async function CalismaSecimDurumu({
  tur,
  calismalar,
  yol,
  ek,
  bolum,
}: {
  tur: "bulunamadi" | "secim-gerekli";
  calismalar: { id: string; title: string }[];
  /** Sayfanın adresi; seçim ?calisma= ile ona eklenir. */
  yol: string;
  /** Korunacak ek adres parametreleri (ör. DOI). */
  ek?: Record<string, string | undefined>;
  /** Sayfanın verisi: ad ("Kaynaklar") ve belirtme hâli ("kaynaklarını"). */
  bolum: { ad: { tr: string; en: string }; hal: { tr: string; en: string } };
}) {
  const t = await ceviri();
  const bulunamadi = tur === "bulunamadi";
  return (
    <BosDurum
      ikon={bulunamadi ? FolderSearch : Layers}
      baslik={bulunamadi ? t({ tr: "Bu çalışma açılamadı", en: "This work couldn't be opened" }) : t({ tr: "Hangi çalışma?", en: "Which work?" })}
      aciklama={
        bulunamadi
          ? t({
              tr: `Adresteki çalışma bulunamadı ya da bu sayfada açma yetkiniz yok. Başka bir çalışmanın ${bolum.hal.tr} göstermemek için hiçbir çalışma açılmadı.`,
              en: `The work in the address wasn't found, or you don't have access to it on this page. No other work was opened, so you won't see another work's ${bolum.hal.en}.`,
            })
          : t({
              tr: `${bolum.ad.tr} bir çalışmaya bağlı tutulur. Yanlış çalışmaya bir şey eklenmesin diye önce çalışmayı seçin.`,
              en: `${bolum.ad.en} are kept with a work. Choose the work first so nothing is added to the wrong one.`,
            })
      }
      // Seçim gerekirken birincil eylem listenin kendisi; "dön" yalnızca açılamayan çalışmada.
      eylem={bulunamadi ? { etiket: t({ tr: "Çalışmalarıma dön", en: "Back to my works" }), href: "/dashboard/editor" } : undefined}
    >
      {calismalar.length ? (
        <ul className="gb-liste calisma-secim-listesi" aria-label={t({ tr: "Çalışmalarınız", en: "Your works" })}>
          {calismalar.map((c) => (
            <ListeSatiri key={c.id} href={secimAdresi(yol, c.id, ek)} baslik={c.title} />
          ))}
        </ul>
      ) : null}
    </BosDurum>
  );
}
