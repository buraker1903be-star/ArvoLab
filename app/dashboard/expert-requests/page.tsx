import { listeBasarili } from "@/lib/liste-sonucu";
import type { ConsultancyRequest } from "@/app/actions/consultancy";
import type { AppSupportRequest } from "@/app/actions/support";
import { CheckCircle2, GraduationCap, HandHelping, LifeBuoy, MessageSquareHeart, Send, XCircle } from "lucide-react";
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
  answerSupportRequest,
  updateSupportRequestStatus,
} from "@/app/actions/support";
import { tumGeriBildirimler, type GeriBildirimSatiri } from "@/app/actions/geri-bildirim";
import { getMyProjects } from "@/app/actions/citation-check";
import { getCurrentProfile } from "@/app/actions/profile";
import { bolumEtiketi, BAGLAM_METNI, PUAN_ETIKETLERI } from "@/lib/geri-bildirim";
import { isExpertEligible, requestTypeLabel, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { statusTone } from "@/lib/status-tone";
import { trTarihSaat } from "@/lib/tr-time";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import PartnerSeridi from "../_components/partner-seridi";

/*
  DESTEK — TEK SAYFA, İKİ EŞİT KART (26.10.2026, Kaynaklar'la aynı karar:
  dock'tan girince iki sekme çıkmasın).

  Eskiden iki ayrı sayfaydı (Uzman Desteği, Uygulama Desteği) ve her
  biri "bu sayfa öteki değildir" diye açıklama yazıyordu: öğrenci
  sorusunu nereye soracağını sayfaya girdikten sonra öğreniyordu. Şimdi
  ikisi yan yana: solda akademik soru (uzmana), sağda uygulama sorunu
  (bize); her kartta kendi talepleri ve yanıtları.

  Personelin kuyrukları (açık uzman talepleri, bana atananlar, bütün
  destek talepleri, kullanım geri bildirimleri) başlıktaki pencerelerde:
  öğrencinin gördüğü iki kartı kalabalıklaştırmasınlar.

  /dashboard/support buraya yönleniyor.
*/

const UZMAN_DURUMU: Record<string, string> = {
  open: "Açık",
  accepted: "Üstlenildi",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};

const DESTEK_DURUMU: Record<string, string> = {
  open: "Açık",
  in_progress: "İşleme alındı",
  resolved: "Çözüldü",
};

const KATEGORI: Record<string, string> = {
  bug: "Hata bildirimi",
  access: "Erişim sorunu",
  feature_request: "Özellik talebi",
  billing: "Fatura/Ödeme",
  other: "Diğer",
};

const ONCELIK: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

export default async function DestekPage() {
  const profile = await getCurrentProfile();
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
  // Geri bildirimleri Akademik Yönetici de okur (app/actions/geri-bildirim.ts);
  // destek kuyruğu yalnızca Sistem Yöneticisi ve Kurucu'nun işi.
  const yonetim = yonetici || (gorunum.personel && profile?.role === "academic_manager");

  const [
    { satirlar: calismalar },
    { satirlar: uzmanTaleplerim, okunamadi: uzmanOkunamadi },
    { satirlar: destekTaleplerim, okunamadi: destekOkunamadi },
    { satirlar: acikTalepler },
    { satirlar: banaAtananlar },
    { satirlar: tumDestek },
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

  const puanOrtalamasi = geriBildirimler.length
    ? geriBildirimler.reduce((toplam, satir) => toplam + (satir.score ?? 0), 0) / geriBildirimler.length
    : null;

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
  async function durumDegistir(id: string, durum: string) {
    "use server";
    return updateSupportRequestStatus(id, durum);
  }
  async function yanitla(id: string, formData: FormData) {
    "use server";
    return answerSupportRequest(id, formData);
  }

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Destek</h1>
          <p>Akademik bir konuda takıldıysanız uzmana, uygulamayla ilgili bir sorununuz varsa bize yazın.</p>
        </div>
        {uzman || yonetici || yonetim ? (
          <div className="pencere-dugmeler">
            {uzman ? (
              <PanelDrawer
                triggerLabel={acikTalepler.length + banaAtananlar.length ? `Uzman kuyruğu · ${acikTalepler.length + banaAtananlar.length}` : "Uzman kuyruğu"}
                triggerIcon={<HandHelping size={15} aria-hidden="true" />}
                triggerClassName="projects-filter-button button-compact"
                kicker="Uzman"
                title="Uzman talepleri"
                description="Açık talepleri üstlenin; size atananları tamamlayınca işaretleyin."
                boy="tam"
                basaridaKapan={false}
              >
                <div className="pencere-iki-kart destek-kuyruk">
                  <section className="pencere-kart">
                    <h3 className="pencere-kart-baslik">Açık talepler · {acikTalepler.length}</h3>
                    {acikTalepler.length ? (
                      <ul className="kanit-kayitlari">
                        {acikTalepler.map((r) => (
                          <li key={r.id} className="yapilacak-satir">
                            <span className="kanit-kayit-govde">
                              <b>{r.project_title || "Bağımsız talep"}</b>
                              <small>
                                {requestTypeLabel(r.request_type)} · {r.message || "Ek mesaj yok"}
                              </small>
                            </span>
                            <ActionForm action={ustlen.bind(null, r.id)} successMessage="Talebi üstlendiniz.">
                              <button type="submit" className="projects-primary-button button-compact">
                                <CheckCircle2 size={14} aria-hidden="true" /> Üstlen
                              </button>
                            </ActionForm>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="gb-bos">Şu an üstlenebileceğiniz açık talep yok.</p>
                    )}
                  </section>
                  <section className="pencere-kart">
                    <h3 className="pencere-kart-baslik">Bana atananlar · {banaAtananlar.length}</h3>
                    {banaAtananlar.length ? (
                      <ul className="kanit-kayitlari">
                        {banaAtananlar.map((r) => (
                          <li key={r.id} className="yapilacak-satir">
                            <span className="kanit-kayit-govde">
                              <b>{r.project_title || "Bağımsız talep"}</b>
                              <small>
                                {requestTypeLabel(r.request_type)} · {r.message || "Ek mesaj yok"}
                              </small>
                            </span>
                            <span className="status-pill" data-tone={statusTone(r.status)}>
                              {UZMAN_DURUMU[r.status]}
                            </span>
                            {r.status === "accepted" ? (
                              <ActionForm action={tamamla.bind(null, r.id)} successMessage="Talep tamamlandı.">
                                <button type="submit" className="projects-filter-button button-compact">
                                  Tamamlandı
                                </button>
                              </ActionForm>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="gb-bos">Üzerinize atanmış talep yok.</p>
                    )}
                  </section>
                </div>
              </PanelDrawer>
            ) : null}

            {yonetici ? (
              <PanelDrawer
                triggerLabel={tumDestek.length ? `Destek kuyruğu · ${tumDestek.length}` : "Destek kuyruğu"}
                triggerIcon={<LifeBuoy size={15} aria-hidden="true" />}
                triggerClassName="projects-filter-button button-compact"
                kicker="Sistem yöneticisi"
                title="Uygulama destek talepleri"
                description="Durum değişikliği kullanıcıya bir şey anlatmaz; çözdüğünüzde ne yaptığınızı yanıt olarak yazın."
                boy="genis"
                basaridaKapan={false}
              >
                {tumDestek.length ? (
                  <ul className="kanit-kayitlari">
                    {tumDestek.map((r) => (
                      <li key={r.id}>
                        <details className="kanit-kayit">
                          <summary>
                            <span className="kanit-kayit-govde">
                              <b>{r.subject}</b>
                              <small>
                                {KATEGORI[r.category]} · {ONCELIK[r.priority] ?? r.priority} öncelik · {trTarihSaat(r.created_at)}
                              </small>
                            </span>
                            <span className="status-pill" data-tone={statusTone(r.status)}>
                              {DESTEK_DURUMU[r.status]}
                            </span>
                          </summary>
                          <div className="kanit-kayit-ic">
                            <p className="destek-mesaj">{r.message}</p>
                            {r.status === "open" ? (
                              <ActionForm action={durumDegistir.bind(null, r.id, "in_progress")} successMessage="Talep işleme alındı.">
                                <button type="submit" className="projects-filter-button button-compact">
                                  İşleme al
                                </button>
                              </ActionForm>
                            ) : null}
                            <ActionForm className="project-form-grid mt-sm" action={yanitla.bind(null, r.id)} successMessage="Yanıt gönderildi.">
                              <label className="project-form-full">
                                <span>{r.admin_note ? "Yanıtı güncelle" : "Kullanıcıya yanıt"}</span>
                                <textarea name="admin_note" rows={2} maxLength={4000} defaultValue={r.admin_note ?? ""} required />
                              </label>
                              <input type="hidden" name="status" value="resolved" />
                              <div className="project-form-actions project-form-full">
                                <button type="submit" className="projects-primary-button button-compact">
                                  Yanıtla ve çözüldü işaretle
                                </button>
                              </div>
                            </ActionForm>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="gb-bos">Sistemde açık destek talebi yok.</p>
                )}
              </PanelDrawer>
            ) : null}

            {yonetim ? (
              <PanelDrawer
                triggerLabel="Geri bildirimler"
                triggerIcon={<MessageSquareHeart size={15} aria-hidden="true" />}
                triggerClassName="projects-filter-button button-compact"
                kicker="Yönetim"
                title="Kullanım geri bildirimleri"
                description={
                  /* Okunamayan listeden ortalama çıkarmak, gerçek olmayan bir memnuniyet puanı göstermek olurdu. */
                  puanOrtalamasi && !geriBildirimOkunamadi
                    ? `Ortalama ${puanOrtalamasi.toFixed(1)} / 5. Soru, kullanıcı sistemi gerçekten kullandıktan sonra ana sayfasında bir kez sorulur.`
                    : "Soru, kullanıcı sistemi gerçekten kullandıktan sonra ana sayfasında bir kez sorulur."
                }
                boy="genis"
                basaridaKapan={false}
              >
                {geriBildirimOkunamadi ? (
                  <p className="alert" role="alert">
                    Geri bildirimler okunamadı. Hiç cevap gelmediği anlamına gelmez — sayfayı yenileyin.
                  </p>
                ) : geriBildirimler.length === 0 ? (
                  <p className="gb-bos">Henüz geri bildirim gelmedi.</p>
                ) : (
                  <ul className="geri-bildirim-listesi">
                    {geriBildirimler.map((satir) => (
                      <li className="geri-bildirim-satiri" key={satir.userId}>
                        <div className="geri-bildirim-satiri-bas">
                          <strong>{satir.ad}</strong>
                          <span
                            className="status-pill"
                            data-tone={satir.score && satir.score >= 4 ? "success" : satir.score && satir.score <= 2 ? "danger" : "neutral"}
                          >
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
              </PanelDrawer>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="gb-sutunlar kaynaklar-ikili" aria-label="Destek">
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Uzman desteği</h2>
              <p>Yöntem, analiz, istatistik ya da yazım konusunda akademik danışmanlık.</p>
            </div>
            <PanelDrawer
              triggerLabel="Uzmana sor"
              triggerIcon={<GraduationCap size={15} aria-hidden="true" />}
              triggerClassName="projects-primary-button button-compact"
              kicker="Uzman desteği"
              title="Uzmana sorun"
              description="Hangi konuda desteğe ihtiyacınız var, kısaca yazın. Talebiniz kurumunuzun uzmanına, kurumunuz yoksa ArvoLab ekibine iletilir."
            >
              <ActionForm className="project-form-grid" action={createConsultancyRequest} successMessage="Talebiniz uzmanlara iletildi.">
                {calismalar.length > 0 ? (
                  <label>
                    <span>Çalışma</span>
                    <select name="projectId" defaultValue={calismalar[0].id}>
                      <option value="">Çalışmaya bağlı değil</option>
                      {calismalar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    <span>Çalışma başlığı (isteğe bağlı)</span>
                    <input name="projectTitle" type="text" placeholder="Örn. Eğitim Bilimleri Tezi" />
                  </label>
                )}
                <label>
                  <span>Konu</span>
                  <select name="requestType" defaultValue="analysis">
                    <option value="analysis">Analiz desteği</option>
                    <option value="statistics">İstatistik desteği</option>
                    <option value="methodology">Metodoloji danışmanlığı</option>
                    <option value="editing">Dil/biçim düzenleme</option>
                    <option value="full_review">Kapsamlı inceleme</option>
                    <option value="other">Diğer</option>
                  </select>
                </label>
                <label className="project-form-full">
                  <span>Mesajınız</span>
                  <textarea name="message" rows={4} placeholder="Nerede takıldığınızı kısaca anlatın" />
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <Send size={16} aria-hidden="true" /> Gönder
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          </header>

          {/* Okunamadı ile "talebiniz yok" ayrı: boş görünen öğrenci açık bir talebi yeniden açabilirdi. */}
          {uzmanOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              Talepleriniz yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.
            </p>
          ) : uzmanTaleplerim.length ? (
            <ul className="kanit-kayitlari">
              {uzmanTaleplerim.map((r) => (
                <li key={r.id}>
                  <details className="kanit-kayit">
                    <summary>
                      <span className="kanit-kayit-govde">
                        <b>{requestTypeLabel(r.request_type)}</b>
                        <small>
                          {r.project_title || "Çalışmaya bağlı değil"} · {trTarihSaat(r.created_at)}
                        </small>
                      </span>
                      <span className="status-pill" data-tone={statusTone(r.status)}>
                        {UZMAN_DURUMU[r.status]}
                      </span>
                    </summary>
                    <div className="kanit-kayit-ic">
                      <p className="destek-mesaj">{r.message || "Ek mesaj yazılmadı."}</p>
                      {r.status === "open" ? (
                        <ActionForm
                          action={iptal.bind(null, r.id)}
                          confirmMessage="Bu destek talebini iptal etmek istediğinize emin misiniz?"
                          successMessage="Talep iptal edildi."
                        >
                          <button type="submit" className="link-button">
                            <XCircle size={14} aria-hidden="true" /> Talebi iptal et
                          </button>
                        </ActionForm>
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <BosDurum
              kompakt
              ikon={GraduationCap}
              aciklama="Henüz uzman talebiniz yok. Yöntem, analiz ya da yazımda takıldığınızda “Uzmana sor” ile yazın."
            />
          )}
          <PartnerSeridi />
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Uygulama desteği</h2>
              <p>Hata, erişim, ödeme sorunu ya da bir özellik isteği.</p>
            </div>
            <PanelDrawer
              triggerLabel="Bize yaz"
              triggerIcon={<LifeBuoy size={15} aria-hidden="true" />}
              triggerClassName="projects-primary-button button-compact"
              kicker="Uygulama desteği"
              title="Bize yazın"
              description="Sorununuzu ya da isteğinizi kısaca anlatın; yanıtımız bu kartta görünür."
            >
              <ActionForm className="project-form-grid" action={createSupportRequest} successMessage="Destek talebiniz iletildi.">
                <label className="project-form-full">
                  <span>Konu</span>
                  <input name="subject" type="text" placeholder="Kısa bir başlık" required />
                </label>
                <label>
                  <span>Kategori</span>
                  <select name="category" defaultValue="other">
                    {Object.entries(KATEGORI).map(([deger, ad]) => (
                      <option key={deger} value={deger}>
                        {ad}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Öncelik</span>
                  <select name="priority" defaultValue="normal">
                    {Object.entries(ONCELIK).map(([deger, ad]) => (
                      <option key={deger} value={deger}>
                        {ad}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="project-form-full">
                  <span>Mesajınız</span>
                  <textarea name="message" rows={5} placeholder="Ne oldu, ne bekliyordunuz?" required />
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <Send size={16} aria-hidden="true" /> Gönder
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          </header>

          {destekOkunamadi ? (
            <p className="alert" data-tone="danger" role="alert">
              Talepleriniz yüklenemedi. Açık bir talebiniz olabilir; yeni talep açmadan önce sayfayı yenileyin.
            </p>
          ) : destekTaleplerim.length ? (
            <ul className="kanit-kayitlari">
              {destekTaleplerim.map((r) => (
                <li key={r.id}>
                  <details className="kanit-kayit" open={Boolean(r.admin_note)}>
                    <summary>
                      <span className="kanit-kayit-govde">
                        <b>{r.subject}</b>
                        <small>
                          {KATEGORI[r.category]} · {trTarihSaat(r.created_at)}
                        </small>
                      </span>
                      <span className="status-pill" data-tone={r.admin_note ? "success" : statusTone(r.status)}>
                        {r.admin_note ? "Yanıtlandı" : DESTEK_DURUMU[r.status]}
                      </span>
                    </summary>
                    <div className="kanit-kayit-ic">
                      {/* Kendi yazdığını da görsün: kullanıcı ne bildirdiğini hatırlamıyordu. */}
                      <p className="destek-mesaj">{r.message}</p>
                      {r.admin_note ? (
                        <div className="callout" data-tone="success">
                          <strong>Destek yanıtı</strong>
                          <p>{r.admin_note}</p>
                          {r.answered_at ? <p className="muted text-sm">{trTarihSaat(r.answered_at)}</p> : null}
                        </div>
                      ) : (
                        <p className="hint">Talebiniz alındı. Yanıtlandığında burada görünecek.</p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <BosDurum
              kompakt
              ikon={LifeBuoy}
              aciklama="Henüz destek talebiniz yok. Uygulamada bir sorun yaşarsanız ya da bir özellik isterseniz “Bize yaz” ile iletin."
            />
          )}
        </article>
      </section>
    </main>
  );
}
