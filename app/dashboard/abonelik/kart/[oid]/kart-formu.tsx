"use client";

import { useRef, useState, type FormEvent } from "react";
import { CreditCard, Lock } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { yasalAdres } from "@/lib/yasal-baglantilar";
import { kartOnayiKaydet } from "@/app/actions/kart-odeme";
import { kartNumarasiTemizle, sonKullanmaYillari } from "@/lib/kart-odeme";

/*
  KART FORMU (28.10.2026).

  Form PayTR'nin adresine DOĞRUDAN gönderiliyor (method="post"
  action={paymentUrl}); kart numarası, son kullanma tarihi ve CVV ArvoLab
  sunucusuna hiç uğramıyor. Bu bilerek: kart verisi bizim sunucumuzdan
  geçseydi ArvoLab PCI DSS kapsamına girerdi ve bir log satırı, bir hata
  kaydı kart numarasını saklamaya yeterdi. Kart alanları bu yüzden React
  durumunda da tutulmuyor (denetimsiz alanlar); sunucu işlemine giden tek
  şey sipariş numarası ve "kartımı kaydet" kararı.

  Sıra önemli: önce karar ArvoOS'a yazılır (kartOnayiKaydet), SONRA form
  gönderilir. Karar yazılamazsa ödeme gönderilmez — ArvoOS kartı onaysız
  saklamamalı. form.submit() onSubmit'i yeniden tetiklemiyor, döngü yok.

  Kart kaydetme kutusu VARSAYILAN OLARAK İŞARETSİZ: otomatik çekim ancak
  kullanıcının açık onayıyla başlar.
*/

/* Kullanıcının göreceği ya da bu formun kendisinin yazdığı alanlar; gizli alan olarak ikinci kez gitmemeli. */
const GORUNUR_ALANLAR = new Set(["user_phone", "user_address", "cc_owner", "card_number", "expiry_month", "expiry_year", "cvv", "store_card", "utoken"]);

export default function KartFormu({
  paymentUrl,
  merchantOid,
  fields,
  utoken,
  consentText,
  buYil,
}: {
  paymentUrl: string;
  merchantOid: string;
  fields: Record<string, string>;
  utoken: string | null;
  consentText: string;
  buYil: number;
}) {
  const t = useCeviri();
  const dil = useDil();
  const formRef = useRef<HTMLFormElement>(null);
  const [kaydet, setKaydet] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function gonder(olay: FormEvent<HTMLFormElement>) {
    olay.preventDefault();
    const form = formRef.current;
    if (!form || gonderiliyor) return;
    setHata(null);
    setGonderiliyor(true);
    let sonuc: { error?: string };
    try {
      sonuc = await kartOnayiKaydet(merchantOid, kaydet);
    } catch {
      sonuc = { error: t({ tr: "Bağlantı kurulamadı; ödeme gönderilmedi. Tekrar deneyin.", en: "Could not connect; the payment was not sent. Try again." }) };
    }
    if (sonuc.error) {
      setHata(sonuc.error);
      setGonderiliyor(false);
      return;
    }
    const numara = form.elements.namedItem("card_number");
    if (numara instanceof HTMLInputElement) numara.value = kartNumarasiTemizle(numara.value);
    // Sayfa PayTR'ye geçiyor; düğme kilitli kalır ki ikinci gönderim olmasın.
    form.submit();
  }

  return (
    <form ref={formRef} method="post" action={paymentUrl} onSubmit={gonder} className="kart-formu" autoComplete="on">
      {Object.entries(fields)
        .filter(([ad]) => !GORUNUR_ALANLAR.has(ad))
        .map(([ad, deger]) => (
          <input key={ad} type="hidden" name={ad} value={deger} />
        ))}
      {kaydet ? <input type="hidden" name="store_card" value="1" /> : null}
      {kaydet && utoken ? <input type="hidden" name="utoken" value={utoken} /> : null}

      <p className="hint kart-formu-guven">
        <Lock size={14} aria-hidden="true" />
        {t({
          tr: "Kart bilgileriniz doğrudan PayTR'nin güvenli ödeme altyapısına gönderilir; ArvoLab kart numaranızı görmez ve saklamaz.",
          en: "Your card details are sent directly to PayTR's secure payment infrastructure; ArvoLab never sees or stores your card number.",
        })}
      </p>

      <div className="kart-formu-alanlar">
        <label className="kart-formu-genis">
          <span>{t({ tr: "Kart üzerindeki ad", en: "Name on card" })}</span>
          <input name="cc_owner" type="text" className="field-control" autoComplete="cc-name" maxLength={50} required />
        </label>
        <label className="kart-formu-genis">
          <span>{t({ tr: "Kart numarası", en: "Card number" })}</span>
          <input
            name="card_number"
            type="text"
            className="field-control"
            inputMode="numeric"
            autoComplete="cc-number"
            pattern="[0-9 ]{13,23}"
            maxLength={23}
            required
          />
        </label>
        <label>
          <span>{t({ tr: "Son kullanma ayı", en: "Expiry month" })}</span>
          <select name="expiry_month" className="field-control" autoComplete="cc-exp-month" required defaultValue="">
            <option value="" disabled>
              {t({ tr: "Ay", en: "Month" })}
            </option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((ay) => (
              <option key={ay} value={ay}>
                {ay.padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t({ tr: "Son kullanma yılı", en: "Expiry year" })}</span>
          <select name="expiry_year" className="field-control" autoComplete="cc-exp-year" required defaultValue="">
            <option value="" disabled>
              {t({ tr: "Yıl", en: "Year" })}
            </option>
            {sonKullanmaYillari(buYil).map((yil) => (
              <option key={yil} value={yil}>
                {yil}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>CVV</span>
          <input name="cvv" type="password" className="field-control" inputMode="numeric" autoComplete="cc-csc" pattern="[0-9]{3,4}" maxLength={4} required />
        </label>
        <label>
          <span>{t({ tr: "Telefon", en: "Phone" })}</span>
          {/* ArvoOS abonenin telefonunu bilmiyor ve imzaya girmeyen bu alana yer tutucu "0" gönderiyor; kutu boş açılsın, kişi kendisi yazsın. */}
          <input name="user_phone" type="tel" className="field-control" autoComplete="tel" defaultValue={fields.user_phone === "0" ? "" : (fields.user_phone ?? "")} maxLength={20} required />
        </label>
        <label className="kart-formu-genis">
          <span>{t({ tr: "Adres", en: "Address" })}</span>
          <input name="user_address" type="text" className="field-control" autoComplete="street-address" defaultValue={fields.user_address ?? ""} maxLength={400} required />
        </label>
      </div>

      <label className="kart-formu-onay">
        <input type="checkbox" checked={kaydet} onChange={(e) => setKaydet(e.target.checked)} />
        <span>
          <b>{t({ tr: "Kartımı kaydet, aboneliğim otomatik yenilensin", en: "Save my card and renew my subscription automatically" })}</b>
          {consentText ? <small>{consentText}</small> : null}
        </span>
      </label>

      {/*
        Sözleşme onayı (29.10.2026). Eskiden form tutarı ve kart alanlarını
        gösterip doğrudan ödemeye gidiyordu; mesafeli satış sözleşmesine ve
        iptal-iade koşullarına hiç bağlantı yoktu. Mevzuat bu metinlerin
        ödemeden ÖNCE gösterilip onaylatılmasını istiyor. Kutu zorunlu
        (required): işaretlenmeden tarayıcı formu göndermez. Kart kaydetme
        onayından AYRI tutuldu — biri sözleşme, öteki isteğe bağlı otomatik
        çekim; tek kutuda birleşmeleri ikincisini zorunlu yapardı.
      */}
      <label className="kart-formu-onay">
        {/* Adsız: form PayTR'ye gidiyor, ödeme isteğine fazladan alan eklenmesin. */}
        <input type="checkbox" required />
        <span>
          {t({ tr: "", en: "I have read and accept the " })}
          <a href={yasalAdres("mesafeli-satis", dil)} target="_blank" rel="noreferrer">
            {t({ tr: "Mesafeli satış sözleşmesini", en: "distance sales agreement" })}
          </a>
          {t({ tr: " ve ", en: " and the " })}
          <a href={yasalAdres("iptal-iade", dil)} target="_blank" rel="noreferrer">
            {t({ tr: "iptal ve iade koşullarını", en: "cancellation and refund policy" })}
          </a>
          {t({ tr: " okudum, kabul ediyorum.", en: "." })}
        </span>
      </label>

      {hata ? (
        <p className="alert" data-tone="danger" role="alert">
          {hata}
        </p>
      ) : null}

      <button type="submit" className="projects-primary-button" disabled={gonderiliyor} aria-busy={gonderiliyor}>
        {gonderiliyor ? (
          t({ tr: "Yönlendiriliyorsunuz…", en: "Redirecting…" })
        ) : (
          <>
            <CreditCard size={16} aria-hidden="true" />
            {t({ tr: "Ödemeyi tamamla", en: "Complete payment" })}
          </>
        )}
      </button>
    </form>
  );
}
