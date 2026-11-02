import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ActionForm from "@/app/dashboard/action-form";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { etikBilgileriniKaydet } from "@/app/actions/etik-kurul";
import { ceviri } from "@/lib/dil-sunucu";
import { trGunAnahtari } from "@/lib/tr-time";
import { belgeListesiniTemizle } from "@/lib/etik/belgeler";
import { ETIK_DURUM_ADI, ETIK_DURUMLARI, etikUyarilari, type EtikDurum, type EtikKaydi } from "@/lib/etik/durum";
import CalismaSekmeleri from "../calisma-sekmeleri";
import EtikBelgeleri from "./etik-belgeleri";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Etik kurul", en: "Ethics committee" }) };
}

/*
  ETİK KURUL SEKMESİ (02.11.2026, kurum sahibinin isteği). Tablo
  etik_kurul (20261102134543), kurallar lib/etik/.

  ArvoLab başvuru belgelerini YAZMAZ (AGENTS.md, "asistan denetler,
  yazmaz"): başvurunun durumunu ve kurulun kararını tutar, kurulun
  yönergesinde geçen belgeleri listeler ve TARİH KİLİDİNİ uygular —
  veri toplama onaydan önce başladıysa tehlike olarak söyler. Teslim
  kontrolü ve Analiz Merkezi aynı karardan okur (lib/etik/durum.ts).
  Kurulun kararı hakkında hüküm verilmez; "onaydan geçer" denmez.
*/
export default async function EtikKurulSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await ceviri();

  const [{ data: calisma, error }, { data: kayit, error: kayitHatasi }] = await Promise.all([
    supabase.from("academic_projects").select("id, title, project_type").eq("id", id).maybeSingle(),
    supabase.from("etik_kurul").select("*").eq("project_id", id).maybeSingle(),
  ]);
  if (error || kayitHatasi) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">
          {t({ tr: "Etik kurul bilgileri okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.", en: "The ethics details could not be read. Your data is safe; refresh the page." })}
        </p>
      </main>
    );
  }
  if (!calisma) notFound();

  const belgeler = belgeListesiniTemizle(kayit?.belgeler);
  const etik: EtikKaydi | null = kayit
    ? {
        durum: kayit.durum as EtikDurum,
        onay_tarihi: kayit.onay_tarihi,
        karar_no: kayit.karar_no,
        veri_toplama_baslangic: kayit.veri_toplama_baslangic,
        gerekmeme_gerekcesi: kayit.gerekmeme_gerekcesi,
        belgeler,
      }
    : null;
  const uyarilar = etikUyarilari(etik, trGunAnahtari());
  const durum: EtikDurum = etik?.durum ?? "belirsiz";

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">{t({ tr: "Etik kurul", en: "Ethics committee" })} · {t(ETIK_DURUM_ADI[durum])}</span>
          <h1>{calisma.title}</h1>
          <p>
            {t({
              tr: "Başvurunuzu takip edin, kurulun istediği belgeleri listeleyin ve verinin onaydan önce toplanmadığından emin olun. Belgeleri siz hazırlarsınız; ArvoLab takip eder ve denetler.",
              en: "Track your application, list the documents the committee requires and make sure no data is collected before approval. You prepare the documents; ArvoLab tracks and checks.",
            })}
          </p>
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="etik" />

      {uyarilar.length ? (
        <div className="etik-uyarilar">
          {uyarilar.map((u) => (
            <p key={u.metin.tr} className="alert" data-tone={u.ton} role={u.ton === "danger" ? "alert" : "status"}>
              {t(u.metin)}
            </p>
          ))}
        </div>
      ) : null}

      <section className="gb-sutunlar etik-izgara" aria-label={t({ tr: "Etik kurul", en: "Ethics committee" })}>
        <article className="gb-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Başvuru ve karar", en: "Application and decision" })}</h2>
              <p>{t({ tr: "Kurulun kararını tez ve makalenin yöntem bölümüne de yazacaksınız.", en: "You'll also write the committee's decision in the method section of your thesis or article." })}</p>
            </div>
          </header>
          <ActionForm className="project-form-grid" action={etikBilgileriniKaydet} successMessage={t({ tr: "Etik kurul bilgileri kaydedildi.", en: "Ethics details saved." })}>
            <input type="hidden" name="project_id" value={id} />
            <label className="project-form-full">
              <span>{t({ tr: "Durum", en: "Status" })}</span>
              <select name="durum" defaultValue={durum}>
                {ETIK_DURUMLARI.map((d) => (
                  <option key={d} value={d}>{t(ETIK_DURUM_ADI[d])}</option>
                ))}
              </select>
            </label>
            <label className="project-form-full">
              <span>{t({ tr: "Etik kurulun adı", en: "Ethics committee name" })}</span>
              <input name="kurulAdi" type="text" maxLength={300} defaultValue={kayit?.kurul_adi ?? ""} placeholder={t({ tr: "Ör. Sosyal ve Beşerî Bilimler Etik Kurulu", en: "e.g. Social Sciences Ethics Committee" })} />
            </label>
            <label>
              <span>{t({ tr: "Başvuru tarihi", en: "Application date" })}</span>
              <TarihSecici name="basvuruTarihi" deger={kayit?.basvuru_tarihi ?? ""} etiket={t({ tr: "Başvuru tarihi", en: "Application date" })} />
            </label>
            <label>
              <span>{t({ tr: "Onay (karar) tarihi", en: "Approval (decision) date" })}</span>
              <TarihSecici name="onayTarihi" deger={kayit?.onay_tarihi ?? ""} etiket={t({ tr: "Onay tarihi", en: "Approval date" })} />
            </label>
            <label>
              <span>{t({ tr: "Karar / protokol sayısı", en: "Decision / protocol number" })}</span>
              <input name="kararNo" type="text" maxLength={120} defaultValue={kayit?.karar_no ?? ""} placeholder={t({ tr: "Ör. 2026/45", en: "e.g. 2026/45" })} />
            </label>
            <label>
              <span>{t({ tr: "Veri toplamaya başlama tarihi", en: "Data collection start date" })}</span>
              <TarihSecici name="veriToplamaBaslangic" deger={kayit?.veri_toplama_baslangic ?? ""} etiket={t({ tr: "Veri toplama başlangıcı", en: "Data collection start" })} />
            </label>
            <label className="project-form-full">
              <span>{t({ tr: "Etik kurul gerekmiyorsa gerekçesi", en: "If not required, why" })}</span>
              <textarea name="gerekmemeGerekcesi" rows={2} maxLength={1000} defaultValue={kayit?.gerekmeme_gerekcesi ?? ""} placeholder={t({ tr: "Ör. Yalnızca kamuya açık, kimliksiz ikincil veri kullanılıyor.", en: "e.g. Only public, de-identified secondary data is used." })} />
            </label>
            <label className="project-form-full">
              <span>{t({ tr: "Notlar", en: "Notes" })}</span>
              <textarea name="notlar" rows={3} maxLength={4000} defaultValue={kayit?.notlar ?? ""} placeholder={t({ tr: "Kurulun istediği düzeltmeler, toplantı tarihi…", en: "Revisions requested by the committee, meeting date…" })} />
            </label>
            <div className="project-form-full cluster">
              <button type="submit" className="projects-primary-button">{t({ tr: "Kaydet", en: "Save" })}</button>
            </div>
          </ActionForm>
        </article>

        <article className="gb-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Başvuru belgeleri", en: "Application documents" })}</h2>
              <p>{t({ tr: "Her kurulun istediği farklıdır; liste kurulunuzun yönergesinden çıkar.", en: "Each committee asks for different things; the list comes from your committee's guideline." })}</p>
            </div>
          </header>
          <EtikBelgeleri projectId={id} baslangic={belgeler} yonergeAdi={kayit?.yonerge_adi ?? null} />
        </article>
      </section>

      <aside className="etik-not">
        <ShieldCheck size={16} aria-hidden="true" />
        <p>
          {t({
            tr: "Başvuru formunu, araştırma protokolünü ve onam formunu siz yazarsınız; ArvoLab bu belgeleri yazmaz ve kurulun kararı hakkında öngörüde bulunmaz. Onam formunuza ya da başvurunuza bir uzmanın bakmasını isterseniz ",
            en: "You write the application form, research protocol and consent form; ArvoLab doesn't write these documents or predict the committee's decision. If you'd like an expert to review your consent form or application, ",
          })}
          <Link href="/dashboard/expert-requests">
            <LifeBuoy size={13} aria-hidden="true" /> {t({ tr: "Destek'ten uzmana sorun", en: "ask an expert via Support" })}
          </Link>
          .
        </p>
      </aside>
    </main>
  );
}
