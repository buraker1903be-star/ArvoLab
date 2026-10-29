import { CreditCard, RefreshCw } from "lucide-react";
import { kayitliKartiSil, otomatikYenilemeyiKapat } from "@/app/actions/kart-odeme";
import { ceviri, tarihler } from "@/lib/dil-sunucu";
import type { KartDurumu, KayitliKart } from "@/lib/kart-odeme";

/*
  KAYITLI KART VE OTOMATİK YENİLEME (28.10.2026). Yalnızca ArvoOS kart
  saklamayı açtığında (ensure → cardStorage) çizilir.

  Köprü okunamazsa "okunamadı" yazılır, "kayıtlı kartınız yok" DEĞİL:
  kartı kayıtlıyken "yok" okuyan kullanıcı otomatik çekimin durduğunu
  sanar ve kapatma düğmesini aramaz.
*/
export default async function KartBolumu({ durum }: { durum: KartDurumu | null }) {
  const t = await ceviri();
  const { tarih } = await tarihler();
  const kartAdi = (kart: KayitliKart) =>
    [kart.scheme, kart.bank].filter(Boolean).join(" · ") || t({ tr: "Kart", en: "Card" });
  const yenileme = durum?.autoRenew ?? null;
  const yenilemeKarti = yenileme ? durum?.cards.find((k) => k.id === yenileme.cardId) ?? null : null;

  return (
    <>
      <h3 className="calisma-durum-alt">
        <CreditCard size={14} aria-hidden="true" /> {t({ tr: "Kayıtlı kart", en: "Saved card" })}
      </h3>
      {!durum ? (
        <p className="gb-bos">
          {t({
            tr: "Kayıtlı kart bilgisi şu an okunamadı; ödeme sistemine ulaşılamıyor olabilir. Sayfayı sonra yenileyin.",
            en: "Saved card details could not be loaded right now; the payment system may be unreachable. Refresh the page later.",
          })}
        </p>
      ) : (
        <>
          {yenileme?.active ? (
            <div className="gb-satir">
              <span className="gb-satir-govde">
                <b>
                  <RefreshCw size={13} aria-hidden="true" />{" "}
                  {t({ tr: "Otomatik yenileme açık", en: "Automatic renewal is on" })}
                </b>
                <small>
                  {yenilemeKarti
                    ? t({ tr: `Kart •••• ${yenilemeKarti.last4}`, en: `Card •••• ${yenilemeKarti.last4}` })
                    : t({ tr: "Kayıtlı kart", en: "Saved card" })}
                  {" · "}
                  {t({ tr: `Onay: ${tarih(yenileme.consentAt)}`, en: `Consent: ${tarih(yenileme.consentAt)}` })}
                </small>
                {yenileme.lastError ? (
                  <small className="tone-text" data-tone="danger">
                    {t({ tr: `Son deneme başarısız: ${yenileme.lastError}`, en: `Last attempt failed: ${yenileme.lastError}` })}
                  </small>
                ) : null}
              </span>
              <form action={otomatikYenilemeyiKapat}>
                <button type="submit" className="projects-filter-button button-compact">
                  {t({ tr: "Otomatik yenilemeyi kapat", en: "Turn off automatic renewal" })}
                </button>
              </form>
            </div>
          ) : (
            <p className="muted text-sm">
              {t({
                tr: "Kartınızdan kendiliğinden çekim yapılmaz; her dönemin ödemesini bankanızın 3D Secure onayıyla siz yaparsınız.",
                en: "Nothing is charged to your card automatically; you pay each period yourself and approve it with your bank's 3D Secure check.",
              })}
            </p>
          )}

          {durum.cards.length ? (
            <ul className="gb-liste">
              {durum.cards.map((kart) => (
                <li key={kart.id} className="gb-satir">
                  <span className="gb-satir-govde">
                    <b>
                      {kartAdi(kart)} •••• {kart.last4}
                    </b>
                    {kart.expMonth && kart.expYear ? (
                      <small>
                        {t({ tr: "Son kullanma", en: "Expires" })} {kart.expMonth.padStart(2, "0")}/{kart.expYear}
                      </small>
                    ) : null}
                  </span>
                  <form action={kayitliKartiSil}>
                    <input type="hidden" name="kart" value={kart.id} />
                    <button type="submit" className="projects-filter-button button-compact">
                      {t({ tr: "Kartı sil", en: "Delete card" })}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">{t({ tr: "Kayıtlı kartınız yok.", en: "You have no saved cards." })}</p>
          )}
        </>
      )}
    </>
  );
}
