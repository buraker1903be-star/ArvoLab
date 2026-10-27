import { listeBasarili } from "@/lib/liste-sonucu";
import type { ConsultancyRequest } from "@/app/actions/consultancy";
import type { AppSupportRequest } from "@/app/actions/support";
import Link from "next/link";
import { GraduationCap, Inbox, LifeBuoy, Send, XCircle } from "lucide-react";
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
  destek talepleri, kullanım geri bildirimleri) ayrı bir sekmede, tek
  ekranda (destek-kuyruklari.tsx, 26.10.2026). Eskiden başlıktaki üç
  açılır penceredeydiler; personel kendi taleplerini "Kendi taleplerim"
  sekmesinde, öğrencinin gördüğü iki kartla görüyor.

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

export default async function DestekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    { satirlar: acikTalepler },
    { satirlar: banaAtananlar },
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
          <h1>Destek</h1>
          <p>Akademik bir konuda takıldıysanız uzmana, uygulamayla ilgili bir sorununuz varsa bize yazın.</p>
        </div>
        {personel ? (
          <nav className="segment-secici" aria-label="Destek görünümü">
            <Link href={kuyrukAdresi(erisilebilir[0])} aria-current={!taleplerim ? "page" : undefined}>
              <Inbox size={15} aria-hidden="true" /> Kuyruklar
            </Link>
            <Link href={TALEPLERIM_ADRESI} aria-current={taleplerim ? "page" : undefined}>
              <LifeBuoy size={15} aria-hidden="true" /> Kendi taleplerim
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
              {uzmanTaleplerim.map((r) => {
                const mesajlar = uzmanYazismasi(r.id);
                const yeniYanit = yanitGeldi(mesajlar) && r.status === "accepted";
                const yazma = uzmanYazismaDurumu(r.status, "talep_sahibi");
                // Uzmanın adı yazışmadan: bireysel öğrenci iç ekip uzmanının profilini okuyamaz.
                const uzmanAdi = mesajlar.find((m) => m.taraf === "uzman")?.yazanAdi ?? null;
                return (
                <li key={r.id}>
                  <details className="kanit-kayit" open={yeniYanit}>
                    <summary>
                      <span className="kanit-kayit-govde">
                        <b>{requestTypeLabel(r.request_type)}</b>
                        <small>
                          {r.project_title || "Çalışmaya bağlı değil"} · {trTarihSaat(r.created_at)}
                        </small>
                      </span>
                      <span className="status-pill" data-tone={yeniYanit ? "success" : statusTone(r.status)}>
                        {yeniYanit ? "Yanıt var" : UZMAN_DURUMU[r.status]}
                      </span>
                    </summary>
                    <div className="kanit-kayit-ic">
                      <p className="destek-mesaj">{r.message || "Ek mesaj yazılmadı."}</p>
                      {r.status === "open" ? (
                        <p className="hint">Talebiniz bir uzmanın üstlenmesini bekliyor. Bu arada ek bilgi yazabilirsiniz.</p>
                      ) : r.status === "accepted" ? (
                        <p className="hint">{uzmanAdi ? `${uzmanAdi} talebinizi üstlendi.` : "Bir uzman talebinizi üstlendi."} Yazışma aşağıda.</p>
                      ) : null}
                      <Yazisma
                        mesajlar={mesajlar}
                        benimTarafim="talep_sahibi"
                        okunamadi={yazismaOkunamadi}
                        gonder={yazma.yazabilir ? destekMesajiGonder.bind(null, "uzman", r.id) : null}
                        kapaliNedeni={yazma.yazabilir ? undefined : yazma.neden}
                        yerTutucu="Uzmana yazın: ek bilgi, soru ya da dosyanın neresinde takıldığınız"
                      />
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
                );
              })}
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
                            {KATEGORI[r.category]} · {trTarihSaat(r.created_at)}
                          </small>
                        </span>
                        <span className="status-pill" data-tone={yanitlandi ? "success" : statusTone(r.status)}>
                          {r.status === "resolved" ? DESTEK_DURUMU.resolved : yanitlandi ? "Yanıtlandı" : DESTEK_DURUMU[r.status]}
                        </span>
                      </summary>
                      <div className="kanit-kayit-ic">
                        {/* Kendi yazdığını da görsün: kullanıcı ne bildirdiğini hatırlamıyordu. */}
                        <p className="destek-mesaj">{r.message}</p>
                        {!mesajlar.length ? <p className="hint">Talebiniz alındı. Yanıtlandığında burada görünecek.</p> : null}
                        {r.status === "resolved" ? (
                          <p className="hint">Talep çözüldü olarak işaretlendi. Sorun sürüyorsa yazın; talep yeniden açılır.</p>
                        ) : null}
                        <Yazisma
                          mesajlar={mesajlar}
                          benimTarafim="talep_sahibi"
                          okunamadi={yazismaOkunamadi}
                          gonder={destekMesajiGonder.bind(null, "destek", r.id)}
                          yerTutucu="Ek bilgi yazın ya da yanıta cevap verin"
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
              aciklama="Henüz destek talebiniz yok. Uygulamada bir sorun yaşarsanız ya da bir özellik isterseniz “Bize yaz” ile iletin."
            />
          )}
        </article>
      </section>
      )}
    </main>
  );
}
