// Tek ana deneyim kabulü için YEREL, SENTETİK tohum (p52db, 127.0.0.1). Gerçek projeye bağlanmaz.
// İki kurum (A, B), dört hesap türü + kıyas için ikinci kurumda bir öğrenci:
//   kurucu (founder, kurumsuz), personel (controller, A), kurumlu öğrenci (client, A),
//   bireysel öğrenci (client, kurumsuz, aktif bireysel abonelik), B kurumunun öğrencisi (client, B).
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const KOK = process.env.KOK ?? process.cwd(); // depo kökü
const GECIT = "http://127.0.0.1:54401", SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const auth = async (yol, govde, yontem = "POST") => { const r = await fetch(`${GECIT}/auth/v1${yol}`, { method: yontem, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" }, body: JSON.stringify(govde) }); return r.json().catch(() => ({})); };
const SURUM = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const parola = `Td7!${crypto.randomBytes(9).toString("base64url")}`;
const ileri = new Date(Date.now() + 60 * 864e5).toISOString();

/*
  Kurumlar ArvoOS'tan YANSITILMIŞ gibi (synced_at dolu): lisans kapısı gerçekten çalışsın. synced_at boş
  kurum "henüz bildirilmedi" sayılıp her durumda açık kalırdı ve personel erişimi hiçbir şey ölçmezdi.
  K kurumunun lisansı KAPALI: oradaki personelin bireysel ödeme yerine kurum lisansı uyarısı görmesi beklenir.
*/
const kurum = (ad, durum = "active") => psql(`insert into public.organizations (name, license_status, current_period_end, synced_at) values (${q(ad)}, '${durum}', '${ileri}', now()) returning id`).split("\n")[0];
const A = kurum(`Kurum A ${ek}`), B = kurum(`Kurum B ${ek}`), K = kurum(`Kurum K ${ek}`, "inactive");

async function hesap(anahtar, ad, rol, org) {
  const adres = `tek-${anahtar}-${ek}@yerel.test`;
  const u = await auth("/admin/users", { email: adres, password: parola, email_confirm: true, user_metadata: { full_name: ad } });
  if (!u.id) throw new Error(`hesap açılamadı: ${anahtar} ${JSON.stringify(u)}`);
  // Yerel GoTrue açılışta verilen şifreyi yazmıyor (koşuda "geçersiz bilgi" alındı); ayrıca yazılır.
  await auth(`/admin/users/${u.id}`, { password: parola }, "PUT");
  psql(`update public.profiles set role = '${rol}', full_name = ${q(ad)}, organization_id = ${org ? `'${org}'` : "null"} where id = '${u.id}'`);
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi) values ('${u.id}','kullanim_sozlesmesi','${SURUM}','tr','${"0".repeat(64)}','giris',true)`);
  return { anahtar, adres, id: u.id, rol, org };
}
const calisma = (sahip, org, baslik, tur = "thesis") => {
  const id = psql(`insert into public.academic_projects (owner_id, organization_id, project_type, title, status) values ('${sahip}', ${org ? `'${org}'` : "null"}, '${tur}', ${q(baslik)}, 'writing') returning id`).split("\n")[0];
  const belge = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `${baslik}: giriş paragrafı, sentetik kabul verisi.` }] }] };
  psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count) values ('${id}', ${q(JSON.stringify(belge))}::jsonb, 'x', 8)`);
  return id;
};

const kurucu = await hesap("kurucu", "Deniz Kurucu", "founder", null);
const personel = await hesap("personel", "Ece Kontrolör", "controller", A);
const kurumlu = await hesap("kurumlu", "Arda Kurumlu", "client", A);
const bireysel = await hesap("bireysel", "Selin Bireysel", "client", null);
const digerKurum = await hesap("bkurumu", "Mert BKurumu", "client", B);
const kapali = await hesap("kapali", "Lale Kapalı", "employee", K);
psql(`insert into public.individual_subscriptions (user_id, status, current_period_end) values ('${bireysel.id}', 'active', '${ileri}') on conflict (user_id) do update set status = 'active', current_period_end = excluded.current_period_end`);

const C = {
  kurucu: calisma(kurucu.id, null, "Kurucunun kendi tezi"),
  personel: calisma(personel.id, A, "Personelin kendi makalesi", "article"),
  kurumlu: calisma(kurumlu.id, A, "Kurumlu öğrencinin tezi"),
  bireysel: calisma(bireysel.id, null, "Bireysel abonenin tezi"),
  bkurumu: calisma(digerKurum.id, B, "B kurumundaki öğrencinin tezi"),
  /* Doçentlik modülü kaldırıldıktan sonra da var olan doçentlik dosyası açılmalı. */
  docentlik: calisma(personel.id, A, "Personelin eski doçentlik dosyası", "associate-professorship"),
};
fs.writeFileSync(new URL("./tohum.json", import.meta.url), JSON.stringify({ parola, kurumlar: { A, B, K }, hesaplar: { kurucu, personel, kurumlu, bireysel, bkurumu: digerKurum, kapali }, calismalar: C }, null, 2));
console.log("tohum hazır", ek, Object.keys(C).length, "çalışma");
