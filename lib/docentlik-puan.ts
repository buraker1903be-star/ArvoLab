/*
  Doçentlik faaliyet kaydı DÜZENLENİRKEN birim puanın nereden geleceği.

  Kriter puanı değiştiğinde eski kayıtlar yeniden fiyatlanmaz; bu, ekranda
  kullanıcıya verilmiş bir söz ("Puan değişikliği yalnızca bundan sonra
  eklenen faaliyetlere uygulanır"). Düzenleme eklenince söz sessizce
  bozulabilirdi: başlıktaki bir yazım hatasını düzelten kullanıcının toplam
  puanı, kriterin bu arada değişmiş güncel puanıyla yeniden hesaplanırdı.

  Bu yüzden kriter AYNI kaldığı sürece birim puan kaydın kendisinden geri
  türetilir. Tabloda ayrı bir sütunu yok; computed_points = unit_count ×
  birim puan olarak yazıldığı için bölme onu geri verir.

  Kriter DEĞİŞTİYSE türetilmiş puanın anlamı kalmaz — kullanıcı artık başka
  bir faaliyet beyan ediyor — ve çağıran yeni kriterin güncel puanına bakar.
  null dönmesi "bilmiyorum, sen bak" demektir; 0 dönmek bunu sessizce
  "puansız faaliyet"e çevirirdi.
*/

export interface KayitliPuan {
  criteria_id: string;
  unit_count: number;
  computed_points: number;
}

/*
  Ondalık kayması birikmesin diye 6 haneye yuvarlanıyor: kriter puanları
  0.1 adımlı, ama 0.1 × 3 / 3 kayan noktada 0.10000000000000002 döner ve
  her düzenlemede bir hane daha kayardı.
*/
const YUVARLA = 1e6;

export function korunanBirimPuan(kayit: KayitliPuan, yeniKriterId: string): number | null {
  if (kayit.criteria_id !== yeniKriterId) return null;

  const birim = Number(kayit.unit_count);
  const puan = Number(kayit.computed_points);
  // Bozuk/eski satır (0 birim, sayı olmayan puan): türetmek yerine kritere sorulur.
  if (!Number.isFinite(birim) || birim <= 0 || !Number.isFinite(puan)) return null;

  return Math.round((puan / birim) * YUVARLA) / YUVARLA;
}
