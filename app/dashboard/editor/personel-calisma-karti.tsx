import Link from "next/link";
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
import DeleteProjectButton from "./delete-project-button";
import { createClient } from "@/lib/supabase/server";
import { projectTypeLabel, ROLE_LABELS, statusLabel, type UserRole } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import { trTarih, trTarihSaat } from "@/lib/tr-time";
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
  const merkez = `/dashboard/editor/${calisma.id}`;
  const onayli = !!calisma.controller_approved_at;
  // Eski kayıtlarda sorumlu yalnızca serbest metin olarak tutuluyordu (assignee_id boş).
  const eskiSorumlu = !calisma.assignee_id && calisma.assignee_name;

  /* Son kılavuz kontrolü: öğrenci kontrolü çalıştırdı mı, ne buldu. Okunamazsa satır çizilmiyor. */
  const supabase = await createClient();
  const { data: sonKontrol } = await supabase
    .from("yazim_kontrolleri")
    .select("created_at, hata, uyari, eksik_bolum")
    .eq("project_id", calisma.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <article className="gb-kart gb-sutun calisma-durum kayan-kart" aria-label={`${calisma.title}: durum`}>
      <header className="calisma-durum-bas">
        <div>
          <span className="calisma-durum-ust">
            <span className="status-pill" data-tone={statusTone(calisma.status)}>
              {statusLabel(calisma.status)}
            </span>
            {[projectTypeLabel(calisma.project_type), calisma.university].filter(Boolean).join(" · ")}
          </span>
          <h2>{calisma.title}</h2>
          <span className="personel-ogrenci">
            <UserRound size={14} aria-hidden="true" />
            {sahipAdi ?? "Öğrenci adı görünmüyor"}
          </span>
        </div>
        <div className="calisma-durum-eylemler">
          <Link href={merkez} className="projects-primary-button button-compact">
            <LayoutDashboard size={15} aria-hidden="true" />
            Çalışma özeti
          </Link>
          <Link href={`${merkez}/write`} className="projects-filter-button button-compact">
            <PenLine size={15} aria-hidden="true" />
            Metni aç
          </Link>
          <details className="kart-menu">
            <summary aria-label={`${calisma.title}: diğer işlemler`}>
              <MoreHorizontal size={18} aria-hidden="true" />
            </summary>
            <div className="kart-menu-liste">
              <Link href={`${merkez}/edit`}>
                <Pencil size={15} aria-hidden="true" />
                Bilgileri düzenle
              </Link>
              <Link href={`/dashboard/documents?calisma=${calisma.id}`}>
                <Upload size={15} aria-hidden="true" />
                Belge yükle
              </Link>
              {silebilir ? <DeleteProjectButton projectId={calisma.id} projectTitle={calisma.title} /> : null}
            </div>
          </details>
        </div>
      </header>

      <dl className="tez-olcumler calisma-olcumler">
        <div className="tez-olcu">
          <dt>Yazılan</dt>
          <dd>
            {(yazim?.words ?? 0).toLocaleString("tr-TR")}
            <small>kelime</small>
          </dd>
          <span title={ilerleme?.ipucu}>
            {yazim ? `${editedAgo(yazim.updatedAt)} düzenlendi` : "Henüz yazılmadı"}
          </span>
        </div>
        <div className="tez-olcu" data-tone={ilerleme && ilerleme.yuzde >= 100 ? "success" : undefined}>
          <dt>İlerleme</dt>
          <dd>{ilerleme ? `%${ilerleme.yuzde}` : "—"}</dd>
          <span title={ilerleme?.ipucu}>{ilerleme ? ilerleme.etiket : "Hedef yok — kılavuz bağlı değil"}</span>
        </div>
        <div className="tez-olcu" data-tone={due?.tone}>
          <dt>Teslim</dt>
          {due ? (
            <>
              <dd>
                {Math.abs(due.days)}
                <small>{due.days < 0 ? "gün gecikti" : "gün"}</small>
              </dd>
              <span>{calisma.due_date ? trTarih(calisma.due_date) : due.label}</span>
            </>
          ) : (
            <>
              <dd>—</dd>
              <span>{calisma.due_date ? trTarih(calisma.due_date) : "Tarih belirtilmedi"}</span>
            </>
          )}
        </div>
      </dl>

      {/* Dikkat isteyenler: yalnızca VAR olanlar listeleniyor; boşsa tek satır "temiz". */}
      <h3 className="calisma-durum-alt">Dikkat isteyenler</h3>
      <ul className="gb-liste">
        {acikYorum ? (
          <li>
            <Link href={`${merkez}/write`} className="gb-satir">
              <MessageSquare size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{acikYorum} açık yorum</b>
                <small>Yanıt ya da düzeltme bekliyor</small>
              </span>
              <span className="status-pill" data-tone="warning">Yorum</span>
            </Link>
          </li>
        ) : null}
        {tutarsizliklar.map((t, i) => (
          <li key={i}>
            <Link href={merkez} className="gb-satir" title={t.baslik}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{t.baslik}</b>
                <small>Metin ile literatür arasında; ayrıntı çalışma özetinde</small>
              </span>
              <span className="status-pill" data-tone="warning">Tutarsızlık</span>
            </Link>
          </li>
        ))}
        {tempo?.perDay ? (
          <li className="gb-satir">
            <PenLine size={16} aria-hidden="true" />
            <span className="gb-satir-govde">
              <b>Günde ~{tempo.perDay.toLocaleString("tr-TR")} kelime gerekiyor</b>
              <small>{tempo.detail}</small>
            </span>
            <span className="status-pill" data-tone={tempo.tone}>Tempo</span>
          </li>
        ) : null}
        {sonKontrol ? (
          <li>
            <Link href={`${merkez}/write`} className="gb-satir">
              <ClipboardCheck size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>
                  Son kılavuz kontrolü:{" "}
                  {sonKontrol.hata || sonKontrol.uyari || sonKontrol.eksik_bolum
                    ? [
                        sonKontrol.hata ? `${sonKontrol.hata} hata` : null,
                        sonKontrol.uyari ? `${sonKontrol.uyari} uyarı` : null,
                        sonKontrol.eksik_bolum ? `${sonKontrol.eksik_bolum} eksik bölüm` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "sorunsuz"}
                </b>
                <small>{trTarihSaat(sonKontrol.created_at)}</small>
              </span>
              <span
                className="status-pill"
                data-tone={sonKontrol.hata ? "danger" : sonKontrol.uyari || sonKontrol.eksik_bolum ? "warning" : "success"}
              >
                Kontrol
              </span>
            </Link>
          </li>
        ) : (
          <li className="gb-satir">
            <ClipboardCheck size={16} aria-hidden="true" />
            <span className="gb-satir-govde">
              <b>Kılavuz kontrolü hiç çalıştırılmadı</b>
              <small>Öğrenci editörde &quot;Kılavuz ve kaynakça kontrolü&quot;nü çalıştırınca burada görünür</small>
            </span>
          </li>
        )}
      </ul>

      <section className="personel-denetim" aria-label="Denetim">
        <h3 className="calisma-durum-alt">Denetim</h3>
        <div className="personel-denetim-satir">
          {onayli ? (
            <>
              <span className="tone-text" data-tone="success">
                <ShieldCheck size={15} aria-hidden="true" />
                Kontrolör onayı · {trTarihSaat(calisma.controller_approved_at!)}
              </span>
              <ActionForm
                action={onayiGeriAl}
                /* Onayı iptal eden düğme, "onayla" ile aynı yerde dönüşümlü
                   çiziliyor: yanlış tıklama kolay, sonucu ağır. */
                confirmMessage={`"${calisma.title}" çalışmasının kontrolör onayını geri almak istediğinize emin misiniz? Çalışma yeniden inceleme bekler duruma döner.`}
                successMessage="Kontrolör onayı geri alındı."
              >
                <button type="submit" className="projects-filter-button button-compact">
                  <RotateCcw size={14} aria-hidden="true" />
                  Onayı geri al
                </button>
              </ActionForm>
            </>
          ) : (
            <>
              <span className="muted text-sm">
                {calisma.status === "ready" ? "Teslime hazır; onayınızı bekliyor." : "Henüz kontrolör onayı yok."}
              </span>
              <ActionForm action={onayla} successMessage="Çalışma kontrolör onayı aldı.">
                <button
                  type="submit"
                  className={calisma.status === "ready" ? "projects-primary-button button-compact" : "projects-filter-button button-compact"}
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Kontrolör olarak onayla
                </button>
              </ActionForm>
            </>
          )}
        </div>
        <ActionForm action={ata} className="personel-denetim-satir" successMessage="Sorumlu kaydedildi.">
          <label className="personel-ata">
            <span className="muted text-sm">Sorumlu</span>
            <select name="assigneeId" defaultValue={calisma.assignee_id ?? ""} aria-label="Sorumlu personel" className="compact-select grow-select">
              {/* Personel listesi okunamadıysa "kimse yok" denmiyor:
                  yönetici atayacak kişi kalmadığını sanırdı. */}
              <option value="">
                {personelOkunamadi
                  ? "Personel listesi okunamadı"
                  : eskiSorumlu
                    ? `${calisma.assignee_name} (listede değil)`
                    : "Sorumlu atanmadı"}
              </option>
              {personel.map((uye) => (
                <option key={uye.id} value={uye.id}>
                  {uye.full_name || "İsimsiz personel"} · {ROLE_LABELS[uye.role]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="projects-filter-button button-compact">
            <UserRound size={14} aria-hidden="true" />
            Ata
          </button>
        </ActionForm>
      </section>
    </article>
  );
}
