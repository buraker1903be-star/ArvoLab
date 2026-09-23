import { listeBasarili } from "@/lib/liste-sonucu";
import type { AppSupportRequest } from "@/app/actions/support";
import { LifeBuoy, MessageSquareHeart, Plus } from "lucide-react";
import {
  createSupportRequest,
  getMySupportRequests,
  getAllSupportRequests,
  answerSupportRequest,
  updateSupportRequestStatus,
} from "@/app/actions/support";
import { getCurrentProfile } from "@/app/actions/profile";
import { tumGeriBildirimler, type GeriBildirimSatiri } from "@/app/actions/geri-bildirim";
import { bolumEtiketi, BAGLAM_METNI, PUAN_ETIKETLERI } from "@/lib/geri-bildirim";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import { statusTone } from "@/lib/status-tone";
import { trTarihSaat } from "@/lib/tr-time";
import BosDurum from "../_components/bos-durum";
import { Inbox } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Hata bildirimi",
  access: "Erişim sorunu",
  feature_request: "Özellik talebi",
  billing: "Fatura/Ödeme",
  other: "Diğer",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "İşleme alındı",
  resolved: "Çözüldü",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

export default async function SupportPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";
  // Geri bildirimleri Akademik Yönetici de okur (app/actions/geri-bildirim.ts);
  // talep kuyruğu ise yalnızca Sistem Yöneticisi ve Kurucu'nun işi.
  const isYonetim = isAdmin || profile?.role === "academic_manager";

  const [
    { satirlar: myRequests, okunamadi: taleplerOkunamadi },
    { satirlar: allRequests },
    { satirlar: geriBildirimler, okunamadi: geriBildirimOkunamadi },
  ] = await Promise.all([
    getMySupportRequests(),
    isAdmin ? getAllSupportRequests() : Promise.resolve(listeBasarili<AppSupportRequest>([])),
    isYonetim ? tumGeriBildirimler() : Promise.resolve(listeBasarili<GeriBildirimSatiri>([])),
  ]);

  const puanOrtalamasi = geriBildirimler.length
    ? geriBildirimler.reduce((toplam, satir) => toplam + (satir.score ?? 0), 0) / geriBildirimler.length
    : null;

  async function handleUpdateStatus(requestId: string, status: string) {
    "use server";
    return updateSupportRequestStatus(requestId, status);
  }

  async function handleAnswer(requestId: string, formData: FormData) {
    "use server";
    return answerSupportRequest(requestId, formData);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Destek</span>
          <h1>Uygulama Destek Talebi</h1>
          <p>
            ArvoLab uygulamasıyla ilgili bir hata, erişim sorunu ya da
            özellik talebiniz varsa buradan iletin. Bu, akademik danışmanlık
            talebi değildir — akademik destek için &quot;Uzman
            Desteği&quot; sayfasını kullanın.
          </p>
        </div>
        <PanelDrawer
          triggerLabel="Yeni talep"
          triggerIcon={<Plus size={16} aria-hidden="true" />}
          kicker="Destek"
          title="Yeni destek talebi"
          description="Sorununuzu veya talebinizi kısaca açıklayın."
        >
          <ActionForm className="project-form-grid" action={createSupportRequest} successMessage="Destek talebiniz iletildi.">
            <label className="project-form-full">
              <span>Konu</span>
              <input name="subject" type="text" placeholder="Kısa bir başlık" required />
            </label>

            <label>
              <span>Kategori</span>
              <select name="category" defaultValue="other">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Öncelik</span>
              <select name="priority" defaultValue="normal">
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="project-form-full">
              <span>Mesaj</span>
              <textarea name="message" rows={5} placeholder="Sorunu veya talebi detaylandırın" required />
            </label>

            <div className="project-form-actions">
              <button type="submit" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Talebi gönder
              </button>
            </div>
          </ActionForm>
        </PanelDrawer>
      </section>

      {isAdmin && (
        <section className="section">
          <h2 className="section-title">
            <LifeBuoy size={16} aria-hidden="true" />
            Tüm Açık Talepler (Sistem Yöneticisi görünümü)
          </h2>
          {/* Eskiden bölüm boşken tamamen gizleniyordu; yönetici böyle bir
              görünümün var olduğunu bilmiyordu. */}
          {allRequests.length === 0 ? (
            <BosDurum kompakt ikon={LifeBuoy} aciklama="Sistemde açık destek talebi yok. Bir kullanıcı talep açtığında burada listelenir." />
          ) : (
          <div className="projects-list">
            {allRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <div className="pill-row">
                      <span className="status-pill" data-tone={statusTone(r.status)}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <span className="status-pill" data-tone="neutral">
                        {CATEGORY_LABELS[r.category]}
                      </span>
                    </div>
                    <h2>{r.subject}</h2>
                    <p>{r.message}</p>
                  </div>
                </div>
                <div className="project-card-meta">
                  <span>Öncelik: {PRIORITY_LABELS[r.priority] ?? r.priority}</span>
                  <span>{trTarihSaat(r.created_at)}</span>
                </div>
                <div className="cluster mt-sm">
                  {r.status !== "in_progress" && (
                    <ActionForm action={handleUpdateStatus.bind(null, r.id, "in_progress")} successMessage="Talep işleme alındı.">
                      <button type="submit" className="projects-filter-button">İşleme al</button>
                    </ActionForm>
                  )}
                  {r.status !== "resolved" && (
                    <ActionForm action={handleUpdateStatus.bind(null, r.id, "resolved")} successMessage="Talep çözüldü olarak işaretlendi.">
                      <button type="submit" className="projects-primary-button">Çözüldü işaretle</button>
                    </ActionForm>
                  )}
                </div>

                {/* Yanıt: durum değişikliği kullanıcıya bir şey ANLATMIYOR.
                    "Çözüldü" etiketini gören kişi neyin nasıl çözüldüğünü
                    bilmiyordu. */}
                {r.admin_note ? (
                  <p className="tone-text mt-sm" data-tone="success">
                    Yanıtınız: {r.admin_note}
                  </p>
                ) : null}
                <ActionForm action={handleAnswer.bind(null, r.id)} className="mt-sm" successMessage="Yanıt gönderildi.">
                  <label className="project-form-full">
                    <span>{r.admin_note ? "Yanıtı güncelle" : "Kullanıcıya yanıt yaz"}</span>
                    <textarea name="admin_note" rows={2} maxLength={4000} defaultValue={r.admin_note ?? ""} required />
                  </label>
                  <input type="hidden" name="status" value="resolved" />
                  <button type="submit" className="projects-filter-button button-compact">
                    Yanıtla ve çözüldü işaretle
                  </button>
                </ActionForm>
              </article>
            ))}
          </div>
          )}
        </section>
      )}

      {isYonetim && (
        <section className="section">
          <h2 className="section-title">
            <MessageSquareHeart size={16} aria-hidden="true" />
            Kullanım geri bildirimleri
              {/* Okunamayan listeden ortalama çıkarmak, yöneticiye gerçek
                olmayan bir memnuniyet puanı göstermek olurdu. */}
            {puanOrtalamasi && !geriBildirimOkunamadi ? (
              <span className="status-pill" data-tone="info">Ortalama {puanOrtalamasi.toFixed(1)} / 5</span>
            ) : null}
          </h2>
          {geriBildirimOkunamadi ? (
            <p className="alert" role="alert">
              Geri bildirimler okunamadı. Hiç cevap gelmediği anlamına gelmez —
              ortalama puan da eksik hesaplanmış olabilir; sayfayı yenileyin.
            </p>
          ) : geriBildirimler.length === 0 ? (
            <BosDurum
              kompakt
              ikon={MessageSquareHeart}
              aciklama="Henüz geri bildirim gelmedi. Soru, kullanıcı sistemi gerçekten kullandıktan sonra ana sayfasında bir kez sorulur."
            />
          ) : (
            <ul className="geri-bildirim-listesi">
              {geriBildirimler.map((satir) => (
                <li className="geri-bildirim-satiri" key={satir.userId}>
                  <div className="geri-bildirim-satiri-bas">
                    <strong>{satir.ad}</strong>
                    <span className="status-pill" data-tone={satir.score && satir.score >= 4 ? "success" : satir.score && satir.score <= 2 ? "danger" : "neutral"}>
                      {satir.score} / 5 · {satir.score ? PUAN_ETIKETLERI[satir.score] : ""}
                    </span>
                  </div>
                  {satir.comment ? <p>{satir.comment}</p> : <p className="muted text-sm">Yorum yazılmadı.</p>}
                  <p className="muted text-sm">
                    En çok: {bolumEtiketi(satir.mostUsed)}
                    {satir.askedContext && BAGLAM_METNI[satir.askedContext] ? ` · ${BAGLAM_METNI[satir.askedContext]} soruldu` : ""}
                    {` · ${trTarihSaat(satir.updatedAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Taleplerim</h2>
        {/* Okunamadı ile "talebiniz yok" ayrı; ikincisi doğruysa sorun
            yok, birincisi kullanıcıya aynı sorunu ikinci kez
            bildirtirdi. */}
        {taleplerOkunamadi ? (
          <p className="alert" data-tone="danger" role="alert">
            Talepleriniz yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.
          </p>
        ) : myRequests.length === 0 ? (
          <BosDurum kompakt ikon={Inbox} aciklama="Henüz destek talebiniz yok. Uygulamada bir sorun yaşarsanız ya da bir özellik isterseniz yukarıdaki “Yeni talep” ile bize yazın." />
        ) : (
          <div className="projects-list">
            {myRequests.map((r) => (
              <article className="project-card" key={r.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill" data-tone={statusTone(r.status)}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <h2>{r.subject}</h2>
                    <p>{CATEGORY_LABELS[r.category]} · {trTarihSaat(r.created_at)}</p>
                    {/* Kendi yazdığını da görsün: eskiden yalnızca başlık
                        vardı, kullanıcı ne bildirdiğini hatırlamıyordu. */}
                    <p className="muted text-sm">{r.message}</p>
                    {r.admin_note ? (
                      <div className="callout mt-sm" data-tone="success">
                        <strong>Destek yanıtı</strong>
                        <p>{r.admin_note}</p>
                        {r.answered_at ? <p className="muted text-sm">{trTarihSaat(r.answered_at)}</p> : null}
                      </div>
                    ) : (
                      <p className="hint mt-sm">
                        Talebiniz alındı. Yanıtlandığında burada görünecek.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
