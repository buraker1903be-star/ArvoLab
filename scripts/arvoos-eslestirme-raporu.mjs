// ESKİ KAYITLARIN ARVOOS'LA EŞLEŞTİRME RAPORU (L0) — SALT OKUNUR.
//
// tasarim/tek-deneyim/ENTEGRASYON-PLANI.md, G maddesi (karar K8) ve uygulama
// sırasındaki 0. iş. ArvoLab'daki eski kurum bağlarını, atamaları ve personel
// rollerini ArvoOS'un bildirdiğiyle karşılaştırır; sonucu CSV + özet olarak
// yazar. HİÇBİR SATIRI DEĞİŞTİRMEZ: dönüşüm plandaki kurala göre ancak kayıt
// kayıt onayla yapılır, bu betiğin işi değil.
//
// Salt okunurluğu kod sağlıyor: istemcinin fetch'i GET/HEAD dışındaki her
// isteği AĞA ÇIKMADAN reddediyor (saltOkunurFetch). Yanlışlıkla eklenmiş bir
// update/insert çağrısı tarama sırasında patlar, sessizce yazmaz.
//
// YALNIZCA YEREL YIĞIN. Adres 127.0.0.1/localhost değilse çalışmaz: servis
// anahtarıyla Production ya da paylaşılan Test'e bağlanmak ayrı bir karardır
// (P52b-2A kuralı, scripts/depo-envanteri.mjs ile aynı sınır). Uzak bir
// adresle koşmak için ARVOOS_ESLESTIRME_UZAK_ONAYI değişkeni, aşağıdaki
// metnin AYNISI olacak şekilde verilmeli — okuma bile olsa kasıtlı olsun.
//
//   SUPABASE_URL=http://127.0.0.1:54401 SUPABASE_SERVICE_ROLE_KEY=<yerel> \
//     node --import ./tests/register.mjs scripts/arvoos-eslestirme-raporu.mjs \
//       --cikti <depo DIŞI dizin> [--anlik <arvoos-anlik.json>]
//
// --anlik: ArvoOS'tan SALT OKUNUR alınmış üyelik anlık görüntüsü. Kalıcı bağın
// anahtarı ArvoOS'un kullanıcı kimliği (K6) ve o kimlik ArvoLab'a yansıtılan
// üye listesinde YOK; dosya verilmezse rapor yansıma listesiyle çalışır ve
// kimlik alanı boş kalır. Biçim:
//   { "kurumlar": ["<kurum kimliği>", ...],          // isteğe bağlı, kapsam beyanı
//     "uyeler": [ { "arvoos_user_id": "...", "email": "...", "organization_id": "..." } ] }
//
// ÇIKTI DEPO DIŞINA YAZILIR ve depoya girmez: satırlar e-posta ve kimlik
// taşıyor (onaylayan kişi kayıt kayıt bakacak). Ekrana yalnızca SAYI basılır.
import { existsSync, mkdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  atamaOnerileri,
  bagOzeti,
  bagRaporu,
  csv,
  epostaAnahtari,
  kapsananKurumlar as kapsamCikar,
  rolOnerileri,
} from "../lib/arvoos-eslestirme.ts";
import { yerelAdresMi } from "../lib/depo-envanteri.ts";

const require = createRequire(import.meta.url);
const SAYFA = 1000;
const UZAK_ONAY_METNI = "SALT OKUNUR UZAK OKUMA ONAYLANDI";

/*
  DEPO KÖKÜ BETİĞİN KONUMUNDAN (25.11.2026, incelemede çıkan P2).

  Eskiden depo sınırı `process.cwd()` ile ölçülüyordu. `cwd` ÇAĞIRANIN
  dizini, deponun kökü değil: `scripts/` içinden `--cikti ../gizli-rapor`
  verildiğinde hedef `<depo>/gizli-rapor` oluyor ama denetim `scripts/`'e
  göre baktığı için geçiyordu. Yani e-posta ve kimlik taşıyan rapor depo
  içine yazılabiliyordu — korumanın engellemek için var olduğu şeyin tam
  kendisi. Kök artık betiğin kendi yolundan hesaplanıyor; betik
  `<depo>/scripts/` içinde durduğu için kök onun üst dizini.
*/
const BETIK_DIZINI = dirname(fileURLToPath(import.meta.url));

/*
  HEDEFİN GERÇEK YOLU.

  İki şeyi birden karşılamak gerekiyor: hedef dizin HENÜZ YOK (rapor onu
  kendisi açacak) ve araya sembolik bağlantı girebilir. `realpathSync` tek
  başına ikisini de karşılamıyor — olmayan yolda düşüyor, kırık bağlantıda
  da düşüyor. Lexical bir karşılaştırma ise bağlantıyı hiç görmüyor:
  depo dışında görünen `/tmp/rapor` bağlantısı depo içini gösterebilir.

  Bu yüzden: var olan en yakın atayı realpath'liyoruz, kalan parçayı ona
  ekliyoruz, ve son parça BAĞLANTIYSA (hedefi kırık olsa bile) onu da
  çözüyoruz. Bağlantı döngüsünde derinlik sınırı kesiyor.
*/
export function gercekYol(yol, derinlik = 0) {
  const tam = resolve(yol);
  if (derinlik > 32) return tam;
  try {
    return realpathSync(tam);
  } catch {
    /* Yolun kendisi ya da bir parçası yok; aşağıda parça parça çözülüyor. */
  }
  const ust = dirname(tam);
  if (ust === tam) return tam;
  const birlesik = join(gercekYol(ust, derinlik + 1), basename(tam));
  try {
    const hedef = readlinkSync(birlesik);
    return gercekYol(isAbsolute(hedef) ? hedef : join(dirname(birlesik), hedef), derinlik + 1);
  } catch {
    /* Bağlantı değil (ya da yok): çözülmüş ata + son parça. */
    return birlesik;
  }
}

/** Gerçek yol depo kökünün İÇİNDE mi? Sınır `sep` ile: `<kök>-yedek` içinde değildir. */
export const depoIcinde = (hedefGercek, depoKoku) =>
  hedefGercek === depoKoku || hedefGercek.startsWith(depoKoku + sep);

/*
  Okuma dışındaki her istek ağa çıkmadan reddedilir. depo-envanteri'nin
  sarmalayıcısından DAHA DAR: orada Storage'ın listeleme ucu için bir POST
  istisnası var, bu rapor Storage'a hiç dokunmuyor, dolayısıyla istisnaya da
  gerek yok. Geniş olanı paylaşmak, ileride buraya eklenen bir POST'un
  sessizce geçmesi demekti.
*/
export function saltOkunurFetch(icFetch = fetch) {
  return async (url, secenek = {}) => {
    const yontem = (secenek.method ?? (url instanceof Request ? url.method : "GET")).toUpperCase();
    if (yontem !== "GET" && yontem !== "HEAD") {
      throw new Error(`eşleştirme raporu salt okunur: ${yontem} isteği reddedildi`);
    }
    return icFetch(url, secenek);
  };
}

/** Bütün sayfaları çeker; `.limit()` ile kesilmiş bir listeden sayı çıkarılmaz. */
async function tumSayfalar(sorgu, sira) {
  const hepsi = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await sorgu().order(sira).range(bas, bas + SAYFA - 1);
    if (error) throw new Error(`okuma düştü: ${error.message}`);
    hepsi.push(...(data ?? []));
    if (!data || data.length < SAYFA) return hepsi;
  }
}

/** auth.users PostgREST'ten okunamaz; yönetici ucu sayfa sayfa GET'le gelir. */
async function tumKullanicilar(sb) {
  const hepsi = [];
  for (let sayfa = 1; ; sayfa += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page: sayfa, perPage: SAYFA });
    if (error) throw new Error(`kullanıcı listesi düştü: ${error.message}`);
    const kullanicilar = data?.users ?? [];
    hepsi.push(...kullanicilar);
    if (kullanicilar.length < SAYFA) return hepsi;
  }
}

/** --anlik dosyasını ArvoosKaydi listesine çevirir. */
export function anlikOku(ham) {
  const veri = JSON.parse(ham);
  const uyeler = Array.isArray(veri) ? veri : veri?.uyeler;
  if (!Array.isArray(uyeler)) throw new Error("--anlik dosyasında 'uyeler' dizisi yok.");
  const kayitlar = uyeler
    .map((u) => ({
      arvoosUserId: u.arvoos_user_id ?? u.arvoosUserId ?? null,
      eposta: epostaAnahtari(u.email ?? u.eposta),
      kurum: u.organization_id ?? u.kurum ?? null,
    }))
    .filter((k) => k.eposta && k.kurum);
  /*
    KAPSAM BEYANI AYRI. Üyesi olmayan bir kurum anlık görüntüde satır
    üretmez; satırlardan çıkarılan kapsam o kurumu "veri yok" sayar ve
    hükmü "ölçülemedi" olur. Dosya kurumları açıkça sayarsa kapsam o
    listeden alınır ve üyesi kalmamış kurumun bağları "listede yok" olarak
    görünür — doğru olan da bu.
  */
  const beyan = Array.isArray(veri?.kurumlar) ? veri.kurumlar.filter((k) => typeof k === "string" && k) : null;
  return { kayitlar, kapsam: beyan ? new Set(beyan) : kapsamCikar(kayitlar) };
}

export async function topla(sb) {
  const profiller = await tumSayfalar(() => sb.from("profiles").select("id, organization_id, role"), "id");
  const kullanicilar = await tumKullanicilar(sb);
  const uyeler = await tumSayfalar(() => sb.from("arvoos_members").select("email, organization_id, synced_at"), "email");
  const atamalar = await tumSayfalar(
    () => sb.from("academic_projects").select("id, organization_id, assignee_id").not("assignee_id", "is", null),
    "id",
  );
  const kimlikler = new Map(kullanicilar.map((k) => [k.id, k]));
  return {
    profiller: profiller.map((p) => {
      const k = kimlikler.get(p.id);
      return {
        id: p.id,
        kurum: p.organization_id ?? null,
        eposta: epostaAnahtari(k?.email),
        epostaOnayli: !!k?.email_confirmed_at,
        rol: p.role,
      };
    }),
    yansima: uyeler.map((u) => ({ arvoosUserId: null, eposta: epostaAnahtari(u.email), kurum: u.organization_id })),
    atamalar: atamalar.map((a) => ({ proje: a.id, kurum: a.organization_id ?? null, atanan: a.assignee_id })),
  };
}

export function raporla({ profiller, atamalar }, { kayitlar, kapsam, kaynak }) {
  const baglar = bagRaporu(profiller, kayitlar, kapsam);
  return {
    baglar,
    atamalar: atamaOnerileri(atamalar, baglar),
    roller: rolOnerileri(profiller, baglar),
    ozet: bagOzeti(baglar),
    kaynak,
  };
}

function arguman(ad) {
  const i = process.argv.indexOf(`--${ad}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BAG_BASLIKLARI = ["profil", "kurum", "rol", "hukum", "sebep", "arvoosUserId", "baskaKurumdaDa"];
const ATAMA_BASLIKLARI = ["proje", "kurum", "atanan", "atananinBagi", "arvoosUserId"];
/* `bagi` sütunu: öneriyi onaylayan kişi kişinin kurum bağının doğrulanıp
   doğrulanmadığını satırda görmeli (atama tablosundaki `atananinBagi` gibi). */
const ROL_BASLIKLARI = ["profil", "kurum", "rol", "oneri", "bagi"];

const rolSayisi = (roller, oneri) => roller.filter((x) => x.oneri === oneri).length;

function ozetMetni(r, { url, kaynak }) {
  const o = r.ozet;
  const sebepler = Object.entries(o.sebepler)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `| ${s} | ${n} |`)
    .join("\n");
  return `# ArvoOS eşleştirme raporu (L0)

Kaynak: ${url} · ArvoOS tarafı: **${kaynak}** · ${new Date().toISOString()}

Bu rapor HÜKÜM verir, dönüşüm yapmaz. Dönüşüm kayıt kayıt onayla
(ENTEGRASYON-PLANI.md, G maddesi).

## Kurum bağları

| Hüküm | Sayı |
|---|---|
| doğrulanabilir | ${o.dogrulanabilir} |
| doğrulanamadı | ${o.dogrulanamadi} |
| **ölçülemedi** | ${o.olculemedi} |
| kapsam dışı | ${o.kapsamda_degil} |
| **toplam profil** | ${o.toplam} |

Aynı e-posta ArvoOS'ta başka bir kurumda da etkin: ${o.baskaKurumdaDa}

| Sebep | Sayı |
|---|---|
${sebepler}

**"Ölçülemedi" doğrulanamadı DEĞİLDİR.** O kurum için ArvoOS tarafı hiç satır
bildirmedi; üye listesi kurum lisansı kapanınca siliniyor, yani boş liste
"üye değil" demez. Bu satırların bağı KALDIRILMAZ; önce o kurumun listesi
yenilenir.

${kaynak === "yansıma listesi" ? `**Kimlik alanı boş:** yansıma listesinde ArvoOS kullanıcı kimliği yok. Kalıcı
bağ kimlikle kurulur (K6); kimliği olan rapor için \`--anlik\` dosyası verin.
Yansıma listesi ayrıca ESKİ olabilir (\`arvoos_members.synced_at\`).

` : ""}## Atama önerileri

Satır: ${r.atamalar.length}. Bunlar ÖNERİ: \`assignee_id\` ArvoLab'ın kendi
kavramı, ArvoOS iş atamasıyla ortak kimliği yok. Dayanağı atananın bağ hükmü;
bağı doğrulanmamış atama iş yetkisine çevrilmez.

## Rol önerileri

Satır: ${r.roller.length} · iş yetkisi önerisi ${rolSayisi(r.roller, "is_yetkisi")} ·
öneri yok ${rolSayisi(r.roller, "yok")} (kurumu olmayan personel: iş yetkisi
ArvoOS'taki bir kurumun işinden gelir).

Her satır \`bagi\` sütununda kişinin kurum bağı hükmünü taşıyor; bağı
doğrulanmamış bir personele iş yetkisi vermek, yanlış kişiye başkasının
çalışmasını açar. Bağı doğrulanmamış İŞ YETKİSİ önerisi:
${r.roller.filter((x) => x.oneri !== "yok" && x.bagi !== "dogrulanabilir").length}
(önerisi "yok" olan satırlar sayılmıyor: orada verilecek bir yetki yok).

Teknik yetki önerisi bugün YOK: Asistan Kayıtları kapısı yalnızca iç ekibe
açık (\`lib/ai/kayit-gorunum.ts\`), yani C maddesi geldiğinde taşınacak mevcut
bir hak yok.
`;
}

const dogrudanCalisti = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (dogrudanCalisti) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ciktiDizini = arguman("cikti");
  if (!url || !anahtar) {
    console.error("✗ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }
  if (!ciktiDizini) {
    console.error("✗ --cikti <dizin> gerekli (DEPO DIŞI: satırlar e-posta ve kimlik taşıyor).");
    process.exit(1);
  }
  const cikti = resolve(ciktiDizini);
  /*
    Çıktı depo içine yazılmaz. Rapor kişisel veri taşıyor ve depoya
    girmemeli; yanlışlıkla `git add .` ile commit'lenmesinin önüne geçen tek
    güvenilir yer burası (.gitignore bir dizin adını bilemez).

    Kök betiğin konumundan, hedef GERÇEK yoluyla karşılaştırılıyor; ikisi de
    dizin OLUŞTURULMADAN önce. Kökün kendisi de realpath'leniyor: deponun
    kendisine bir bağlantı üzerinden girilmiş olabilir ve o zaman iki yol
    metin olarak eşleşmezdi.
  */
  const depoKoku = gercekYol(dirname(BETIK_DIZINI));
  if (!existsSync(join(depoKoku, "package.json"))) {
    // Kökü bilemiyorsak koruma anlamsız: açık kalmasına izin vermek yerine duruyoruz.
    console.error(`✗ Depo kökü belirlenemedi (${depoKoku}); koruma doğrulanamadığı için durduruldu.`);
    process.exit(1);
  }
  const ciktiGercek = gercekYol(cikti);
  if (depoIcinde(ciktiGercek, depoKoku)) {
    console.error(`✗ --cikti depo içinde: ${ciktiGercek}. Rapor kişisel veri taşıyor, depo dışına yazın.`);
    process.exit(1);
  }
  if (!yerelAdresMi(url) && process.env.ARVOOS_ESLESTIRME_UZAK_ONAYI !== UZAK_ONAY_METNI) {
    console.error(
      `✗ Adres yerel değil. Servis anahtarıyla uzak okuma ayrı bir karardır: ARVOOS_ESLESTIRME_UZAK_ONAYI="${UZAK_ONAY_METNI}" verin.`,
    );
    process.exit(1);
  }

  const { createClient } = require("@supabase/supabase-js");
  const sb = createClient(url, anahtar, {
    global: { fetch: saltOkunurFetch() },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const veri = await topla(sb);
  const anlikYolu = arguman("anlik");
  const arvoos = anlikYolu
    ? { ...anlikOku(readFileSync(anlikYolu, "utf8")), kaynak: "anlık görüntü" }
    : { kayitlar: veri.yansima, kapsam: kapsamCikar(veri.yansima), kaynak: "yansıma listesi" };

  const r = raporla(veri, arvoos);
  mkdirSync(cikti, { recursive: true });
  writeFileSync(`${cikti}/kurum-baglari.csv`, csv(BAG_BASLIKLARI, r.baglar));
  writeFileSync(`${cikti}/atama-onerileri.csv`, csv(ATAMA_BASLIKLARI, r.atamalar));
  writeFileSync(`${cikti}/rol-onerileri.csv`, csv(ROL_BASLIKLARI, r.roller));
  writeFileSync(`${cikti}/OZET.md`, ozetMetni(r, { url, kaynak: arvoos.kaynak }));

  // Ekrana yalnızca sayı: e-posta, kimlik ve kurum adı basılmaz.
  const o = r.ozet;
  console.log(`✓ Eşleştirme raporu yazıldı: ${cikti}`);
  console.log(`  ArvoOS tarafı: ${arvoos.kaynak} · kapsanan kurum: ${arvoos.kapsam.size}`);
  console.log(`  Kurum bağı: ${o.toplam} profil · doğrulanabilir ${o.dogrulanabilir} · doğrulanamadı ${o.dogrulanamadi} · ölçülemedi ${o.olculemedi} · kapsam dışı ${o.kapsamda_degil}`);
  console.log(`  Atama önerisi: ${r.atamalar.length} · rol önerisi: ${r.roller.length}`);
}
