import { redirect } from "next/navigation";
import { Cpu, KeyRound, Save, Sparkles, UserRound } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/project-labels";
import { aiKurulumu, aiYapilandirildi } from "@/lib/ai/saglayici";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { KREDI_SATIN_ALMA_ADRESI } from "@/lib/ai/kredi-karari";
import { changePassword } from "@/app/actions/auth";
import { updateMyProfile } from "@/app/actions/profile";
import ActionForm from "../action-form";
import PasswordForm from "./password-form";

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

  const icEkip = ctx.role !== null && ADMIN_ROLES.includes(ctx.role);
  const kurulum = icEkip ? aiKurulumu() : null;
  const sunucu = kurulum ? (() => { try { return new URL(kurulum.tabanUrl).host; } catch { return kurulum.tabanUrl; } })() : null;

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Hesap</span>
          <h1>Ayarlar</h1>
          <p>Profil bilgilerinizi ve şifrenizi buradan yönetin. Rol ve kurum değişiklikleri Sistem Yöneticisi tarafından yapılır.</p>
        </div>
      </section>

      <section className="project-form-card mb-lg">
        <div className="project-form-heading">
          <h2>
            <UserRound size={16} aria-hidden="true" />
            Profil
          </h2>
          <p>Ad soyadınız kapak sayfası ve ekip listesinde kullanılır.</p>
        </div>

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

        <ActionForm action={updateMyProfile} className="project-form-grid" successMessage="Profiliniz güncellendi.">
          <label>
            <span>Ad soyad</span>
            <input name="fullName" type="text" defaultValue={profile?.full_name ?? ""} minLength={2} maxLength={120} required />
          </label>
          <div className="project-form-actions">
            <button type="submit" className="projects-primary-button">
              <Save size={16} aria-hidden="true" />
              Kaydet
            </button>
          </div>
        </ActionForm>
      </section>

      <section className="project-form-card">
        <div className="project-form-heading">
          <h2>
            <KeyRound size={16} aria-hidden="true" />
            Şifre değiştir
          </h2>
          <p>En az 8 karakter. Şifrenizi değiştirdikten sonra diğer cihazlardaki oturumlarınız açık kalabilir.</p>
        </div>
        <PasswordForm action={changePassword} variant="panel" submitLabel="Şifreyi güncelle" />
      </section>

      {kredi.goster ? (
        <section className="project-form-card mt-lg">
          <div className="project-form-heading">
            <h2>
              <Sparkles size={16} aria-hidden="true" />
              Asistan krediniz
            </h2>
            <p>
              1 kredi = 1.000 karakter (sorduğunuz ve asistanın yanıtladığı metin birlikte).
              Aylık hak her ayın başında yenilenir ve devretmez; satın alınan bakiye yanmaz.
            </p>
          </div>
          <dl className="ai-kurulum">
            <div>
              <dt>Bu ay kalan</dt>
              <dd>{sayi(kredi.aylikKalan)} / {sayi(kredi.aylikLimit)} kredi</dd>
            </div>
            <div><dt>Satın alınan bakiye</dt><dd>{sayi(kredi.ekBakiye)} kredi</dd></div>
            <div><dt>Kullanılabilir</dt><dd>{sayi(kredi.toplam)} kredi</dd></div>
          </dl>
          {kredi.tukendi ? (
            <p className="tone-text" data-tone="danger">
              Krediniz bitti; asistan yeni çalışma yapmıyor. Aylık hak ayın başında yenilenir.
              Beklemek istemiyorsanız kurum yöneticiniz{" "}
              <a href={KREDI_SATIN_ALMA_ADRESI} target="_blank" rel="noreferrer noopener">ArvoOS panelinden</a>{" "}
              ek kredi satın alabilir.
            </p>
          ) : kredi.ekBakiye === 0 && kredi.oran >= 80 ? (
            <p className="tone-text" data-tone="warning">
              Aylık hakkınızın %{kredi.oran}&apos;i kullanıldı. Hak dolduğunda asistan durur; kurum
              yöneticiniz{" "}
              <a href={KREDI_SATIN_ALMA_ADRESI} target="_blank" rel="noreferrer noopener">ArvoOS panelinden</a>{" "}
              ek kredi satın alarak sürdürebilir.
            </p>
          ) : null}
        </section>
      ) : null}

      {icEkip && kurulum ? (
        <section className="project-form-card mt-lg">
          <div className="project-form-heading">
            <h2>
              <Cpu size={16} aria-hidden="true" />
              Asistan sunucusu
            </h2>
            <p>Yalnızca iç ekip görür. Değişken eklendikten sonra yeniden dağıtım gerekir; burada eski değer görünüyorsa dağıtım yapılmamıştır.</p>
          </div>
          <dl className="ai-kurulum">
            <div><dt>Sunucu</dt><dd>{sunucu}</dd></div>
            <div><dt>Model</dt><dd>{kurulum.model}</dd></div>
            <div>
              <dt>Anahtar</dt>
              <dd>{aiYapilandirildi() ? "tanımlı" : "tanımsız — asistan kapalı"}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
