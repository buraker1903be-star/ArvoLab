import Link from "next/link";
import { redirect } from "next/navigation";
import { Cpu, Download, Keyboard, KeyRound, LogOut, Save, Sparkles, Trash2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { ADMIN_ROLES, ROLE_LABELS, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import PanelDrawer from "../_components/panel-drawer";
import { aiKurulumu, aiKurulumSorunu } from "@/lib/ai/saglayici";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { KREDI_SATIN_ALMA_ADRESI } from "@/lib/ai/kredi-karari";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import LicenseCard from "../_components/license-card";
import { changePassword, digerOturumlariKapat } from "@/app/actions/auth";
import { KisayolListesi } from "../editor/[id]/write/shortcuts-dialog";
import { updateMyProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";
import PasswordForm from "./password-form";
import HesapSilmeFormu from "./hesap-silme-formu";
import { hesapSilmeTalebi } from "@/app/actions/hesap";

export const metadata = { title: "Ayarlar" };

const sayi = (deger: number) => new Intl.NumberFormat("tr-TR").format(deger);

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.user.id)
    .maybeSingle();

  let organizationName: string | null = null;
  if (ctx.organizationId) {
    const { data: organization } = await ctx.supabase
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    organizationName = organization?.name ?? null;
  }

  /*
    Etkin asistan sunucusu. Ortam değişkenleri girildiği halde hangisinin
    kullanıldığı hiçbir yerde görünmüyordu: "Claude'a geçtim" denip
    isteklerin OpenAI'ye gitmeye devam ettiği bir gün yaşandı ve anlamanın
    tek yolu ai_assistant_runs tablosuna SQL atmaktı. Yeni bir değişken
    dağıtım olmadan etkili olmuyor; burası onu da görünür kılıyor.

    Yalnızca iç ekibe: müşteriye hangi modeli kullandığımız bilgisi
    verilmiyor (AGENTS.md: "Ürün arayüzünde sağlayıcının adı hiç geçmez").
    ANAHTAR GÖSTERİLMİYOR, yalnızca tanımlı olup olmadığı.
  */
  /*
    AI kredisi: kullanıcı durumu bugüne kadar yalnızca İKİ anda
    öğreniyordu — %80'de çalışmanın ortasında bir uyarıyla ya da hak
    bitince asistan durduğunda. İkisi de iş üstünde, ikisi de geç.
    Burada sakin sakin bakılabiliyor.

    ai_kredi_durumum() parametre almıyor; yalnızca çağıranın kendi
    kurumunun durumunu döndürüyor (ArvoLab migration 20260924100013).
    Okunamazsa kart hiç çizilmiyor: "0 kredi" yazmak, hakkı olmayanla
    ölçümü kopmuş olanı aynı göstermek olurdu.
  */
  const { data: krediSatiri, error: krediHatasi } = await ctx.supabase.rpc("ai_kredi_durumum").maybeSingle();
  if (krediHatasi) console.error("[ayarlar] kredi durumu okunamadı:", krediHatasi.message);
  const kredi = krediOzeti((krediSatiri as KrediSatiri | null) ?? null);
  const bireyselKredi = Boolean((krediSatiri as KrediSatiri | null)?.bireysel);

  /*
    Abonelik durumu bugüne kadar YALNIZCA ana sayfada duruyordu. Bireysel
    abone "planım ne, ne zaman bitiyor, nereden ödeyeceğim" sorusuyla
    Ayarlar'a geliyor ve orada aboneliğine dair tek satır bulamıyordu.
    Kart aynı kart (tek kaynak); ana sayfadan kaldırılmadı, çünkü orada
    süresi dolan kişiye ilk uyarıyı o veriyor.
  */
  const access = await getAccessState(await getCurrentProfile());

  const icEkip = ctx.role !== null && ADMIN_ROLES.includes(ctx.role);
  const kurulum = icEkip ? aiKurulumu() : null;
  const sunucu = kurulum ? (() => { try { return new URL(kurulum.tabanUrl).host; } catch { return kurulum.tabanUrl; } })() : null;

  /*
    TEK EKRAN, İKİ KART (26.10.2026, diğer modüllerle aynı düzen). Eskiden
    altı kart alt alta duruyordu; kredisine bakmaya gelen kullanıcı şifre
    ve hesap silme bölümlerinin arasından kaydırıyordu. Solda kim olduğu
    ve aboneliği, sağda hesabıyla yapabildikleri: her biri tek satır,
    işlemi pencerede. Geri dönüşü olmayan hesap silme yine en sonda.

    Asistan sunucusu bilgisi PERSONEL GÖRÜNÜMÜNDE: iç ekip öğrenci
    düzenini önizlerken görmemeli (lib/onizleme.ts).
  */
  const gorunum = await sayfaGorunumu({
    rol: ctx.role ?? undefined,
    personelRolu: ctx.role ? STAFF_ROLES.includes(ctx.role) : false,
    kurumVar: Boolean(ctx.organizationId),
  });

  /*
    Açıklama role göre. Eskiden herkese "Rol ve kurum değişiklikleri
    Sistem Yöneticisi tarafından yapılır" yazıyordu: bireysel öğrencinin
    ne rolü ne kurumu değişir, iç ekibe kendi işini anlatıyordu.
  */
  const aciklama = icEkip
    ? "Hesabınız ve kurulum bilgileri."
    : ctx.organizationId
      ? `Hesabınız ve güvenliğiniz. Rolünüz ve kurum bağınız ${organizationName ?? "kurumunuz"} tarafından belirlenir; değişiklik için kurum yöneticinize başvurun.`
      : "Hesabınız, aboneliğiniz ve verileriniz.";

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Ayarlar</h1>
          <p>{aciklama}</p>
        </div>
      </section>

      <section className="gb-sutunlar kaynaklar-ikili" aria-label="Ayarlar">
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Hesabım</h2>
              <p>Ad soyadınız kapak sayfasında ve ekip listesinde kullanılır.</p>
            </div>
          </header>

          <dl className="settings-facts">
            <div>
              <dt>E-posta</dt>
              <dd>{ctx.user.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{ctx.role ? ROLE_LABELS[ctx.role] : "—"}</dd>
            </div>
            <div>
              <dt>Kurum</dt>
              <dd>{organizationName ?? "Kuruma bağlı değil"}</dd>
            </div>
          </dl>

          <ActionForm action={updateMyProfile} className="ayar-ad-formu" successMessage="Profiliniz güncellendi.">
            <label>
              <span>Ad soyad</span>
              <input name="fullName" type="text" className="field-control" defaultValue={profile?.full_name ?? ""} minLength={2} maxLength={120} required />
            </label>
            <button type="submit" className="projects-primary-button button-compact">
              <Save size={15} aria-hidden="true" />
              Kaydet
            </button>
          </ActionForm>

          {/*
            Abonelik kartı ana sayfadakiyle aynı (tek kaynak). Bireysel abone
            "planım ne, ne zaman bitiyor, nereden ödeyeceğim" sorusuyla buraya
            geliyor.
          */}
          <LicenseCard access={access} />
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Güvenlik ve veriler</h2>
              <p>Şifreniz, verilerinizin bir kopyası ve asistan kullanımınız.</p>
            </div>
          </header>

          <ul className="ayar-listesi">
            <li className="ayar-satir">
              <KeyRound size={18} aria-hidden="true" />
              <span className="ayar-govde">
                <b>Şifre</b>
                <small>En az 8 karakter. Değiştirdikten sonra diğer cihazlardaki oturumları aşağıdan kapatabilirsiniz.</small>
              </span>
              <PanelDrawer
                triggerLabel="Değiştir"
                triggerClassName="projects-filter-button button-compact"
                kicker="Güvenlik"
                title="Şifrenizi değiştirin"
                description="Yeni şifreniz en az 8 karakter olmalı."
              >
                <PasswordForm action={changePassword} variant="panel" submitLabel="Şifreyi güncelle" />
              </PanelDrawer>
            </li>

            <li className="ayar-satir">
              <LogOut size={18} aria-hidden="true" />
              <span className="ayar-govde">
                <b>Diğer cihazlar</b>
                <small>Bu cihaz dışındaki bütün oturumları kapatır. Ortak bir bilgisayarda açık unuttuysanız ya da şifrenizi değiştirdiyseniz kullanın.</small>
              </span>
              <ActionForm action={digerOturumlariKapat} confirmMessage="Bu cihaz dışındaki bütün oturumlar kapatılsın mı?" successMessage="Diğer cihazlardaki oturumlar kapatıldı.">
                <button type="submit" className="projects-filter-button button-compact">Kapat</button>
              </ActionForm>
            </li>

            {/*
              Verinin taşınabilir olması hem KVKK'nın istediği bir hak hem güven
              meselesi. İndirme bir ROTA (sunucu eylemi değil): tez metinleri
              megabaytlarca olabiliyor ve sunucu eyleminin yanıt sınırı aşılamaz.
            */}
            <li className="ayar-satir">
              <Download size={18} aria-hidden="true" />
              <span className="ayar-govde">
                <b>Verilerim</b>
                <small>Çalışmalarınız, metinleriniz, kaynaklarınız ve denetim kayıtlarınız tek dosyada (JSON). Word çıktısı için editördeki dışa aktarmayı kullanın.</small>
              </span>
              <a className="projects-filter-button button-compact" href="/api/hesabim/verilerim" download>
                İndir
              </a>
            </li>

            {/*
              AI kredisi: kullanıcı durumu yalnızca %80 uyarısında ya da hak
              bitince öğreniyordu. Okunamazsa satır hiç çizilmiyor: "0 kredi"
              yazmak, hakkı olmayanla ölçümü kopmuş olanı aynı göstermek olurdu.
            */}
            {kredi.goster ? (
              <li className="ayar-satir">
                <Sparkles size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>Asistan krediniz</b>
                  <small>
                    Bu ay {sayi(kredi.aylikKalan)} / {sayi(kredi.aylikLimit)} kredi kaldı · satın alınan bakiye {sayi(kredi.ekBakiye)} ·
                    kullanılabilir {sayi(kredi.toplam)}. 1 kredi = 1.000 karakter; aylık hak ayın başında yenilenir, satın
                    alınan bakiye yanmaz.
                  </small>
                  {/* Bireysel abone krediyi Abonelik ve kredi sayfasından alır; kurum üyesi için yönetici ArvoOS'tan. */}
                  {kredi.tukendi || (kredi.ekBakiye === 0 && kredi.oran >= 80) ? (
                    <small className="tone-text" data-tone={kredi.tukendi ? "danger" : "warning"}>
                      {kredi.tukendi ? "Krediniz bitti; asistan yeni çalışma yapmıyor. " : `Aylık hakkınızın %${kredi.oran}'i kullanıldı. `}
                      {bireyselKredi ? (
                        <>Ek kredi için “Ayrıntı”ya gidin.</>
                      ) : (
                        <>
                          Kurum yöneticiniz{" "}
                          <a href={KREDI_SATIN_ALMA_ADRESI} target="_blank" rel="noreferrer noopener">ArvoOS panelinden</a> ek
                          kredi satın alabilir.
                        </>
                      )}
                    </small>
                  ) : null}
                </span>
                {/* Ayrıntı, paketler ve son hareketler Abonelik ve kredi sayfasında. */}
                <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
                  Ayrıntı
                </Link>
              </li>
            ) : null}

            {/*
              Kısayollar editörde Yardım menüsünde de var; burada da, çünkü
              kullanıcı "Word'deki tuş burada ne" sorusuyla Ayarlar'a
              geliyor. Liste editördekinin AYNISI (KisayolListesi).
            */}
            <li className="ayar-satir">
              <Keyboard size={18} aria-hidden="true" />
              <span className="ayar-govde">
                <b>Klavye kısayolları</b>
                <small>Editörde Word&apos;deki tuşlar aynı işi yapar: hizalama, punto, başlık, dipnot, girinti.</small>
              </span>
              <PanelDrawer
                triggerLabel="Göster"
                triggerClassName="projects-filter-button button-compact"
                kicker="Yardım"
                title="Klavye kısayolları"
                description="Word'deki tuşlar burada da aynı işi yapar. Fareye uzanmadan daha hızlı yazın."
              >
                <KisayolListesi />
              </PanelDrawer>
            </li>

            {/*
              Etkin asistan sunucusu: yalnızca iç ekip, personel görünümünde.
              Müşteriye hangi modeli kullandığımız söylenmez; ANAHTAR
              GÖSTERİLMİYOR, yalnızca durum. Durum yerine SEBEP yazılıyor:
              sorun anahtar değil adres de olabiliyor.
            */}
            {icEkip && gorunum.personel && kurulum ? (
              <li className="ayar-satir">
                <Cpu size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>Asistan sunucusu</b>
                  <small>
                    {sunucu} · {kurulum.model} · {aiKurulumSorunu() ?? "asistan açık"}. Değişken eklendikten sonra yeniden
                    dağıtım gerekir.
                  </small>
                </span>
              </li>
            ) : null}

            {/*
              HESAP SİLME EN SONDA ve iç ekibe gösterilmiyor (founder ya da
              system_admin hesabı kurulumu da yönetiyor; sunucu da reddediyor).
            */}
            {!icEkip ? (
              <li className="ayar-satir" data-tone="danger">
                <Trash2 size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>Hesabımı sil</b>
                  <small>Hesabınız ve bütün verileriniz kalıcı silinir. Silme hemen olmaz; vazgeçmek için süreniz olur.</small>
                </span>
                <PanelDrawer
                  triggerLabel="Sil"
                  triggerClassName="projects-filter-button button-compact button-danger"
                  kicker="Hesap"
                  title="Hesabımı sil"
                  description="Hesabınızı ve ArvoLab'daki bütün verilerinizi kalıcı olarak silme talebi. Silme hemen olmaz; vazgeçmek için süreniz olur."
                >
                  <HesapSilmeFormu action={hesapSilmeTalebi} eposta={ctx.user.email ?? ""} bireysel={access.kind === "individual"} />
                </PanelDrawer>
              </li>
            ) : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
