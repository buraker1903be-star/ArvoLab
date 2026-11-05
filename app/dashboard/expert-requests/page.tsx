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
import { talepSirasi, uzmanYazismaDurumu, yanitGeldi, yazismaKur } from "@/lib/destek-yazisma";
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
import SayfaBasligi from "../_components/sayfa/sayfa-basligi";
import Bolum from "../_components/sayfa/bolum";
import DurumGostergesi, { type DurumTonu } from "../_components/sayfa/durum-gostergesi";
import IkiKartSecim from "../_components/iki-kart-secim";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Destek", en: "Support" }) };
}

/*
  DESTEK — TEK SAYFA (26.10.2026, Kaynaklar'la aynı karar: dock'tan
  girince iki sekme çıkmasın). 4.4'teki düzen için return'ün üstündeki not.

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

  /*
    SIGNATURE OS 4.4 (05.11.2026): KANALLAR ÜSTTE, TALEPLER TEK LİSTEDE.
    Eskiden iki kart yan yanaydı (Uzman desteği, Uygulama desteği) ve her
    talebin yazışması kendi kartının İÇİNDE açılıyordu: sayfa sabit
    yükseklikte olduğu için kartlar kendi içinde kayıyor, uzun bir
    yazışma listeyi aşağı itiyor ve iki kartta açık iki yazışma aynı anda
    okunamıyordu. Şimdi üstte iki kanal (ne zaman hangisine yazılır, tek
    düğme), altta personel kuyruğu ve Belge Kontrol'le aynı düzen
    (IkiKartSecim): solda bütün taleplerim, sağda seçilenin ayrıntısı ve
    yazışması. Yanıt gelen talepler başta; kapananlar sonda. Telefonda
    seçim ayrıntıya kaydırır, başında "Listeye dön" var.
  */
  type Talep =
    | { tur: "uzman"; r: ConsultancyRequest; mesajlar: ReturnType<typeof uzmanYazismasi>; yeni: boolean; kapali: boolean; zaman: string }
    | { tur: "destek"; r: AppSupportRequest; mesajlar: ReturnType<typeof uzmanYazismasi>; yeni: boolean; kapali: boolean; zaman: string };
  const talepler: Talep[] = talepSirasi([
    ...uzmanTaleplerim.map((r): Talep => {
      const mesajlar = uzmanYazismasi(r.id);
      return { tur: "uzman", r, mesajlar, yeni: yanitGeldi(mesajlar) && r.status === "accepted", kapali: r.status === "completed" || r.status === "cancelled", zaman: r.created_at };
    }),
    ...destekTaleplerim.map((r): Talep => {
      const mesajlar = destekYazismasi(r);
      return { tur: "destek", r, mesajlar, yeni: yanitGeldi(mesajlar) && r.status !== "resolved", kapali: r.status === "resolved", zaman: r.created_at };
    }),
  ]);
  const acikSayisi = talepler.filter((x) => !x.kapali).length;

  const durumHapi = (x: Talep) =>
    x.tur === "uzman"
      ? { ton: x.yeni ? "success" : statusTone(x.r.status), ad: x.yeni ? t({ tr: "Yanıt var", en: "New reply" }) : UZMAN_DURUMU[x.r.status] ? t(UZMAN_DURUMU[x.r.status]) : x.r.status }
      : {
          ton: x.kapali ? statusTone(x.r.status) : x.yeni ? "success" : statusTone(x.r.status),
          ad: x.kapali
            ? t(DESTEK_DURUMU.resolved)
            : x.yeni
              ? t({ tr: "Yanıtlandı", en: "Answered" })
              : t(DESTEK_DURUMU[x.r.status] ?? { tr: x.r.status, en: x.r.status }),
        };

  const uzmanFormu = (
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
            <option value="ethics">{t({ tr: "Etik kurul başvurusu", en: "Ethics committee application" })}</option>
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
  );

  const destekFormu = (
    <PanelDrawer
      triggerLabel={t({ tr: "Bize yaz", en: "Write to us" })}
      triggerIcon={<LifeBuoy size={15} aria-hidden="true" />}
      triggerClassName="projects-filter-button button-compact"
      kicker={t({ tr: "Uygulama desteği", en: "App support" })}
      title={t({ tr: "Bize yazın", en: "Write to us" })}
      description={t({
        tr: "Sorununuzu ya da isteğinizi kısaca anlatın; yanıtımız Taleplerim listesinde görünür.",
        en: "Briefly describe your problem or request; our reply will appear in My requests.",
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
  );

  const ayrinti = (x: Talep) => {
    const hap = durumHapi(x);
    if (x.tur === "uzman") {
      const r = x.r;
      const yazma = uzmanYazismaDurumu(r.status, "talep_sahibi", dil);
      // Uzmanın adı yazışmadan: bireysel öğrenci iç ekip uzmanının profilini okuyamaz.
      const uzmanAdi = x.mesajlar.find((m) => m.taraf === "uzman")?.yazanAdi ?? null;
      return (
        <article className="destek-ayrinti">
          <header className="destek-ayrinti-bas">
            <span className="dashboard-kicker">{t({ tr: "Uzman desteği", en: "Expert support" })}</span>
            <h2>{t(requestTypeLabel(r.request_type))}</h2>
            <p className="destek-ayrinti-meta">
              <DurumGostergesi ton={hap.ton as DurumTonu} ne={t({ tr: "Durum", en: "Status" })}>
                {hap.ad}
              </DurumGostergesi>
              <span>{r.project_title || t({ tr: "Çalışmaya bağlı değil", en: "Not linked to a project" })}</span>
              <span>{tarihSaat(r.created_at)}</span>
            </p>
          </header>
          <Bolum id={`talep-${r.id}`} baslik={t({ tr: "Talebiniz", en: "Your request" })}>
            <p className="destek-mesaj destek-mesaj-kutu">{r.message || t({ tr: "Ek mesaj yazılmadı.", en: "No additional message." })}</p>
          </Bolum>
          <Bolum
            id={`yazisma-${r.id}`}
            baslik={t({ tr: "Yazışma", en: "Conversation" })}
            aciklama={
              r.status === "open"
                ? t({
                    tr: "Talebiniz bir uzmanın üstlenmesini bekliyor. Bu arada ek bilgi yazabilirsiniz.",
                    en: "Your request is waiting for an expert to take it on. Meanwhile, you can add more information.",
                  })
                : r.status === "accepted"
                  ? uzmanAdi
                    ? t({ tr: `${uzmanAdi} talebinizi üstlendi.`, en: `${uzmanAdi} has taken on your request.` })
                    : t({ tr: "Bir uzman talebinizi üstlendi.", en: "An expert has taken on your request." })
                  : undefined
            }
          >
            <Yazisma
              mesajlar={x.mesajlar}
              benimTarafim="talep_sahibi"
              okunamadi={yazismaOkunamadi}
              gonder={yazma.yazabilir ? destekMesajiGonder.bind(null, "uzman", r.id) : null}
              kapaliNedeni={yazma.yazabilir ? undefined : yazma.neden}
              yerTutucu={t({
                tr: "Uzmana yazın: ek bilgi, soru ya da dosyanın neresinde takıldığınız",
                en: "Write to the expert: more information, a question, or where in the file you are stuck",
              })}
            />
          </Bolum>
          {r.status === "open" ? (
            <ActionForm
              action={iptal.bind(null, r.id)}
              confirmMessage={t({ tr: "Bu destek talebini iptal etmek istediğinize emin misiniz?", en: "Are you sure you want to cancel this support request?" })}
              successMessage={t({ tr: "Talep iptal edildi.", en: "The request was canceled." })}
              className="destek-ayrinti-alt"
            >
              <button type="submit" className="link-button">
                <XCircle size={14} aria-hidden="true" /> {t({ tr: "Talebi iptal et", en: "Cancel request" })}
              </button>
            </ActionForm>
          ) : null}
        </article>
      );
    }
    const r = x.r;
    return (
      <article className="destek-ayrinti">
        <header className="destek-ayrinti-bas">
          <span className="dashboard-kicker">{t({ tr: "Uygulama desteği", en: "App support" })}</span>
          <h2>{r.subject}</h2>
          <p className="destek-ayrinti-meta">
            <DurumGostergesi ton={hap.ton as DurumTonu} ne={t({ tr: "Durum", en: "Status" })}>
              {hap.ad}
            </DurumGostergesi>
            <span>{KATEGORI[r.category] ? t(KATEGORI[r.category]) : r.category}</span>
            {ONCELIK[r.priority] && r.priority !== "normal" ? <span>{t({ tr: `Öncelik: ${t(ONCELIK[r.priority])}`, en: `Priority: ${t(ONCELIK[r.priority])}` })}</span> : null}
            <span>{tarihSaat(r.created_at)}</span>
          </p>
        </header>
        {/* Kendi yazdığını da görsün: kullanıcı ne bildirdiğini hatırlamıyordu. */}
        <Bolum id={`talep-${r.id}`} baslik={t({ tr: "Talebiniz", en: "Your request" })}>
          <p className="destek-mesaj destek-mesaj-kutu">{r.message}</p>
        </Bolum>
        <Bolum
          id={`yazisma-${r.id}`}
          baslik={t({ tr: "Yazışma", en: "Conversation" })}
          aciklama={
            r.status === "resolved"
              ? t({
                  tr: "Talep çözüldü olarak işaretlendi. Sorun sürüyorsa yazın; talep yeniden açılır.",
                  en: "This request was marked as resolved. If the problem continues, write here; the request will reopen.",
                })
              : !x.mesajlar.length
                ? t({ tr: "Talebiniz alındı. Yanıtlandığında burada görünecek.", en: "Your request was received. The reply will appear here." })
                : undefined
          }
        >
          <Yazisma
            mesajlar={x.mesajlar}
            benimTarafim="talep_sahibi"
            okunamadi={yazismaOkunamadi}
            gonder={destekMesajiGonder.bind(null, "destek", r.id)}
            yerTutucu={t({ tr: "Ek bilgi yazın ya da yanıta cevap verin", en: "Add more information or reply to the answer" })}
          />
        </Bolum>
      </article>
    );
  };

  return (
    <main className="dashboard-page destek-sayfa">
      <SayfaBasligi
        baslik={t({ tr: "Destek", en: "Support" })}
        aciklama={t({
          tr: "Akademik bir konuda takıldıysanız uzmana, uygulamayla ilgili bir sorununuz varsa bize yazın.",
          en: "Stuck on something academic? Ask an expert. Having a problem with the app? Write to us.",
        })}
        baglam={
          personel ? (
            <nav className="segment-secici" aria-label={t({ tr: "Destek görünümü", en: "Support view" })}>
              <Link href={kuyrukAdresi(erisilebilir[0])} aria-current={!taleplerim ? "page" : undefined}>
                <Inbox size={15} aria-hidden="true" /> {t({ tr: "Kuyruklar", en: "Queues" })}
              </Link>
              <Link href={TALEPLERIM_ADRESI} aria-current={taleplerim ? "page" : undefined}>
                <LifeBuoy size={15} aria-hidden="true" /> {t({ tr: "Kendi taleplerim", en: "My requests" })}
              </Link>
            </nav>
          ) : undefined
        }
      />

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
        <>
          <section className="destek-kanallar" aria-label={t({ tr: "Destek kanalları", en: "Support channels" })}>
            <article className="destek-kanal">
              <span className="destek-kanal-ikon" aria-hidden="true">
                <GraduationCap size={18} />
              </span>
              <div className="destek-kanal-govde">
                <h2>{t({ tr: "Uzman desteği", en: "Expert support" })}</h2>
                <p>{t({ tr: "Yöntem, analiz, istatistik ya da yazım konusunda akademik danışmanlık.", en: "Academic guidance on methodology, analysis, statistics or writing." })}</p>
              </div>
              {uzmanFormu}
            </article>
            <article className="destek-kanal">
              <span className="destek-kanal-ikon" aria-hidden="true">
                <LifeBuoy size={18} />
              </span>
              <div className="destek-kanal-govde">
                <h2>{t({ tr: "Uygulama desteği", en: "App support" })}</h2>
                <p>
                  {t({ tr: "Hata, erişim, ödeme sorunu ya da bir özellik isteği.", en: "A bug, an access or payment problem, or a feature request." })}{" "}
                  {/* Yazmadan önce cevabı belki kılavuzda vardır (30.10.2026). */}
                  <Link href="/dashboard/yardim" className="link-accent">
                    <BookOpen size={13} aria-hidden="true" /> {t({ tr: "Önce Kullanım Kılavuzu'na bakın", en: "Check the User Guide first" })}
                  </Link>
                </p>
              </div>
              {destekFormu}
            </article>
          </section>

          {/* Okunamadı ile "talebiniz yok" ayrı: boş görünen öğrenci açık bir talebi yeniden açabilirdi. */}
          {uzmanOkunamadi || destekOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              {t({
                tr: "Taleplerinizin bir kısmı yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.",
                en: "Some of your requests could not be loaded. You may have an open request; refresh the page before opening a new one.",
              })}
            </p>
          ) : null}

          <IkiKartSecim
            key={talepler[0]?.r.id ?? "bos"}
            sayfa
            solBaslik={
              talepler.length
                ? t({ tr: `Taleplerim · ${acikSayisi} açık`, en: `My requests · ${acikSayisi} open` })
                : t({ tr: "Taleplerim", en: "My requests" })
            }
            solAlt={
              talepler.length ? null : (
                <BosDurum
                  kompakt
                  ikon={Inbox}
                  aciklama={t({
                    tr: "Henüz talebiniz yok. Akademik bir sorunuz için “Uzmana sor”, uygulamayla ilgili bir sorun için “Bize yaz”.",
                    en: "You have no requests yet. Use “Ask an expert” for an academic question, “Write to us” for a problem with the app.",
                  })}
                />
              )
            }
            secenekler={talepler.map((x) => {
              const hap = durumHapi(x);
              return {
                id: x.r.id,
                satir: (
                  <>
                    <span className="destek-satir-ikon" aria-hidden="true">
                      {x.tur === "uzman" ? <GraduationCap size={16} /> : <LifeBuoy size={16} />}
                    </span>
                    <span className="kanit-kayit-govde" data-kapali={x.kapali ? "true" : undefined}>
                      <b>{x.tur === "uzman" ? t(requestTypeLabel(x.r.request_type)) : x.r.subject}</b>
                      <small>
                        {x.tur === "uzman" ? t({ tr: "Uzman", en: "Expert" }) : t({ tr: "Uygulama", en: "App" })} ·{" "}
                        {x.tur === "uzman"
                          ? x.r.project_title || t({ tr: "Çalışmaya bağlı değil", en: "Not linked to a project" })
                          : KATEGORI[x.r.category]
                            ? t(KATEGORI[x.r.category])
                            : x.r.category}{" "}
                        · {tarihSaat(x.r.created_at)}
                      </small>
                    </span>
                    <DurumGostergesi ton={hap.ton as DurumTonu}>{hap.ad}</DurumGostergesi>
                  </>
                ),
                ayrinti: ayrinti(x),
              };
            })}
            bos={
              <ol className="destek-nasil">
                <li>
                  <b>{t({ tr: "Yazın", en: "Write" })}</b>
                  <small>{t({ tr: "Akademik soru uzmana, uygulama sorunu bize.", en: "Academic questions to an expert, app problems to us." })}</small>
                </li>
                <li>
                  <b>{t({ tr: "Yanıt burada görünür", en: "The reply appears here" })}</b>
                  <small>{t({ tr: "Yanıt gelen talep listenin başına çıkar.", en: "Requests with a reply move to the top of the list." })}</small>
                </li>
                <li>
                  <b>{t({ tr: "Yazışarak sürdürün", en: "Keep the conversation going" })}</b>
                  <small>{t({ tr: "Çözülen talebe yazarsanız talep yeniden açılır.", en: "Writing to a resolved request reopens it." })}</small>
                </li>
              </ol>
            }
          />
          <PartnerSeridi />
        </>
      )}
    </main>
  );
}
