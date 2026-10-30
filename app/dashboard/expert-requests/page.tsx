import { listeBasarili } from "@/lib/liste-sonucu";
import type { Metadata } from "next";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import type { ConsultancyRequest } from "@/app/actions/consultancy";
import type { AppSupportRequest } from "@/app/actions/support";
import Link from "next/link";
import { BookOpen, GraduationCap, Inbox, LifeBuoy, Send, XCircle } from "lucide-react";
import {
  createConsultancyRequest,
  getMyRequests,
  getOpenRequests,
  getAssignedToMe,
  acceptRequest,
  completeRequest,
  cancelRequest,
} from "@/app/actions/consultancy";
import {
  createSupportRequest,
  getMySupportRequests,
  getAllSupportRequests,
  updateSupportRequestStatus,
} from "@/app/actions/support";
import { destekMesajiGonder, yazismalariOku } from "@/app/actions/destek-yazisma";
import { uzmanYazismaDurumu, yanitGeldi, yazismaKur } from "@/lib/destek-yazisma";
import { tumGeriBildirimler, type GeriBildirimSatiri } from "@/app/actions/geri-bildirim";
import { getMyProjects } from "@/app/actions/citation-check";
import { getCurrentProfile } from "@/app/actions/profile";
import { isExpertEligible, requestTypeLabel, STAFF_ROLES } from "@/lib/project-labels";
import { createClient } from "@/lib/supabase/server";
import { kuyrukAdresi, TALEPLERIM_ADRESI, type KuyrukTuru } from "@/lib/destek-kuyrugu";
import DestekKuyruklari from "./destek-kuyruklari";
import Yazisma from "./yazisma";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { statusTone } from "@/lib/status-tone";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import PartnerSeridi from "../_components/partner-seridi";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Destek", en: "Support" }) };
}

/*
  DESTEK — TEK SAYFA, İKİ EŞİT KART (26.10.2026, Kaynaklar'la aynı karar:
  dock'tan girince iki sekme çıkmasın).

  Eskiden iki ayrı sayfaydı (Uzman Desteği, Uygulama Desteği) ve her
  biri "bu sayfa öteki değildir" diye açıklama yazıyordu: öğrenci
  sorusunu nereye soracağını sayfaya girdikten sonra öğreniyordu. Şimdi
  ikisi yan yana: solda akademik soru (uzmana), sağda uygulama sorunu
  (bize); her kartta kendi talepleri ve yanıtları.

  Personelin kuyrukları (açık uzman talepleri, bana atananlar, bütün
  destek talepleri, kullanım geri bildirimleri) ayrı bir sekmede, tek
  ekranda (destek-kuyruklari.tsx, 26.10.2026). Eskiden başlıktaki üç
  açılır penceredeydiler; personel kendi taleplerini "Kendi taleplerim"
  sekmesinde, öğrencinin gördüğü iki kartla görüyor.

  /dashboard/support buraya yönleniyor.
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

const ONCELIK: Record<string, Metin> = {
  low: { tr: "Düşük", en: "Low" },
  normal: { tr: "Normal", en: "Normal" },
  high: { tr: "Yüksek", en: "High" },
  urgent: { tr: "Acil", en: "Urgent" },
};

export default async function DestekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  /*
    Kuyruklar yalnızca PERSONEL GÖRÜNÜMÜNDE: iç ekip öğrenci düzenini
    önizlerken (lib/onizleme.ts) başlıkta "Uzman kuyruğu", "Destek
    kuyruğu" ve içlerinde "Üstlen" çıkıyordu — öğrenci bunları hiç
    görmez, önizleme de göstermemeli. Yetki değişmiyor: RLS gerçek rolle.
  */
  const gorunum = await sayfaGorunumu({
    rol: profile?.role,
    personelRolu: profile?.role ? STAFF_ROLES.includes(profile.role) : false,
    kurumVar: Boolean(profile?.organization_id),
  });
  const uzman = gorunum.personel && isExpertEligible(profile?.role);
  const yonetici = gorunum.personel && (profile?.role === "system_admin" || profile?.role === "founder");
  // Geri bildirimleri Yönetici de okur (app/actions/geri-bildirim.ts);
  // destek kuyruğu yalnızca Sistem Yöneticisi ve Kurucu'nun işi.
  const yonetim = yonetici || (gorunum.personel && profile?.role === "academic_manager");

  const [
    { satirlar: calismalar },
    { satirlar: uzmanTaleplerim, okunamadi: uzmanOkunamadi },
    { satirlar: destekTaleplerim, okunamadi: destekOkunamadi },
    { satirlar: acikTalepler, okunamadi: acikOkunamadi },
    { satirlar: banaAtananlar, okunamadi: banaOkunamadi },
    { satirlar: tumDestek, okunamadi: tumDestekOkunamadi },
    { satirlar: geriBildirimler, okunamadi: geriBildirimOkunamadi },
  ] = await Promise.all([
    getMyProjects(),
    getMyRequests(),
    getMySupportRequests(),
    uzman ? getOpenRequests() : Promise.resolve(listeBasarili<ConsultancyRequest>([])),
    uzman ? getAssignedToMe() : Promise.resolve(listeBasarili<ConsultancyRequest>([])),
    yonetici ? getAllSupportRequests() : Promise.resolve(listeBasarili<AppSupportRequest>([])),
    yonetim ? tumGeriBildirimler() : Promise.resolve(listeBasarili<GeriBildirimSatiri>([])),
  ]);

  const personel = uzman || yonetici || yonetim;
  const taleplerim = !personel || params.sekme === "taleplerim";
  const erisilebilir: KuyrukTuru[] = [
    ...(uzman ? (["uzman-acik", "uzman-bana"] as const) : []),
    ...(yonetici ? (["destek"] as const) : []),
    ...(yonetim ? (["geri-bildirim"] as const) : []),
  ];

  /*
    Talebi kimin açtığı: kuyrukta yalnızca konu yazıyordu. Profil okuması
    RLS'e tabi (uzman kendi kurumunu, iç ekip herkesi görür); okunamazsa
    ad boş kalır, kuyruk düşmez.
  */
  const kisiler = new Map<string, string>();
  const kisiIdleri = [...new Set([...acikTalepler, ...banaAtananlar, ...tumDestek].map((r) => r.requested_by).filter(Boolean))] as string[];
  if (!taleplerim && kisiIdleri.length) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", kisiIdleri);
    if (error) console.error("[destek] talep sahipleri okunamadı:", error.message);
    for (const k of data ?? []) if (k.full_name) kisiler.set(k.id, k.full_name);
  }

  /*
    Yazışmalar tek okumada: öğrencinin kendi talepleri, uzmanın üstlendikleri
    ve iç ekibin destek kuyruğu. Üstlenilmemiş açık talepler okunmuyor —
    RLS onların yazışmasını uzmana zaten göstermez.
  */
  const yazismalar = await yazismalariOku(
    [...new Set([...uzmanTaleplerim, ...banaAtananlar].map((r) => r.id))],
    [...new Set([...destekTaleplerim, ...tumDestek].map((r) => r.id))],
  );
  const yazismaOkunamadi = yazismalar === null;
  const uzmanYazismasi = (id: string) => yazismaKur(yazismalar?.get(id) ?? []);
  const destekYazismasi = (r: AppSupportRequest) =>
    yazismaKur(yazismalar?.get(r.id) ?? [], { metin: r.admin_note, zaman: r.answered_at });

  async function ustlen(id: string) {
    "use server";
    return acceptRequest(id);
  }
  async function tamamla(id: string) {
    "use server";
    return completeRequest(id);
  }
  async function iptal(id: string) {
    "use server";
    return cancelRequest(id);
  }
  async function isleAl(id: string) {
    "use server";
    return updateSupportRequestStatus(id, "in_progress");
  }

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Destek", en: "Support" })}</h1>
          <p>
            {t({
              tr: "Akademik bir konuda takıldıysanız uzmana, uygulamayla ilgili bir sorununuz varsa bize yazın.",
              en: "Stuck on something academic? Ask an expert. Having a problem with the app? Write to us.",
            })}
          </p>
        </div>
        {personel ? (
          <nav className="segment-secici" aria-label={t({ tr: "Destek görünümü", en: "Support view" })}>
            <Link href={kuyrukAdresi(erisilebilir[0])} aria-current={!taleplerim ? "page" : undefined}>
              <Inbox size={15} aria-hidden="true" /> {t({ tr: "Kuyruklar", en: "Queues" })}
            </Link>
            <Link href={TALEPLERIM_ADRESI} aria-current={taleplerim ? "page" : undefined}>
              <LifeBuoy size={15} aria-hidden="true" /> {t({ tr: "Kendi taleplerim", en: "My requests" })}
            </Link>
          </nav>
        ) : null}
      </section>

      {!taleplerim ? (
        <DestekKuyruklari
          erisilebilir={erisilebilir}
          istenenKuyruk={typeof params.kuyruk === "string" ? params.kuyruk : null}
          istenenKayit={typeof params.sec === "string" ? params.sec : null}
          acikTalepler={acikTalepler}
          banaAtananlar={banaAtananlar}
          acikOkunamadi={acikOkunamadi}
          banaOkunamadi={banaOkunamadi}
          destek={tumDestek}
          destekOkunamadi={tumDestekOkunamadi}
          geriBildirimler={geriBildirimler}
          geriBildirimOkunamadi={geriBildirimOkunamadi}
          kisiAdi={(id) => (id ? kisiler.get(id) ?? null : null)}
          uzmanYazismasi={uzmanYazismasi}
          destekYazismasi={destekYazismasi}
          yazismaOkunamadi={yazismaOkunamadi}
          ustlen={ustlen}
          tamamla={tamamla}
          isleAl={isleAl}
        />
      ) : (
      <section className="gb-sutunlar kaynaklar-ikili" aria-label={t({ tr: "Destek", en: "Support" })}>
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Uzman desteği", en: "Expert support" })}</h2>
              <p>{t({ tr: "Yöntem, analiz, istatistik ya da yazım konusunda akademik danışmanlık.", en: "Academic guidance on methodology, analysis, statistics or writing." })}</p>
            </div>
            <PanelDrawer
              triggerLabel={t({ tr: "Uzmana sor", en: "Ask an expert" })}
              triggerIcon={<GraduationCap size={15} aria-hidden="true" />}
              triggerClassName="projects-primary-button button-compact"
              kicker={t({ tr: "Uzman desteği", en: "Expert support" })}
              title={t({ tr: "Uzmana sorun", en: "Ask an expert" })}
              description={t({
                tr: "Hangi konuda desteğe ihtiyacınız var, kısaca yazın. Talebiniz kurumunuzun uzmanına, kurumunuz yoksa ArvoLab ekibine iletilir.",
                en: "Briefly describe what you need help with. Your request goes to your institution's expert, or to the ArvoLab team if you have no institution.",
              })}
            >
              <ActionForm
                className="project-form-grid"
                action={createConsultancyRequest}
                successMessage={t({ tr: "Talebiniz uzmanlara iletildi.", en: "Your request has been sent to the experts." })}
              >
                {calismalar.length > 0 ? (
                  <label>
                    <span>{t({ tr: "Çalışma", en: "Project" })}</span>
                    <select name="projectId" defaultValue={calismalar[0].id}>
                      <option value="">{t({ tr: "Çalışmaya bağlı değil", en: "Not linked to a project" })}</option>
                      {calismalar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    <span>{t({ tr: "Çalışma başlığı (isteğe bağlı)", en: "Project title (optional)" })}</span>
                    <input name="projectTitle" type="text" placeholder={t({ tr: "Örn. Eğitim Bilimleri Tezi", en: "E.g. Education Sciences Thesis" })} />
                  </label>
                )}
                <label>
                  <span>{t({ tr: "Konu", en: "Topic" })}</span>
                  <select name="requestType" defaultValue="analysis">
                    <option value="analysis">{t({ tr: "Analiz desteği", en: "Analysis support" })}</option>
                    <option value="statistics">{t({ tr: "İstatistik desteği", en: "Statistics support" })}</option>
                    <option value="methodology">{t({ tr: "Metodoloji danışmanlığı", en: "Methodology consulting" })}</option>
                    <option value="editing">{t({ tr: "Dil/biçim düzenleme", en: "Language/format editing" })}</option>
                    <option value="full_review">{t({ tr: "Kapsamlı inceleme", en: "Comprehensive review" })}</option>
                    <option value="other">{t({ tr: "Diğer", en: "Other" })}</option>
                  </select>
                </label>
                <label className="project-form-full">
                  <span>{t({ tr: "Mesajınız", en: "Your message" })}</span>
                  <textarea name="message" rows={4} placeholder={t({ tr: "Nerede takıldığınızı kısaca anlatın", en: "Briefly describe where you are stuck" })} />
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <Send size={16} aria-hidden="true" /> {t({ tr: "Gönder", en: "Send" })}
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          </header>

          {/* Okunamadı ile "talebiniz yok" ayrı: boş görünen öğrenci açık bir talebi yeniden açabilirdi. */}
          {uzmanOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              {t({
                tr: "Talepleriniz yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.",
                en: "Your requests could not be loaded. You may have an open request; refresh the page before opening a new one.",
              })}
            </p>
          ) : uzmanTaleplerim.length ? (
            <ul className="kanit-kayitlari">
              {uzmanTaleplerim.map((r) => {
                const mesajlar = uzmanYazismasi(r.id);
                const yeniYanit = yanitGeldi(mesajlar) && r.status === "accepted";
                const yazma = uzmanYazismaDurumu(r.status, "talep_sahibi", dil);
                // Uzmanın adı yazışmadan: bireysel öğrenci iç ekip uzmanının profilini okuyamaz.
                const uzmanAdi = mesajlar.find((m) => m.taraf === "uzman")?.yazanAdi ?? null;
                return (
                <li key={r.id}>
                  <details className="kanit-kayit" open={yeniYanit}>
                    <summary>
                      <span className="kanit-kayit-govde">
                        <b>{t(requestTypeLabel(r.request_type))}</b>
                        <small>
                          {r.project_title || t({ tr: "Çalışmaya bağlı değil", en: "Not linked to a project" })} · {tarihSaat(r.created_at)}
                        </small>
                      </span>
                      <span className="status-pill" data-tone={yeniYanit ? "success" : statusTone(r.status)}>
                        {yeniYanit ? t({ tr: "Yanıt var", en: "New reply" }) : UZMAN_DURUMU[r.status] ? t(UZMAN_DURUMU[r.status]) : r.status}
                      </span>
                    </summary>
                    <div className="kanit-kayit-ic">
                      <p className="destek-mesaj">{r.message || t({ tr: "Ek mesaj yazılmadı.", en: "No additional message." })}</p>
                      {r.status === "open" ? (
                        <p className="hint">
                          {t({
                            tr: "Talebiniz bir uzmanın üstlenmesini bekliyor. Bu arada ek bilgi yazabilirsiniz.",
                            en: "Your request is waiting for an expert to take it on. Meanwhile, you can add more information.",
                          })}
                        </p>
                      ) : r.status === "accepted" ? (
                        <p className="hint">
                          {uzmanAdi
                            ? t({ tr: `${uzmanAdi} talebinizi üstlendi.`, en: `${uzmanAdi} has taken on your request.` })
                            : t({ tr: "Bir uzman talebinizi üstlendi.", en: "An expert has taken on your request." })}{" "}
                          {t({ tr: "Yazışma aşağıda.", en: "The conversation is below." })}
                        </p>
                      ) : null}
                      <Yazisma
                        mesajlar={mesajlar}
                        benimTarafim="talep_sahibi"
                        okunamadi={yazismaOkunamadi}
                        gonder={yazma.yazabilir ? destekMesajiGonder.bind(null, "uzman", r.id) : null}
                        kapaliNedeni={yazma.yazabilir ? undefined : yazma.neden}
                        yerTutucu={t({
                          tr: "Uzmana yazın: ek bilgi, soru ya da dosyanın neresinde takıldığınız",
                          en: "Write to the expert: more information, a question, or where in the file you are stuck",
                        })}
                      />
                      {r.status === "open" ? (
                        <ActionForm
                          action={iptal.bind(null, r.id)}
                          confirmMessage={t({ tr: "Bu destek talebini iptal etmek istediğinize emin misiniz?", en: "Are you sure you want to cancel this support request?" })}
                          successMessage={t({ tr: "Talep iptal edildi.", en: "The request was canceled." })}
                        >
                          <button type="submit" className="link-button">
                            <XCircle size={14} aria-hidden="true" /> {t({ tr: "Talebi iptal et", en: "Cancel request" })}
                          </button>
                        </ActionForm>
                      ) : null}
                    </div>
                  </details>
                </li>
                );
              })}
            </ul>
          ) : (
            <BosDurum
              kompakt
              ikon={GraduationCap}
              aciklama={t({
                tr: "Henüz uzman talebiniz yok. Yöntem, analiz ya da yazımda takıldığınızda “Uzmana sor” ile yazın.",
                en: "You have no expert requests yet. When you get stuck on methodology, analysis or writing, write via “Ask an expert”.",
              })}
            />
          )}
          <PartnerSeridi />
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Uygulama desteği", en: "App support" })}</h2>
              <p>{t({ tr: "Hata, erişim, ödeme sorunu ya da bir özellik isteği.", en: "A bug, an access or payment problem, or a feature request." })}</p>
              {/* Yazmadan önce cevabı belki kılavuzda vardır (30.10.2026). */}
              <p className="text-sm">
                <Link href="/dashboard/yardim">
                  <BookOpen size={13} aria-hidden="true" /> {t({ tr: "Kullanım Kılavuzu", en: "User Guide" })}
                </Link>
              </p>
            </div>
            <PanelDrawer
              triggerLabel={t({ tr: "Bize yaz", en: "Write to us" })}
              triggerIcon={<LifeBuoy size={15} aria-hidden="true" />}
              triggerClassName="projects-primary-button button-compact"
              kicker={t({ tr: "Uygulama desteği", en: "App support" })}
              title={t({ tr: "Bize yazın", en: "Write to us" })}
              description={t({
                tr: "Sorununuzu ya da isteğinizi kısaca anlatın; yanıtımız bu kartta görünür.",
                en: "Briefly describe your problem or request; our reply will appear on this card.",
              })}
            >
              <ActionForm
                className="project-form-grid"
                action={createSupportRequest}
                successMessage={t({ tr: "Destek talebiniz iletildi.", en: "Your support request has been sent." })}
              >
                <label className="project-form-full">
                  <span>{t({ tr: "Konu", en: "Subject" })}</span>
                  <input name="subject" type="text" placeholder={t({ tr: "Kısa bir başlık", en: "A short title" })} required />
                </label>
                <label>
                  <span>{t({ tr: "Kategori", en: "Category" })}</span>
                  <select name="category" defaultValue="other">
                    {Object.entries(KATEGORI).map(([deger, ad]) => (
                      <option key={deger} value={deger}>
                        {t(ad)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t({ tr: "Öncelik", en: "Priority" })}</span>
                  <select name="priority" defaultValue="normal">
                    {Object.entries(ONCELIK).map(([deger, ad]) => (
                      <option key={deger} value={deger}>
                        {t(ad)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="project-form-full">
                  <span>{t({ tr: "Mesajınız", en: "Your message" })}</span>
                  <textarea name="message" rows={5} placeholder={t({ tr: "Ne oldu, ne bekliyordunuz?", en: "What happened, and what did you expect?" })} required />
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <Send size={16} aria-hidden="true" /> {t({ tr: "Gönder", en: "Send" })}
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          </header>

          {destekOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              {t({
                tr: "Talepleriniz yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.",
                en: "Your requests could not be loaded. You may have an open request; refresh the page before opening a new one.",
              })}
            </p>
          ) : destekTaleplerim.length ? (
            <ul className="kanit-kayitlari">
              {destekTaleplerim.map((r) => {
                const mesajlar = destekYazismasi(r);
                const yanitlandi = yanitGeldi(mesajlar);
                return (
                  <li key={r.id}>
                    <details className="kanit-kayit" open={yanitlandi && r.status !== "resolved"}>
                      <summary>
                        <span className="kanit-kayit-govde">
                          <b>{r.subject}</b>
                          <small>
                            {KATEGORI[r.category] ? t(KATEGORI[r.category]) : r.category} · {tarihSaat(r.created_at)}
                          </small>
                        </span>
                        <span className="status-pill" data-tone={yanitlandi ? "success" : statusTone(r.status)}>
                          {r.status === "resolved"
                            ? t(DESTEK_DURUMU.resolved)
                            : yanitlandi
                              ? t({ tr: "Yanıtlandı", en: "Answered" })
                              : t(DESTEK_DURUMU[r.status] ?? { tr: r.status, en: r.status })}
                        </span>
                      </summary>
                      <div className="kanit-kayit-ic">
                        {/* Kendi yazdığını da görsün: kullanıcı ne bildirdiğini hatırlamıyordu. */}
                        <p className="destek-mesaj">{r.message}</p>
                        {!mesajlar.length ? <p className="hint">{t({ tr: "Talebiniz alındı. Yanıtlandığında burada görünecek.", en: "Your request was received. The reply will appear here." })}</p> : null}
                        {r.status === "resolved" ? (
                          <p className="hint">
                            {t({
                              tr: "Talep çözüldü olarak işaretlendi. Sorun sürüyorsa yazın; talep yeniden açılır.",
                              en: "This request was marked as resolved. If the problem continues, write here; the request will reopen.",
                            })}
                          </p>
                        ) : null}
                        <Yazisma
                          mesajlar={mesajlar}
                          benimTarafim="talep_sahibi"
                          okunamadi={yazismaOkunamadi}
                          gonder={destekMesajiGonder.bind(null, "destek", r.id)}
                          yerTutucu={t({ tr: "Ek bilgi yazın ya da yanıta cevap verin", en: "Add more information or reply to the answer" })}
                        />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <BosDurum
              kompakt
              ikon={LifeBuoy}
              aciklama={t({
                tr: "Henüz destek talebiniz yok. Uygulamada bir sorun yaşarsanız ya da bir özellik isterseniz “Bize yaz” ile iletin.",
                en: "You have no support requests yet. If you run into a problem with the app or want a feature, send it via “Write to us”.",
              })}
            />
          )}
        </article>
      </section>
      )}
    </main>
  );
}
