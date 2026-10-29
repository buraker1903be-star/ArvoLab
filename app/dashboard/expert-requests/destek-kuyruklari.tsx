import Link from "next/link";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { CheckCircle2, ExternalLink, Inbox, PlayCircle, UserRound } from "lucide-react";
import type { ConsultancyRequest } from "@/app/actions/consultancy";
import type { AppSupportRequest } from "@/app/actions/support";
import type { GeriBildirimSatiri } from "@/app/actions/geri-bildirim";
import type { ActionResult } from "@/lib/auth-guards";
import { acikKuyruk, kuyrukEtiketi, KUYRUK_SIRASI, kuyrukAdresi, seciliKayit, type KuyrukTuru } from "@/lib/destek-kuyrugu";
import { bolumEtiketi, BAGLAM_METNI_METIN, PUAN_ETIKETLERI_METIN } from "@/lib/geri-bildirim";
import { uzmanYazismaDurumu, yanitBekliyor, type YazismaMesaji } from "@/lib/destek-yazisma";
import { destekMesajiGonder } from "@/app/actions/destek-yazisma";
import { requestTypeLabel } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";
import Yazisma from "./yazisma";

/*
  PERSONELİN DESTEK KUYRUKLARI — tek ekran, iki kart (lib/destek-kuyrugu.ts).
  Üstte sayaçlar (her biri bir kuyruk), solda seçili kuyruğun listesi,
  sağda seçili kaydın tamamı ve eylemleri. Talebi kimin açtığı artık
  yazıyor; eskiden pencerelerde yalnızca konu vardı.
*/

const UZMAN_DURUMU: Record<string, Metin> = {
  open: { tr: "Açık", en: "Open" },
  accepted: { tr: "Üstlenildi", en: "Taken on" },
  completed: { tr: "Tamamlandı", en: "Completed" },
  cancelled: { tr: "İptal edildi", en: "Canceled" },
};
const DESTEK_DURUMU: Record<string, Metin> = {
  open: { tr: "Açık", en: "Open" },
  in_progress: { tr: "İşleme alındı", en: "In progress" },
  resolved: { tr: "Çözüldü", en: "Resolved" },
};
const KATEGORI: Record<string, Metin> = {
  bug: { tr: "Hata bildirimi", en: "Bug report" },
  access: { tr: "Erişim sorunu", en: "Access problem" },
  feature_request: { tr: "Özellik talebi", en: "Feature request" },
  billing: { tr: "Fatura/Ödeme", en: "Billing/Payment" },
  other: { tr: "Diğer", en: "Other" },
};
const ONCELIK: Record<string, { ad: Metin; ton: string }> = {
  low: { ad: { tr: "Düşük", en: "Low" }, ton: "neutral" },
  normal: { ad: { tr: "Normal", en: "Normal" }, ton: "info" },
  high: { ad: { tr: "Yüksek", en: "High" }, ton: "warning" },
  urgent: { ad: { tr: "Acil", en: "Urgent" }, ton: "danger" },
};

type Satir = { id: string; baslik: string; alt: string; pill?: { ad: string; ton: string } };

export default async function DestekKuyruklari({
  erisilebilir,
  istenenKuyruk,
  istenenKayit,
  acikTalepler,
  banaAtananlar,
  destek,
  acikOkunamadi,
  banaOkunamadi,
  destekOkunamadi,
  geriBildirimler,
  geriBildirimOkunamadi,
  kisiAdi,
  uzmanYazismasi,
  destekYazismasi,
  yazismaOkunamadi,
  ustlen,
  tamamla,
  isleAl,
}: {
  erisilebilir: KuyrukTuru[];
  istenenKuyruk: string | null;
  istenenKayit: string | null;
  acikTalepler: ConsultancyRequest[];
  banaAtananlar: ConsultancyRequest[];
  acikOkunamadi: boolean;
  banaOkunamadi: boolean;
  destek: AppSupportRequest[];
  destekOkunamadi: boolean;
  geriBildirimler: GeriBildirimSatiri[];
  geriBildirimOkunamadi: boolean;
  kisiAdi: (id: string | null | undefined) => string | null;
  uzmanYazismasi: (id: string) => YazismaMesaji[];
  destekYazismasi: (r: AppSupportRequest) => YazismaMesaji[];
  yazismaOkunamadi: boolean;
  ustlen: (id: string) => Promise<ActionResult>;
  tamamla: (id: string) => Promise<ActionResult>;
  isleAl: (id: string) => Promise<ActionResult>;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const durumAdi = (harita: Record<string, Metin>, deger: string) => (harita[deger] ? t(harita[deger]) : deger);
  // "Bana atanan" sayacı yalnızca SÜREN işleri sayar; tamamlananlar listede kalır ama iş beklemez.
  const bekleyen: Record<KuyrukTuru, number> = {
    "uzman-acik": acikTalepler.length,
    "uzman-bana": banaAtananlar.filter((r) => r.status === "accepted").length,
    destek: destek.length,
    "geri-bildirim": geriBildirimler.length,
  };
  const tur = acikKuyruk(erisilebilir, istenenKuyruk, (k) => (k === "geri-bildirim" ? 0 : bekleyen[k]));
  if (!tur) return null;

  const puanlilar = geriBildirimler.filter((g) => g.score);
  const ortalama = puanlilar.length ? puanlilar.reduce((toplam, g) => toplam + (g.score ?? 0), 0) / puanlilar.length : null;

  const uzmanSatiri = (r: ConsultancyRequest): Satir => ({
    id: r.id,
    baslik: r.project_title || t({ tr: "Bağımsız talep", en: "Standalone request" }),
    alt: [kisiAdi(r.requested_by), t(requestTypeLabel(r.request_type)), tarihSaat(r.created_at)].filter(Boolean).join(" · "),
    /* Son söz öğrencideyse uzman cevap borçlu; listede ilk bakışta görünsün. */
    pill:
      r.status === "accepted" && yanitBekliyor(uzmanYazismasi(r.id))
        ? { ad: t({ tr: "Yeni mesaj", en: "New message" }), ton: "warning" }
        : { ad: durumAdi(UZMAN_DURUMU, r.status), ton: statusTone(r.status) },
  });
  const satirlar: Satir[] =
    tur === "uzman-acik"
      ? acikTalepler.map(uzmanSatiri)
      : tur === "uzman-bana"
        ? banaAtananlar.map(uzmanSatiri)
        : tur === "destek"
          ? destek.map((r) => ({
              id: r.id,
              baslik: r.subject,
              alt: [kisiAdi(r.requested_by), durumAdi(KATEGORI, r.category), tarihSaat(r.created_at)].filter(Boolean).join(" · "),
              pill: (() => {
                const m = destekYazismasi(r);
                // Yazışma sürüyor ve son söz kullanıcıda: "hâlâ olmuyor" gözden kaçmasın.
                if (m.some((x) => x.taraf === "destek") && yanitBekliyor(m)) return { ad: t({ tr: "Yeni mesaj", en: "New message" }), ton: "warning" };
                return r.priority === "high" || r.priority === "urgent"
                  ? { ad: t(ONCELIK[r.priority].ad), ton: ONCELIK[r.priority].ton }
                  : { ad: durumAdi(DESTEK_DURUMU, r.status), ton: statusTone(r.status) };
              })(),
            }))
          : geriBildirimler.map((g) => ({
              id: g.userId,
              baslik: g.ad,
              alt: [g.comment ? t({ tr: "Yorum yazdı", en: "Left a comment" }) : t({ tr: "Yalnızca puan", en: "Rating only" }), tarihSaat(g.updatedAt)].join(" · "),
              pill: g.score ? { ad: `${g.score} / 5`, ton: g.score >= 4 ? "success" : g.score <= 2 ? "danger" : "neutral" } : undefined,
            }));
  const secId = seciliKayit(
    satirlar.map((s) => s.id),
    istenenKayit,
  );
  /* Uzman kuyrukları da: eskiden okuma hatası "açık talep yok" görünüyor,
     öğrencinin talebi cevapsız kalıyordu. */
  const okunamadi =
    (tur === "destek" && destekOkunamadi) ||
    (tur === "geri-bildirim" && geriBildirimOkunamadi) ||
    (tur === "uzman-acik" && acikOkunamadi) ||
    (tur === "uzman-bana" && banaOkunamadi);

  return (
    <>
      <nav className="personel-sayaclar destek-sayaclar" aria-label={t({ tr: "Kuyruklar", en: "Queues" })}>
        {KUYRUK_SIRASI.filter((k) => erisilebilir.includes(k)).map((k) => (
          <Link
            key={k}
            href={kuyrukAdresi(k)}
            className="personel-sayac"
            data-tone={k !== "geri-bildirim" && bekleyen[k] ? "warning" : undefined}
            aria-current={k === tur ? "true" : undefined}
          >
            <b>{k === "geri-bildirim" && ortalama ? ortalama.toFixed(1) : bekleyen[k]}</b>
            <span>
              {k === "geri-bildirim" && ortalama
                ? t({ tr: `ortalama puan · ${geriBildirimler.length} cevap`, en: `average rating · ${geriBildirimler.length} responses` })
                : kuyrukEtiketi(k, dil)}
            </span>
          </Link>
        ))}
      </nav>

      <section className="gb-sutunlar calismalar-ikili" aria-label={kuyrukEtiketi(tur, dil)}>
        <article className="gb-kart gb-sutun">
          <header className="gb-kart-bas">
            <div>
              <h2>{kuyrukEtiketi(tur, dil)}</h2>
              <p>
                {okunamadi
                  ? t({ tr: "okunamadı", en: "could not be loaded" })
                  : t({ tr: `${satirlar.length} kayıt`, en: `${satirlar.length} ${satirlar.length === 1 ? "record" : "records"}` })}
              </p>
            </div>
          </header>
          {okunamadi ? (
            /* Okunamadı ile "kuyruk boş" ayrı: boş görünen kuyruk, bekleyen kullanıcıyı unutturur. */
            <p className="alert" data-tone="danger" role="alert">
              {t({
                tr: "Bu kuyruk okunamadı; bekleyen kayıt olabilir. Sayfayı yenileyin.",
                en: "This queue could not be loaded; there may be pending records. Refresh the page.",
              })}
            </p>
          ) : satirlar.length ? (
            <ul className="gb-liste calisma-secim">
              {satirlar.map((s) => (
                <li key={s.id}>
                  <Link href={kuyrukAdresi(tur, s.id)} className="gb-satir" aria-current={s.id === secId ? "true" : undefined} scroll={false}>
                    <span className="gb-satir-govde">
                      <b>{s.baslik}</b>
                      <small>{s.alt}</small>
                    </span>
                    {s.pill ? (
                      <span className="status-pill" data-tone={s.pill.ton}>
                        {s.pill.ad}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <BosDurum kompakt ikon={Inbox} aciklama={t({ tr: "Bu kuyrukta bekleyen kayıt yok.", en: "No pending records in this queue." })} />
          )}
        </article>

        {secId && !okunamadi ? (
          <article className="gb-kart gb-sutun calisma-durum kayan-kart" aria-label={t({ tr: "Seçili kayıt", en: "Selected record" })}>
            {tur === "uzman-acik" || tur === "uzman-bana"
              ? (() => {
                  const r = [...acikTalepler, ...banaAtananlar].find((x) => x.id === secId)!;
                  return (
                    <>
                      <header className="calisma-durum-bas">
                        <div>
                          <span className="calisma-durum-ust">
                            <span className="status-pill" data-tone={statusTone(r.status)}>
                              {durumAdi(UZMAN_DURUMU, r.status)}
                            </span>
                            {t(requestTypeLabel(r.request_type))} · {tarihSaat(r.created_at)}
                          </span>
                          <h2>{r.project_title || t({ tr: "Bağımsız talep", en: "Standalone request" })}</h2>
                          <span className="personel-ogrenci">
                            <UserRound size={14} aria-hidden="true" />
                            {kisiAdi(r.requested_by) ?? t({ tr: "Talep sahibinin adı görünmüyor", en: "The requester's name is not visible" })}
                          </span>
                        </div>
                        <div className="calisma-durum-eylemler">
                          {r.project_id ? (
                            <Link href={`/dashboard/editor/${r.project_id}`} className="projects-filter-button button-compact">
                              <ExternalLink size={14} aria-hidden="true" /> {t({ tr: "Çalışmayı aç", en: "Open project" })}
                            </Link>
                          ) : null}
                          {r.status === "open" ? (
                            <ActionForm action={ustlen.bind(null, r.id)} successMessage={t({ tr: "Talebi üstlendiniz.", en: "You have taken on the request." })}>
                              <button type="submit" className="projects-primary-button button-compact">
                                <CheckCircle2 size={14} aria-hidden="true" /> {t({ tr: "Üstlen", en: "Take on" })}
                              </button>
                            </ActionForm>
                          ) : r.status === "accepted" && tur === "uzman-bana" ? (
                            <ActionForm action={tamamla.bind(null, r.id)} successMessage={t({ tr: "Talep tamamlandı.", en: "The request was completed." })}>
                              <button type="submit" className="projects-primary-button button-compact">
                                <CheckCircle2 size={14} aria-hidden="true" /> {t({ tr: "Tamamlandı", en: "Completed" })}
                              </button>
                            </ActionForm>
                          ) : null}
                        </div>
                      </header>
                      <h3 className="calisma-durum-alt">{t({ tr: "Talep", en: "Request" })}</h3>
                      <p className="destek-mesaj destek-mesaj-kutu">{r.message || t({ tr: "Ek mesaj yazılmadı.", en: "No additional message." })}</p>
                      {r.status === "open" ? (
                        <p className="hint">
                          {t({
                            tr: "Üstlenince talep sizin kuyruğunuza (Bana atanan) geçer, öğrenci uzmanın atandığını görür ve yazışma açılır.",
                            en: "Once you take it on, the request moves to your queue (Assigned to me), the student sees that an expert was assigned, and messaging opens.",
                          })}
                        </p>
                      ) : (
                        (() => {
                          const yazma = uzmanYazismaDurumu(r.status, "uzman", dil);
                          return (
                            <>
                              <h3 className="calisma-durum-alt">{t({ tr: "Yazışma", en: "Conversation" })}</h3>
                              <Yazisma
                                mesajlar={uzmanYazismasi(r.id)}
                                benimTarafim="uzman"
                                okunamadi={yazismaOkunamadi}
                                gonder={yazma.yazabilir ? destekMesajiGonder.bind(null, "uzman", r.id) : null}
                                kapaliNedeni={yazma.yazabilir ? undefined : yazma.neden}
                                yerTutucu={t({ tr: "Öğrenciye yazın: yönlendirme, soru ya da sonraki adım", en: "Write to the student: guidance, a question, or the next step" })}
                              />
                            </>
                          );
                        })()
                      )}
                    </>
                  );
                })()
              : tur === "destek"
                ? (() => {
                    const r = destek.find((x) => x.id === secId)!;
                    return (
                      <>
                        <header className="calisma-durum-bas">
                          <div>
                            <span className="calisma-durum-ust">
                              <span className="status-pill" data-tone={statusTone(r.status)}>
                                {durumAdi(DESTEK_DURUMU, r.status)}
                              </span>
                              <span className="status-pill" data-tone={ONCELIK[r.priority]?.ton ?? "neutral"}>
                                {ONCELIK[r.priority]
                                  ? t({ tr: `${ONCELIK[r.priority].ad.tr} öncelik`, en: `${ONCELIK[r.priority].ad.en} priority` })
                                  : r.priority}
                              </span>
                              {durumAdi(KATEGORI, r.category)} · {tarihSaat(r.created_at)}
                            </span>
                            <h2>{r.subject}</h2>
                            <span className="personel-ogrenci">
                              <UserRound size={14} aria-hidden="true" />
                              {kisiAdi(r.requested_by) ?? t({ tr: "Talep sahibinin adı görünmüyor", en: "The requester's name is not visible" })}
                            </span>
                          </div>
                          {r.status === "open" ? (
                            <div className="calisma-durum-eylemler">
                              <ActionForm action={isleAl.bind(null, r.id)} successMessage={t({ tr: "Talep işleme alındı.", en: "The request is now in progress." })}>
                                <button type="submit" className="projects-filter-button button-compact">
                                  <PlayCircle size={14} aria-hidden="true" /> {t({ tr: "İşleme al", en: "Start working" })}
                                </button>
                              </ActionForm>
                            </div>
                          ) : null}
                        </header>
                        <h3 className="calisma-durum-alt">{t({ tr: "Kullanıcının mesajı", en: "User's message" })}</h3>
                        <p className="destek-mesaj destek-mesaj-kutu">{r.message}</p>
                        <h3 className="calisma-durum-alt">{t({ tr: "Yazışma", en: "Conversation" })}</h3>
                        <Yazisma
                          mesajlar={destekYazismasi(r)}
                          benimTarafim="destek"
                          okunamadi={yazismaOkunamadi}
                          gonder={destekMesajiGonder.bind(null, "destek", r.id)}
                          yerTutucu={t({
                            tr: "Ne yaptığınızı yazın; kullanıcı yanıtı Destek sayfasındaki talebinde görür.",
                            en: "Describe what you did; the user sees the reply on their request in the Support page.",
                          })}
                          cozSecenegi
                        />
                      </>
                    );
                  })()
                : (() => {
                    const g = geriBildirimler.find((x) => x.userId === secId)!;
                    return (
                      <>
                        <header className="calisma-durum-bas">
                          <div>
                            <span className="calisma-durum-ust">
                              {g.score ? (
                                <span className="status-pill" data-tone={g.score >= 4 ? "success" : g.score <= 2 ? "danger" : "neutral"}>
                                  {g.score} / 5 · {PUAN_ETIKETLERI_METIN[g.score] ? t(PUAN_ETIKETLERI_METIN[g.score]) : ""}
                                </span>
                              ) : null}
                              {tarihSaat(g.updatedAt)}
                            </span>
                            <h2>{g.ad}</h2>
                          </div>
                        </header>
                        <h3 className="calisma-durum-alt">{t({ tr: "Yorum", en: "Comment" })}</h3>
                        <p className="destek-mesaj destek-mesaj-kutu">{g.comment || t({ tr: "Yorum yazılmadı.", en: "No comment written." })}</p>
                        <p className="muted text-sm">
                          {t({ tr: "En çok kullandığı:", en: "Most used:" })} {bolumEtiketi(g.mostUsed, dil)}
                          {g.askedContext && BAGLAM_METNI_METIN[g.askedContext]
                            ? t({
                                tr: ` · ${BAGLAM_METNI_METIN[g.askedContext].tr} soruldu`,
                                en: ` · asked ${BAGLAM_METNI_METIN[g.askedContext].en}`,
                              })
                            : ""}
                        </p>
                      </>
                    );
                  })()}
          </article>
        ) : null}
      </section>
    </>
  );
}
