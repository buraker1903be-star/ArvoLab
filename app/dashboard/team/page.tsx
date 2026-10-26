import Link from "next/link";
import { Ban, Building2, MailPlus, Plus, Search, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/profile";
import {
  createOrganization,
  getAllProfiles,
  getOrganizations,
  inviteUser,
  setUserAccess,
  updateUserOrganization,
  updateUserRole,
} from "@/app/actions/team";
import { ROLE_LABELS, type UserRole } from "@/lib/project-labels";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import EkipFiltreleri from "./ekip-filtreleri";
import { basHarfler, ekipAdresi, ekipFiltresiOku, ekipSayaclari, ekipSuz } from "@/lib/ekip-listesi";
import { trTarih, trTarihSaat } from "@/lib/tr-time";

const ROLE_ORDER: UserRole[] = [
  "client",
  "employee",
  "expert",
  "controller",
  "academic_manager",
  "system_admin",
  "founder",
];

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";

  if (!isAdmin) {
    return (
      <main className="dashboard-page">
        {/* Yetki reddi de ortak kalıpta: iki sayfada iki ayrı elle
            yazılmış blok vardı ve ikisinde de geri dönüş yolu yoktu —
            kullanıcı menüden başka bir yere tıklamak zorunda kalıyordu. */}
        <BosDurum
          ikon={ShieldAlert}
          baslik="Bu sayfa size kapalı"
          aciklama="Bu sayfaya yalnızca Sistem Yöneticisi ve Kurucu rolleri erişebilir."
          eylem={{ etiket: "Ana sayfaya dön", href: "/dashboard" }}
        />
      </main>
    );
  }

  const [{ members, directoryAvailable, okunamadi }, { satirlar: organizations }] = await Promise.all([getAllProfiles(), getOrganizations()]);
  const assignableRoles = profile?.role === "founder" ? ROLE_ORDER : ROLE_ORDER.filter((r) => r !== "founder");
  const kurumAdi = new Map(organizations.map((o) => [o.id, o.name]));

  // Arama, süzgeç, sayaçlar ve seçim adres satırında (lib/ekip-listesi.ts).
  const filtre = ekipFiltresiOku(params, ROLE_ORDER);
  const gorunen = ekipSuz(members, filtre);
  const sayaclar = ekipSayaclari(members, filtre);
  const istenen = typeof params.sec === "string" ? params.sec : null;
  const secili = gorunen.find((m) => m.id === istenen) ?? gorunen[0] ?? null;

  async function handleRoleChange(userId: string, formData: FormData) {
    "use server";
    const role = String(formData.get("role") ?? "");
    return updateUserRole(userId, role);
  }

  async function handleOrgChange(userId: string, formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organizationId") ?? "");
    return updateUserOrganization(userId, organizationId);
  }

  async function handleCreateOrganization(formData: FormData) {
    "use server";
    return createOrganization(formData);
  }

  async function handleInvite(formData: FormData) {
    "use server";
    return inviteUser(formData);
  }

  async function handleAccess(userId: string, enabled: boolean) {
    "use server";
    return setUserAccess(userId, enabled);
  }

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Ekip Yönetimi</h1>
          <p>
            Kullanıcıları davet edin, rollerini ve kurumlarını belirleyin. Davetsiz kayıt olanlar{" "}
            <strong>Üye / Öğrenci</strong> rolüyle başlar ve yalnızca kendi çalışmasını görür.
          </p>
        </div>
        <div className="cluster">
          <PanelDrawer
            triggerLabel="Kurum ekle"
            triggerIcon={<Building2 size={16} aria-hidden="true" />}
            triggerClassName="projects-filter-button"
            kicker="Ekip"
            title="Yeni kurum ekle"
            description="Kullanıcıları bir kuruma bağlamak için önce kurumu oluşturun."
          >
            <ActionForm className="project-form-grid" action={handleCreateOrganization} successMessage="Kurum eklendi.">
              <label className="project-form-full">
                <span>Kurum adı</span>
                <input name="name" type="text" placeholder="Örn. AkademikMerkez" required />
              </label>
              {organizations.length > 0 ? (
                <p className="hint project-form-full">Mevcut kurumlar: {organizations.map((o) => o.name).join(", ")}</p>
              ) : null}
              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" />
                  Kurumu ekle
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>

          {directoryAvailable ? (
            <PanelDrawer
              triggerLabel="Kullanıcı davet et"
              triggerIcon={<MailPlus size={16} aria-hidden="true" />}
              kicker="Ekip"
              title="Kullanıcı davet et"
              description="Davet edilen kişiye şifresini belirleyeceği bir bağlantı gönderilir. Rol ve kurum davetle birlikte atanır."
            >
              <ActionForm className="project-form-grid" action={handleInvite} successMessage="Davet e-postası gönderildi.">
                <label>
                  <span>E-posta</span>
                  <input name="email" type="email" placeholder="ornek@kurum.com" autoComplete="off" required />
                </label>
                <label>
                  <span>Ad soyad</span>
                  <input name="fullName" type="text" placeholder="Ayşe Demir" maxLength={120} />
                </label>
                <label>
                  <span>Rol</span>
                  <select name="role" defaultValue="employee">
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Kurum</span>
                  <select name="organizationId" defaultValue={profile?.organization_id ?? ""}>
                    <option value="">Kurum yok</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <MailPlus size={16} aria-hidden="true" />
                    Davet gönder
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          ) : null}
        </div>
      </section>

      {!directoryAvailable ? (
        <p className="alert" data-tone="warning" role="status">
          Davet, e-posta listesi ve erişim durdurma için sunucuda <code>SUPABASE_SECRET_KEY</code> ortam değişkeni
          tanımlı olmalı.
        </p>
      ) : null}

      {okunamadi ? (
        <section className="alert" data-tone="danger" role="alert">
          <strong>Kullanıcı listesi okunamadı.</strong>
          <p>Bu bir bağlantı ya da yetki arızası; kullanıcılar yerinde duruyor. Sayfayı yenileyin.</p>
        </section>
      ) : members.length === 0 ? (
        /* Eskiden liste boşken başlığın altı tamamen boş bir <div> kalıyordu. */
        <BosDurum
          ikon={UserCog}
          aciklama="Listelenecek kullanıcı yok. Yeni kullanıcılar davet edildiğinde ya da kayıt olduğunda burada görünür."
        />
      ) : (
        <>
          {/* Sayaçlar filtredir: sayı, basınca açılan listenin uzunluğu. */}
          <nav className="personel-sayaclar" aria-label="Kullanıcı durumları">
            {sayaclar.map((sayac) => (
              <Link
                key={sayac.durum}
                href={sayac.href}
                className="personel-sayac"
                data-tone={sayac.sayi ? sayac.ton : undefined}
                aria-current={sayac.secili ? "true" : undefined}
              >
                <b>{sayac.sayi}</b>
                <span>{sayac.etiket}</span>
              </Link>
            ))}
          </nav>

          <EkipFiltreleri
            key={JSON.stringify(filtre)}
            filtre={filtre}
            roller={ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            kurumlar={organizations}
          />

          {/*
            İKİ KART (26.10.2026): solda kullanıcılar, sağda seçili
            kullanıcının rolü, kurumu ve erişimi. Eskiden her kullanıcı
            üç formlu uzun bir karttı ve sayfa yüz kullanıcıda
            kilometrelerce kayıyordu.
          */}
          <section className="gb-sutunlar calismalar-ikili" aria-label="Kullanıcılar">
            <article className="gb-kart gb-sutun">
              <header className="gb-kart-bas">
                <div>
                  <h2>Kullanıcılar</h2>
                  <p>{gorunen.length === members.length ? `${members.length} kullanıcı` : `${gorunen.length}/${members.length} kullanıcı`}</p>
                </div>
              </header>
              {gorunen.length === 0 ? (
                <BosDurum
                  kompakt
                  ikon={Search}
                  aciklama="Süzgece uyan kullanıcı yok."
                  eylem={{ etiket: "Süzgeci temizle", href: "/dashboard/team" }}
                />
              ) : (
                <ul className="gb-liste calisma-secim">
                  {gorunen.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={ekipAdresi(filtre, m.id)}
                        className="gb-satir"
                        aria-current={m.id === secili?.id ? "true" : undefined}
                        scroll={false}
                      >
                        <span className="ekip-avatar" aria-hidden="true">
                          {basHarfler(m.full_name, m.email)}
                        </span>
                        <span className="gb-satir-govde">
                          <b>
                            {m.full_name || m.email || "İsimsiz kullanıcı"}
                            {m.id === profile?.id ? " (siz)" : ""}
                          </b>
                          <small>
                            {[ROLE_LABELS[m.role], m.organization_id ? kurumAdi.get(m.organization_id) : "Kurum yok", m.full_name ? m.email : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        {m.disabled ? (
                          <span className="status-pill" data-tone="danger">Durduruldu</span>
                        ) : m.pendingInvite ? (
                          <span className="status-pill" data-tone="warning">Davet</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {secili ? (
              <article className="gb-kart gb-sutun calisma-durum kayan-kart" aria-label={`${secili.full_name || secili.email || "Kullanıcı"}: ayrıntı`}>
                <header className="calisma-durum-bas">
                  <div className="ekip-kimlik">
                    <span className="ekip-avatar ekip-avatar-buyuk" aria-hidden="true">
                      {basHarfler(secili.full_name, secili.email)}
                    </span>
                    <div>
                      <span className="calisma-durum-ust">
                        <span className="status-pill" data-tone="neutral">{ROLE_LABELS[secili.role]}</span>
                        {secili.pendingInvite ? <span className="status-pill" data-tone="warning">Davet bekliyor</span> : null}
                        {secili.disabled ? <span className="status-pill" data-tone="danger">Erişim durduruldu</span> : null}
                      </span>
                      <h2>
                        {secili.full_name || "İsimsiz kullanıcı"}
                        {secili.id === profile?.id ? " (siz)" : ""}
                      </h2>
                      <span className="personel-ogrenci">{secili.email ?? <span className="mono">{secili.id}</span>}</span>
                    </div>
                  </div>
                </header>

                <dl className="tez-olcumler calisma-olcumler">
                  <div className="tez-olcu">
                    <dt>Kurum</dt>
                    <dd className="ekip-olcu-metin">{secili.organization_id ? kurumAdi.get(secili.organization_id) ?? "Bilinmeyen kurum" : "—"}</dd>
                    <span>{secili.organization_id ? "Bağlı" : "Kuruma bağlı değil"}</span>
                  </div>
                  <div className="tez-olcu">
                    <dt>Kayıt</dt>
                    <dd className="ekip-olcu-metin">{trTarih(secili.created_at)}</dd>
                    <span>{secili.pendingInvite ? "Davetle eklendi" : "Hesap açıldı"}</span>
                  </div>
                  <div className="tez-olcu">
                    <dt>Son giriş</dt>
                    <dd className="ekip-olcu-metin">{secili.lastSignInAt ? trTarih(secili.lastSignInAt) : "—"}</dd>
                    <span>
                      {secili.lastSignInAt
                        ? trTarihSaat(secili.lastSignInAt)
                        : directoryAvailable
                          ? "Hiç giriş yapmadı"
                          : "Dizin kapalı (sunucu anahtarı yok)"}
                    </span>
                  </div>
                </dl>

                <section className="personel-denetim" aria-label="Rol ve kurum">
                  <h3 className="calisma-durum-alt">Rol ve kurum</h3>
                  {secili.id === profile?.id ? (
                    <p className="muted text-sm">Kendi rolünüzü değiştiremezsiniz; başka bir yöneticiden isteyin.</p>
                  ) : null}
                  <ActionForm action={handleRoleChange.bind(null, secili.id)} className="personel-denetim-satir" successMessage="Rol kaydedildi.">
                    <label className="personel-ata">
                      <span className="muted text-sm">Rol</span>
                      <select name="role" defaultValue={secili.role} className="compact-select" disabled={secili.id === profile?.id} aria-label="Rol">
                        {/* Kurucu rolünü yalnızca kurucu atayabilir; mevcut rol listede kalmalı ki seçim bozulmasın. */}
                        {(assignableRoles.includes(secili.role) ? assignableRoles : [...assignableRoles, secili.role]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="projects-filter-button button-compact" disabled={secili.id === profile?.id}>
                      Rolü kaydet
                    </button>
                  </ActionForm>
                  {organizations.length > 0 ? (
                    <ActionForm action={handleOrgChange.bind(null, secili.id)} className="personel-denetim-satir" successMessage="Kurum kaydedildi.">
                      <label className="personel-ata">
                        <span className="muted text-sm">Kurum</span>
                        <select name="organizationId" defaultValue={secili.organization_id ?? ""} className="compact-select" aria-label="Kurum">
                          <option value="">Kurum yok</option>
                          {organizations.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="projects-filter-button button-compact">
                        Kurumu kaydet
                      </button>
                    </ActionForm>
                  ) : null}
                </section>

                {directoryAvailable && secili.id !== profile?.id ? (
                  <section className="personel-denetim ekip-erisim" data-tone={secili.disabled ? undefined : "danger"} aria-label="Erişim">
                    <h3 className="calisma-durum-alt">Erişim</h3>
                    <div className="personel-denetim-satir">
                      <span className="muted text-sm">
                        {secili.disabled
                          ? "Kullanıcı giriş yapamıyor. Erişimi açınca kaldığı yerden devam eder; verileri silinmedi."
                          : "Durdurulursa kullanıcı giriş yapamaz; açık oturumu en geç 1 saat içinde kapanır. Verileri silinmez."}
                      </span>
                      <ActionForm
                        action={handleAccess.bind(null, secili.id, secili.disabled)}
                        confirmMessage={
                          secili.disabled
                            ? `${secili.full_name || secili.email || "Bu kullanıcı"} için erişim yeniden açılsın mı?`
                            : `${secili.full_name || secili.email || "Bu kullanıcı"} için erişim durdurulsun mu? Kullanıcı giriş yapamaz; açık oturumu en geç 1 saat içinde kapanır.`
                        }
                        successMessage={secili.disabled ? "Erişim yeniden açıldı." : "Erişim durduruldu."}
                      >
                        <button type="submit" className={secili.disabled ? "button-success button-compact" : "button-danger button-compact"}>
                          {secili.disabled ? <ShieldCheck size={14} aria-hidden="true" /> : <Ban size={14} aria-hidden="true" />}
                          {secili.disabled ? "Erişimi aç" : "Erişimi durdur"}
                        </button>
                      </ActionForm>
                    </div>
                  </section>
                ) : null}
              </article>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
