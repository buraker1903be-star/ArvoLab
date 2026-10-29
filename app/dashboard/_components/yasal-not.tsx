import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { yasalAdres } from "@/lib/yasal-baglantilar";

/*
  Ödeme düğmelerinin yanındaki sözleşme notu (29.10.2026). Düğmeler ödemeyi
  ArvoOS'un ödeme sayfasında açıyor; kullanıcı oraya gitmeden hangi
  metinlerin geçerli olduğunu görmeli. Eskiden abonelik ve kredi düğmelerinin
  yanında mesafeli satış sözleşmesine ya da iptal-iade koşullarına hiçbir
  bağlantı yoktu. Kart formunun kendisinde ayrıca zorunlu onay kutusu var.
*/
export default async function YasalNot() {
  const t = await ceviri();
  const dil = await aktifDil();
  return (
    <p className="muted text-sm yasal-not">
      {t({ tr: "Ödemeye geçerek ", en: "By proceeding to payment you accept the " })}
      <a href={yasalAdres("mesafeli-satis", dil)} target="_blank" rel="noreferrer">
        {t({ tr: "mesafeli satış sözleşmesini", en: "distance sales agreement" })}
      </a>
      {t({ tr: " ve ", en: " and the " })}
      <a href={yasalAdres("iptal-iade", dil)} target="_blank" rel="noreferrer">
        {t({ tr: "iptal ve iade koşullarını", en: "cancellation and refund policy" })}
      </a>
      {t({ tr: " kabul etmiş olursunuz.", en: "." })}
    </p>
  );
}
