import { Send } from "lucide-react";
import type { ActionResult } from "@/lib/auth-guards";
import { yazanEtiketi, type Taraf, type YazismaMesaji } from "@/lib/destek-yazisma";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import ActionForm from "../action-form";

/*
  Talep altındaki yazışma: öğrencinin iki kartında ve personelin kuyruk
  detayında AYNI bileşen. Kendi mesajı sağda, karşı tarafınki solda.

  gonder null ise form çizilmez, yerine neden yazılır (talep kapanmış,
  henüz üstlenilmemiş…): düğmeyi gösterip "gönderilemedi" demek, kuralı
  kullanıcıya deneme yanılmayla öğretmek olurdu.
*/
export default async function Yazisma({
  mesajlar,
  benimTarafim,
  okunamadi = false,
  gonder,
  kapaliNedeni,
  yerTutucu,
  cozSecenegi = false,
}: {
  mesajlar: YazismaMesaji[];
  benimTarafim: Taraf;
  okunamadi?: boolean;
  gonder: ((formData: FormData) => Promise<ActionResult>) | null;
  kapaliNedeni?: string;
  yerTutucu: string;
  /** İç ekip: gönderirken talebi çözüldü işaretleme kutusu. */
  cozSecenegi?: boolean;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  return (
    <div className="yazisma">
      {okunamadi ? (
        <p className="alert" data-tone="danger" role="alert">
          {t({
            tr: "Yazışma yüklenemedi; yeni mesajlar olabilir. Sayfayı yenileyin.",
            en: "The conversation could not be loaded; there may be new messages. Refresh the page.",
          })}
        </p>
      ) : mesajlar.length ? (
        <ol className="yazisma-liste">
          {mesajlar.map((m) => (
            <li key={m.id} className="yazisma-mesaj" data-benim={m.taraf === benimTarafim ? "true" : undefined}>
              <span className="yazisma-ust">
                <b>{yazanEtiketi(m, benimTarafim, dil)}</b>
                {m.zaman ? <small>{tarihSaat(m.zaman)}</small> : null}
              </span>
              <p>{m.metin}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {gonder ? (
        <ActionForm action={gonder} className="yazisma-form" successMessage={t({ tr: "Mesajınız gönderildi.", en: "Your message was sent." })}>
          <textarea name="metin" className="field-control" rows={3} maxLength={4000} placeholder={yerTutucu} required aria-label={t({ tr: "Mesajınız", en: "Your message" })} />
          <div className="yazisma-form-alt">
            {cozSecenegi ? (
              <label className="yazisma-coz">
                <input type="checkbox" name="coz" value="1" defaultChecked />{" "}
                {t({ tr: "Gönderince çözüldü işaretle", en: "Mark as resolved when sent" })}
              </label>
            ) : (
              <span />
            )}
            <button type="submit" className="projects-primary-button button-compact">
              <Send size={14} aria-hidden="true" /> {t({ tr: "Gönder", en: "Send" })}
            </button>
          </div>
        </ActionForm>
      ) : kapaliNedeni ? (
        <p className="hint">{kapaliNedeni}</p>
      ) : null}
    </div>
  );
}
