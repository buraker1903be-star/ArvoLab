import Link from "next/link";
import { aktifDil, aktifSaatDilimi, ceviri, tarihler } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import ActionForm from "../action-form";
import TezTakvimiPenceresi from "./tez-takvimi-penceresi";
import { takvimiGetir } from "@/app/actions/tez-takvimi";
import { kalanMetni, siradakiTas, takvimOzeti } from "@/lib/tez-takvimi";
import { trGunAnahtari } from "@/lib/tr-time";
import DeleteProjectButton from "./delete-project-button";
import { createClient } from "@/lib/supabase/server";
import { projectTypeLabel, ROLE_LABELS, statusLabel, type UserRole } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import { simdi } from "@/lib/genel-bakis";
import { editedAgo } from "@/lib/writing-stats";
import type { DueInfo } from "@/lib/due-date";
import type { KartIlerlemesi } from "@/lib/calisma-karti";
import type { WritingPace } from "@/lib/writing-pace";
import type { Tutarsizlik } from "@/lib/calisma-tutarlilik";
import type { ActionResult } from "@/lib/auth-guards";

/*
  PERSONEL ÇALIŞMALARIM — SAĞ KART (26.10.2026, kurum sahibinin isteği:
  personel düzeni de öğrencininki gibi iki kart, tek ekran).

  Eskiden personel onlarca çalışmayı alt alta uzun kartlarla tarıyordu:
  her kartta onay, atama, beş düğme ve menü; sayfa kilometrelerce
  kayıyordu. Artık soldaki listeden seçiliyor, ayrıntı ve denetim
  eylemleri burada. Veriler sayfanın zaten okuduklarından geliyor;
  ek okuma yalnızca son kılavuz kontrolü (yazim_kontrolleri, tek satır).

  Denetim eylemleri (onay, sorumlu ataması) öğrencinin eylemlerinden
  ayrı çerçevede: kimin eylemi olduğu karışmasın.
*/
type Calisma = {
  id: string;
  title: string;
  project_type: string;
  university: string | null;
  status: string;
  due_date: string | null;
  owner_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  controller_approved_at: string | null;
};

export default async function PersonelCalismaKarti({
  calisma,
  sahipAdi,
  yazim,
  ilerleme,
  tempo,
  due,
  acikYorum,
  tutarsizliklar,
  personel,
  personelOkunamadi,
  silebilir,
  onayla,
  onayiGeriAl,
  ata,
}: {
  calisma: Calisma;
  sahipAdi: string | null;
  yazim: { words: number; updatedAt: string } | undefined;
  ilerleme: KartIlerlemesi | null;
  tempo: WritingPace | null;
  due: DueInfo | null;
  acikYorum: number;
  tutarsizliklar: Tutarsizlik[];
  personel: { id: string; full_name: string | null; role: UserRole }[];
  personelOkunamadi: boolean;
  silebilir: boolean;
  onayla: () => Promise<ActionResult>;
  onayiGeriAl: () => Promise<ActionResult>;
  ata: (formData: FormData) => Promise<ActionResult>;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const saatDilimi = await aktifSaatDilimi();
  const { tarih, tarihSaat } = await tarihler();
  const merkez = `/dashboard/editor/${calisma.id}`;
  const onayli = !!calisma.controller_approved_at;
  // Eski kayıtlarda sorumlu yalnızca serbest metin olarak tutuluyordu (assignee_id boş).
  const eskiSorumlu = !calisma.assignee_id && calisma.assignee_name;

  /* Son kılavuz kontrolü: öğrenci kontrolü çalıştırdı mı, ne buldu. Okunamazsa satır çizilmiyor. */
  const supabase = await createClient();
  /* Öğrencinin tez takvimi (28.10.2026): danışman ve kontrolör planı ve geciken taşı görür; düzenleme öğrencide. */
  const takvim = await takvimiGetir(calisma.id);
  const bugun = trGunAnahtari();
  const siradakiKilometre = takvim ? siradakiTas(takvim, bugun) : null;
  const takvimSayilari = takvim ? takvimOzeti(takvim, bugun) : null;
  const { data: sonKontrol } = await supabase
    .from("yazim_kontrolleri")
    .select("created_at, hata, uyari, eksik_bolum")
    .eq("project_id", calisma.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <article className="gb-kart gb-sutun calisma-durum kayan-kart" aria-label={t({ tr: `${calisma.title}: durum`, en: `${calisma.title}: status` })}>
      <header className="calisma-durum-bas">
        <div>
          <span className="calisma-durum-ust">
            <span className="status-pill" data-tone={statusTone(calisma.status)}>
              {t(statusLabel(calisma.status))}
            </span>
            {[t(projectTypeLabel(calisma.project_type)), calisma.university].filter(Boolean).join(" · ")}
          </span>
          <h2>{calisma.title}</h2>
          <span className="personel-ogrenci">
            <UserRound size={14} aria-hidden="true" />
            {sahipAdi ?? t({ tr: "Öğrenci adı görünmüyor", en: "Student name not visible" })}
          </span>
        </div>
        <div className="calisma-durum-eylemler">
          <Link href={merkez} className="projects-primary-button button-compact">
            <LayoutDashboard size={15} aria-hidden="true" />
            {t({ tr: "Çalışma özeti", en: "Work overview" })}
          </Link>
          <Link href={`${merkez}/write`} className="projects-filter-button button-compact">
            <PenLine size={15} aria-hidden="true" />
            {t({ tr: "Metni aç", en: "Open text" })}
          </Link>
          {takvim && takvim.length ? (
            <TezTakvimiPenceresi
              projectId={calisma.id}
              projeTuru={calisma.project_type}
              taslar={takvim}
              teslimTarihi={calisma.due_date ?? null}
              bugun={bugun}
              duzenleyebilir={false}
            />
          ) : null}
          <details className="kart-menu">
            <summary aria-label={t({ tr: `${calisma.title}: diğer işlemler`, en: `${calisma.title}: more actions` })}>
              <MoreHorizontal size={18} aria-hidden="true" />
            </summary>
            <div className="kart-menu-liste">
              <Link href={`${merkez}/edit`}>
                <Pencil size={15} aria-hidden="true" />
                {t({ tr: "Bilgileri düzenle", en: "Edit details" })}
              </Link>
              <Link href={`/dashboard/documents?calisma=${calisma.id}`}>
                <Upload size={15} aria-hidden="true" />
                {t({ tr: "Belge yükle", en: "Upload document" })}
              </Link>
              {silebilir ? <DeleteProjectButton projectId={calisma.id} projectTitle={calisma.title} /> : null}
            </div>
          </details>
        </div>
      </header>

      <dl className="tez-olcumler calisma-olcumler">
        <div className="tez-olcu">
          <dt>{t({ tr: "Yazılan", en: "Written" })}</dt>
          <dd>
            {(yazim?.words ?? 0).toLocaleString(YEREL[dil])}
            <small>{t({ tr: "kelime", en: "words" })}</small>
          </dd>
          <span title={ilerleme?.ipucu}>
            {yazim
              ? t({
                  tr: `${editedAgo(yazim.updatedAt, simdi(), dil, saatDilimi)} düzenlendi`,
                  en: `Edited ${editedAgo(yazim.updatedAt, simdi(), dil, saatDilimi)}`,
                })
              : t({ tr: "Henüz yazılmadı", en: "Not written yet" })}
          </span>
        </div>
        <div className="tez-olcu" data-tone={ilerleme && ilerleme.yuzde >= 100 ? "success" : undefined}>
          <dt>{t({ tr: "İlerleme", en: "Progress" })}</dt>
          <dd>{ilerleme ? t({ tr: `%${ilerleme.yuzde}`, en: `${ilerleme.yuzde}%` }) : "—"}</dd>
          <span title={ilerleme?.ipucu}>{ilerleme ? ilerleme.etiket : t({ tr: "Hedef yok — kılavuz bağlı değil", en: "No target — no guideline linked" })}</span>
        </div>
        <div className="tez-olcu" data-tone={due?.tone}>
          <dt>{t({ tr: "Teslim", en: "Due" })}</dt>
          {due ? (
            <>
              <dd>
                {Math.abs(due.days)}
                <small>{due.days < 0 ? t({ tr: "gün gecikti", en: "days overdue" }) : t({ tr: "gün", en: "days" })}</small>
              </dd>
              <span>{calisma.due_date ? tarih(calisma.due_date) : due.label}</span>
            </>
          ) : (
            <>
              <dd>—</dd>
              <span>{calisma.due_date ? tarih(calisma.due_date) : t({ tr: "Tarih belirtilmedi", en: "No date set" })}</span>
            </>
          )}
        </div>
      </dl>

      {siradakiKilometre ? (
        <p className="takvim-sirada" data-durum={siradakiKilometre.durum}>
          <span>{t({ tr: "Öğrencinin sıradaki taşı", en: "Student's next milestone" })}</span>
          <b>{siradakiKilometre.tas.baslik}</b>
          <small>
            {tarih(siradakiKilometre.tas.hedef_tarih)} · {kalanMetni(siradakiKilometre.durum, siradakiKilometre.kalanGun, dil)}
            {takvimSayilari
              ? t({
                  tr: ` · takvim ${takvimSayilari.tamam}/${takvimSayilari.toplam}${takvimSayilari.geciken ? `, ${takvimSayilari.geciken} geciken` : ""}`,
                  en: ` · schedule ${takvimSayilari.tamam}/${takvimSayilari.toplam}${takvimSayilari.geciken ? `, ${takvimSayilari.geciken} overdue` : ""}`,
                })
              : ""}
          </small>
        </p>
      ) : null}

      {/* Dikkat isteyenler: yalnızca VAR olanlar listeleniyor; boşsa tek satır "temiz". */}
      <h3 className="calisma-durum-alt">{t({ tr: "Dikkat isteyenler", en: "Needs attention" })}</h3>
      <ul className="gb-liste">
        {acikYorum ? (
          <li>
            <Link href={`${merkez}/write`} className="gb-satir">
              <MessageSquare size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{t({ tr: `${acikYorum} açık yorum`, en: `${acikYorum} open comment${acikYorum === 1 ? "" : "s"}` })}</b>
                <small>{t({ tr: "Yanıt ya da düzeltme bekliyor", en: "Awaiting a reply or a fix" })}</small>
              </span>
              <span className="status-pill" data-tone="warning">{t({ tr: "Yorum", en: "Comment" })}</span>
            </Link>
          </li>
        ) : null}
        {tutarsizliklar.map((sorun, i) => (
          <li key={i}>
            <Link href={merkez} className="gb-satir" title={sorun.baslik}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{sorun.baslik}</b>
                <small>{t({ tr: "Metin ile literatür arasında; ayrıntı çalışma özetinde", en: "Between text and literature; details in the work overview" })}</small>
              </span>
              <span className="status-pill" data-tone="warning">{t({ tr: "Tutarsızlık", en: "Inconsistency" })}</span>
            </Link>
          </li>
        ))}
        {tempo?.perDay ? (
          <li className="gb-satir">
            <PenLine size={16} aria-hidden="true" />
            <span className="gb-satir-govde">
              <b>
                {t({
                  tr: `Günde ~${tempo.perDay.toLocaleString(YEREL[dil])} kelime gerekiyor`,
                  en: `~${tempo.perDay.toLocaleString(YEREL[dil])} words a day needed`,
                })}
              </b>
              <small>{tempo.detail}</small>
            </span>
            <span className="status-pill" data-tone={tempo.tone}>{t({ tr: "Tempo", en: "Pace" })}</span>
          </li>
        ) : null}
        {sonKontrol ? (
          <li>
            <Link href={`${merkez}/write`} className="gb-satir">
              <ClipboardCheck size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>
                  {t({ tr: "Son kılavuz kontrolü:", en: "Last guideline check:" })}{" "}
                  {sonKontrol.hata || sonKontrol.uyari || sonKontrol.eksik_bolum
                    ? [
                        sonKontrol.hata
                          ? t({ tr: `${sonKontrol.hata} hata`, en: `${sonKontrol.hata} error${sonKontrol.hata === 1 ? "" : "s"}` })
                          : null,
                        sonKontrol.uyari
                          ? t({ tr: `${sonKontrol.uyari} uyarı`, en: `${sonKontrol.uyari} warning${sonKontrol.uyari === 1 ? "" : "s"}` })
                          : null,
                        sonKontrol.eksik_bolum
                          ? t({
                              tr: `${sonKontrol.eksik_bolum} eksik bölüm`,
                              en: `${sonKontrol.eksik_bolum} missing section${sonKontrol.eksik_bolum === 1 ? "" : "s"}`,
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : t({ tr: "sorunsuz", en: "no issues" })}
                </b>
                <small>{tarihSaat(sonKontrol.created_at)}</small>
              </span>
              <span
                className="status-pill"
                data-tone={sonKontrol.hata ? "danger" : sonKontrol.uyari || sonKontrol.eksik_bolum ? "warning" : "success"}
              >
                {t({ tr: "Kontrol", en: "Check" })}
              </span>
            </Link>
          </li>
        ) : (
          <li className="gb-satir">
            <ClipboardCheck size={16} aria-hidden="true" />
            <span className="gb-satir-govde">
              <b>{t({ tr: "Kılavuz kontrolü hiç çalıştırılmadı", en: "Guideline check has never been run" })}</b>
              <small>
                {t({
                  tr: "Öğrenci editörde \"Kılavuz ve kaynakça kontrolü\"nü çalıştırınca burada görünür",
                  en: "Shows up here once the student runs \"Guideline and reference check\" in the editor",
                })}
              </small>
            </span>
          </li>
        )}
      </ul>

      <section className="personel-denetim" aria-label={t({ tr: "Denetim", en: "Oversight" })}>
        <h3 className="calisma-durum-alt">{t({ tr: "Denetim", en: "Oversight" })}</h3>
        {/* Durum satırı üstte; altında atama ve onay düğmeleri YAN YANA (27.10.2026). */}
        {onayli ? (
          <span className="tone-text personel-denetim-durum" data-tone="success">
            <ShieldCheck size={15} aria-hidden="true" />
            {t({ tr: "Kontrolör onayı", en: "Controller approval" })} · {tarihSaat(calisma.controller_approved_at!)}
          </span>
        ) : (
          <span className="muted text-sm">
            {calisma.status === "ready"
              ? t({ tr: "Teslime hazır; onayınızı bekliyor.", en: "Ready to submit; awaiting your approval." })
              : t({ tr: "Henüz kontrolör onayı yok.", en: "No controller approval yet." })}
          </span>
        )}
        <div className="personel-denetim-satir">
          <ActionForm action={ata} className="personel-ata" successMessage={t({ tr: "Sorumlu kaydedildi.", en: "Assignee saved." })}>
            <label className="personel-ata">
              <span className="muted text-sm">{t({ tr: "Sorumlu", en: "Assignee" })}</span>
              <select name="assigneeId" defaultValue={calisma.assignee_id ?? ""} aria-label={t({ tr: "Sorumlu personel", en: "Assigned staff" })} className="compact-select grow-select">
                {/* Personel listesi okunamadıysa "kimse yok" denmiyor:
                    yönetici atayacak kişi kalmadığını sanırdı. */}
                <option value="">
                  {personelOkunamadi
                    ? t({ tr: "Personel listesi okunamadı", en: "Staff list could not be loaded" })
                    : eskiSorumlu
                      ? t({ tr: `${calisma.assignee_name} (listede değil)`, en: `${calisma.assignee_name} (not in list)` })
                      : t({ tr: "Sorumlu atanmadı", en: "No assignee" })}
                </option>
                {personel.map((uye) => (
                  <option key={uye.id} value={uye.id}>
                    {uye.full_name || t({ tr: "İsimsiz personel", en: "Unnamed staff" })} · {t(ROLE_LABELS[uye.role])}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="projects-filter-button button-compact">
              <UserRound size={14} aria-hidden="true" />
              {t({ tr: "Ata", en: "Assign" })}
            </button>
          </ActionForm>
          {onayli ? (
            <ActionForm
              action={onayiGeriAl}
              /* Onayı iptal eden düğme, "onayla" ile aynı yerde dönüşümlü
                 çiziliyor: yanlış tıklama kolay, sonucu ağır. */
              confirmMessage={t({
                tr: `"${calisma.title}" çalışmasının kontrolör onayını geri almak istediğinize emin misiniz? Çalışma yeniden inceleme bekler duruma döner.`,
                en: `Are you sure you want to revoke the controller approval of "${calisma.title}"? The work goes back to awaiting review.`,
              })}
              successMessage={t({ tr: "Kontrolör onayı geri alındı.", en: "Controller approval revoked." })}
            >
              <button type="submit" className="projects-filter-button button-compact">
                <RotateCcw size={14} aria-hidden="true" />
                {t({ tr: "Onayı geri al", en: "Revoke approval" })}
              </button>
            </ActionForm>
          ) : (
            <ActionForm action={onayla} successMessage={t({ tr: "Çalışma kontrolör onayı aldı.", en: "The work received controller approval." })}>
              <button
                type="submit"
                className={calisma.status === "ready" ? "projects-primary-button button-compact" : "projects-filter-button button-compact"}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {t({ tr: "Kontrolör olarak onayla", en: "Approve as controller" })}
              </button>
            </ActionForm>
          )}
        </div>
      </section>
    </article>
  );
}
