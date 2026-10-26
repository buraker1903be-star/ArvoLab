import Link from "next/link";
import { CheckCircle2, ExternalLink, Inbox, PlayCircle, Send, UserRound } from "lucide-react";
import type { ConsultancyRequest } from "@/app/actions/consultancy";
import type { AppSupportRequest } from "@/app/actions/support";
import type { GeriBildirimSatiri } from "@/app/actions/geri-bildirim";
import type { ActionResult } from "@/lib/auth-guards";
import { acikKuyruk, KUYRUK_ETIKETI, KUYRUK_SIRASI, kuyrukAdresi, seciliKayit, type KuyrukTuru } from "@/lib/destek-kuyrugu";
import { bolumEtiketi, BAGLAM_METNI, PUAN_ETIKETLERI } from "@/lib/geri-bildirim";
import { requestTypeLabel } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import { trTarihSaat } from "@/lib/tr-time";
import ActionForm from "../action-form";
import BosDurum from "../_components/bos-durum";

/*
  PERSONELİN DESTEK KUYRUKLARI — tek ekran, iki kart (lib/destek-kuyrugu.ts).
  Üstte sayaçlar (her biri bir kuyruk), solda seçili kuyruğun listesi,
  sağda seçili kaydın tamamı ve eylemleri. Talebi kimin açtığı artık
  yazıyor; eskiden pencerelerde yalnızca konu vardı.
*/

const UZMAN_DURUMU: Record<string, string> = { open: "Açık", accepted: "Üstlenildi", completed: "Tamamlandı", cancelled: "İptal edildi" };
const DESTEK_DURUMU: Record<string, string> = { open: "Açık", in_progress: "İşleme alındı", resolved: "Çözüldü" };
const KATEGORI: Record<string, string> = { bug: "Hata bildirimi", access: "Erişim sorunu", feature_request: "Özellik talebi", billing: "Fatura/Ödeme", other: "Diğer" };
const ONCELIK: Record<string, { ad: string; ton: string }> = {
  low: { ad: "Düşük", ton: "neutral" },
  normal: { ad: "Normal", ton: "info" },
  high: { ad: "Yüksek", ton: "warning" },
  urgent: { ad: "Acil", ton: "danger" },
};

type Satir = { id: string; baslik: string; alt: string; pill?: { ad: string; ton: string } };

export default function DestekKuyruklari({
  erisilebilir,
  istenenKuyruk,
  istenenKayit,
  acikTalepler,
  banaAtananlar,
  destek,
  destekOkunamadi,
  geriBildirimler,
  geriBildirimOkunamadi,
  kisiAdi,
  ustlen,
  tamamla,
  isleAl,
  yanitla,
}: {
  erisilebilir: KuyrukTuru[];
  istenenKuyruk: string | null;
  istenenKayit: string | null;
  acikTalepler: ConsultancyRequest[];
  banaAtananlar: ConsultancyRequest[];
  destek: AppSupportRequest[];
  destekOkunamadi: boolean;
  geriBildirimler: GeriBildirimSatiri[];
  geriBildirimOkunamadi: boolean;
  kisiAdi: (id: string | null | undefined) => string | null;
  ustlen: (id: string) => Promise<ActionResult>;
  tamamla: (id: string) => Promise<ActionResult>;
  isleAl: (id: string) => Promise<ActionResult>;
  yanitla: (id: string, formData: FormData) => Promise<ActionResult>;
}) {
  // "Bana atanan" sayacı yalnızca SÜREN işleri sayar; tamamlananlar listede kalır ama iş beklemez.
  const bekleyen: Record<KuyrukTuru, number> = {
    "uzman-acik": acikTalepler.length,
    "uzman-bana": banaAtananlar.filter((r) => r.status === "accepted").length,
    destek: destek.length,
    "geri-bildirim": geriBildirimler.length,
  };
  const tur = acikKuyruk(erisilebilir, istenenKuyruk, (t) => (t === "geri-bildirim" ? 0 : bekleyen[t]));
  if (!tur) return null;

  const puanlilar = geriBildirimler.filter((g) => g.score);
  const ortalama = puanlilar.length ? puanlilar.reduce((t, g) => t + (g.score ?? 0), 0) / puanlilar.length : null;

  const uzmanSatiri = (r: ConsultancyRequest): Satir => ({
    id: r.id,
    baslik: r.project_title || "Bağımsız talep",
    alt: [kisiAdi(r.requested_by), requestTypeLabel(r.request_type), trTarihSaat(r.created_at)].filter(Boolean).join(" · "),
    pill: { ad: UZMAN_DURUMU[r.status] ?? r.status, ton: statusTone(r.status) },
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
              alt: [kisiAdi(r.requested_by), KATEGORI[r.category], trTarihSaat(r.created_at)].filter(Boolean).join(" · "),
              pill: r.priority === "high" || r.priority === "urgent" ? ONCELIK[r.priority] : { ad: DESTEK_DURUMU[r.status], ton: statusTone(r.status) },
            }))
          : geriBildirimler.map((g) => ({
              id: g.userId,
              baslik: g.ad,
              alt: [g.comment ? "Yorum yazdı" : "Yalnızca puan", trTarihSaat(g.updatedAt)].join(" · "),
              pill: g.score ? { ad: `${g.score} / 5`, ton: g.score >= 4 ? "success" : g.score <= 2 ? "danger" : "neutral" } : undefined,
            }));
  const secId = seciliKayit(
    satirlar.map((s) => s.id),
    istenenKayit,
  );
  const okunamadi = (tur === "destek" && destekOkunamadi) || (tur === "geri-bildirim" && geriBildirimOkunamadi);

  return (
    <>
      <nav className="personel-sayaclar destek-sayaclar" aria-label="Kuyruklar">
        {KUYRUK_SIRASI.filter((t) => erisilebilir.includes(t)).map((t) => (
          <Link
            key={t}
            href={kuyrukAdresi(t)}
            className="personel-sayac"
            data-tone={t !== "geri-bildirim" && bekleyen[t] ? "warning" : undefined}
            aria-current={t === tur ? "true" : undefined}
          >
            <b>{t === "geri-bildirim" && ortalama ? ortalama.toFixed(1) : bekleyen[t]}</b>
            <span>
              {t === "geri-bildirim" && ortalama ? `ortalama puan · ${geriBildirimler.length} cevap` : KUYRUK_ETIKETI[t]}
            </span>
          </Link>
        ))}
      </nav>

      <section className="gb-sutunlar calismalar-ikili" aria-label={KUYRUK_ETIKETI[tur]}>
        <article className="gb-kart gb-sutun">
          <header className="gb-kart-bas">
            <div>
              <h2>{KUYRUK_ETIKETI[tur]}</h2>
              <p>{okunamadi ? "okunamadı" : `${satirlar.length} kayıt`}</p>
            </div>
          </header>
          {okunamadi ? (
            /* Okunamadı ile "kuyruk boş" ayrı: boş görünen kuyruk, bekleyen kullanıcıyı unutturur. */
            <p className="alert" data-tone="danger" role="alert">
              Bu kuyruk okunamadı; bekleyen kayıt olabilir. Sayfayı yenileyin.
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
            <BosDurum kompakt ikon={Inbox} aciklama="Bu kuyrukta bekleyen kayıt yok." />
          )}
        </article>

        {secId && !okunamadi ? (
          <article className="gb-kart gb-sutun calisma-durum kayan-kart" aria-label="Seçili kayıt">
            {tur === "uzman-acik" || tur === "uzman-bana"
              ? (() => {
                  const r = [...acikTalepler, ...banaAtananlar].find((x) => x.id === secId)!;
                  return (
                    <>
                      <header className="calisma-durum-bas">
                        <div>
                          <span className="calisma-durum-ust">
                            <span className="status-pill" data-tone={statusTone(r.status)}>
                              {UZMAN_DURUMU[r.status]}
                            </span>
                            {requestTypeLabel(r.request_type)} · {trTarihSaat(r.created_at)}
                          </span>
                          <h2>{r.project_title || "Bağımsız talep"}</h2>
                          <span className="personel-ogrenci">
                            <UserRound size={14} aria-hidden="true" />
                            {kisiAdi(r.requested_by) ?? "Talep sahibinin adı görünmüyor"}
                          </span>
                        </div>
                        <div className="calisma-durum-eylemler">
                          {r.project_id ? (
                            <Link href={`/dashboard/editor/${r.project_id}`} className="projects-filter-button button-compact">
                              <ExternalLink size={14} aria-hidden="true" /> Çalışmayı aç
                            </Link>
                          ) : null}
                          {r.status === "open" ? (
                            <ActionForm action={ustlen.bind(null, r.id)} successMessage="Talebi üstlendiniz.">
                              <button type="submit" className="projects-primary-button button-compact">
                                <CheckCircle2 size={14} aria-hidden="true" /> Üstlen
                              </button>
                            </ActionForm>
                          ) : r.status === "accepted" && tur === "uzman-bana" ? (
                            <ActionForm action={tamamla.bind(null, r.id)} successMessage="Talep tamamlandı.">
                              <button type="submit" className="projects-primary-button button-compact">
                                <CheckCircle2 size={14} aria-hidden="true" /> Tamamlandı
                              </button>
                            </ActionForm>
                          ) : null}
                        </div>
                      </header>
                      <h3 className="calisma-durum-alt">Talep</h3>
                      <p className="destek-mesaj destek-mesaj-kutu">{r.message || "Ek mesaj yazılmadı."}</p>
                      {r.status === "open" ? (
                        <p className="hint">Üstlenince talep sizin kuyruğunuza (Bana atanan) geçer ve öğrenci uzmanın atandığını görür.</p>
                      ) : null}
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
                                {DESTEK_DURUMU[r.status]}
                              </span>
                              <span className="status-pill" data-tone={ONCELIK[r.priority]?.ton ?? "neutral"}>
                                {ONCELIK[r.priority]?.ad ?? r.priority} öncelik
                              </span>
                              {KATEGORI[r.category]} · {trTarihSaat(r.created_at)}
                            </span>
                            <h2>{r.subject}</h2>
                            <span className="personel-ogrenci">
                              <UserRound size={14} aria-hidden="true" />
                              {kisiAdi(r.requested_by) ?? "Talep sahibinin adı görünmüyor"}
                            </span>
                          </div>
                          {r.status === "open" ? (
                            <div className="calisma-durum-eylemler">
                              <ActionForm action={isleAl.bind(null, r.id)} successMessage="Talep işleme alındı.">
                                <button type="submit" className="projects-filter-button button-compact">
                                  <PlayCircle size={14} aria-hidden="true" /> İşleme al
                                </button>
                              </ActionForm>
                            </div>
                          ) : null}
                        </header>
                        <h3 className="calisma-durum-alt">Kullanıcının mesajı</h3>
                        <p className="destek-mesaj destek-mesaj-kutu">{r.message}</p>
                        <ActionForm className="project-form-grid" action={yanitla.bind(null, r.id)} successMessage="Yanıt gönderildi.">
                          <label className="project-form-full">
                            <span>{r.admin_note ? "Yanıtı güncelle" : "Kullanıcıya yanıt"}</span>
                            <textarea
                              name="admin_note"
                              rows={4}
                              maxLength={4000}
                              defaultValue={r.admin_note ?? ""}
                              placeholder="Ne yaptığınızı yazın; kullanıcı yanıtı Destek sayfasındaki talebinde görür."
                              required
                            />
                          </label>
                          <input type="hidden" name="status" value="resolved" />
                          <div className="project-form-actions project-form-full">
                            <button type="submit" className="projects-primary-button button-compact">
                              <Send size={14} aria-hidden="true" /> Yanıtla ve çözüldü işaretle
                            </button>
                          </div>
                        </ActionForm>
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
                                  {g.score} / 5 · {PUAN_ETIKETLERI[g.score]}
                                </span>
                              ) : null}
                              {trTarihSaat(g.updatedAt)}
                            </span>
                            <h2>{g.ad}</h2>
                          </div>
                        </header>
                        <h3 className="calisma-durum-alt">Yorum</h3>
                        <p className="destek-mesaj destek-mesaj-kutu">{g.comment || "Yorum yazılmadı."}</p>
                        <p className="muted text-sm">
                          En çok kullandığı: {bolumEtiketi(g.mostUsed)}
                          {g.askedContext && BAGLAM_METNI[g.askedContext] ? ` · ${BAGLAM_METNI[g.askedContext]} soruldu` : ""}
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
