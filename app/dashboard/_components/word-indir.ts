/*
  Çalışmayı Word olarak indirir; hata varsa Türkçe mesajı döner.

  Editörün "Word'e aktar" düğmesi, ana sayfadaki "Danışmanıma gönder"
  kartı ve teslim paketi (ZIP) aynı yolu kullanıyor: üç kopya ilk
  düzeltmede ayrışırdı (büyük dosyanın imzalı bağlantıyla gelmesi gibi).

  Eskiden <a download> tıklanıyordu: 402 (abonelik), 404 ve 500
  yanıtlarındaki Türkçe açıklama hiçbir yerde görünmüyor, indirme
  sessizce boş kalıyordu. Yanıt okunup hata çağırana dönüyor.

  Tarayıcıda çalışır (document); sunucuda çağrılmaz.
*/
import type { Dil, Metin } from "@/lib/dil";
import { kaydedilmemisTaslakVar } from "@/lib/otomatik-kayit";

const KAYDEDILMEMIS: Metin = {
  tr: "Bu tarayıcıda çalışmanın kaydedilmemiş değişiklikleri var. Eski sürümü indirmemek için dosya oluşturulmadı: editörü açıp metnin kaydedildiğini görün, sonra tekrar deneyin.",
  en: "This browser has unsaved changes to the work. To avoid downloading an older version, no file was created: open the editor, make sure the text is saved, then try again.",
};

/* Sunucu kaydından yeni taslak var mı (lib/otomatik-kayit.ts). localStorage okunamazsa engel yok. */
function eskiSurumMu(projectId: string, guncellendi: string | null): boolean {
  try {
    const kayitlar: { anahtar: string; ham: string | null }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const anahtar = window.localStorage.key(i);
      if (anahtar) kayitlar.push({ anahtar, ham: window.localStorage.getItem(anahtar) });
    }
    return kaydedilmemisTaslakVar(kayitlar, projectId, guncellendi);
  } catch {
    return false;
  }
}

const VARSAYILAN_HATA: Metin = {
  tr: "Word dosyası oluşturulamadı. Metin çok büyükse resimleri küçültüp tekrar deneyin.",
  en: "The Word file could not be created. If the text is very large, shrink the images and try again.",
};

/** Word dosyasının kendisi (ZIP'e konmak için); hata varsa Türkçe mesaj. */
export async function wordBlobu(projectId: string, dil: Dil = "tr"): Promise<{ blob: Blob; ad: string } | { hata: string }> {
  const response = await fetch(`/api/manuscripts/${projectId}/export`, { cache: "no-store" });
  if (!response.ok) {
    const govde = (await response.json().catch(() => null)) as { error?: string } | null;
    return { hata: govde?.error ?? VARSAYILAN_HATA[dil] };
  }
  /*
    Büyük dosyalar Vercel'in yanıt sınırına takıldığı için depoya yazılıp
    imzalı bağlantıyla dönüyor; küçük dosyalar doğrudan geliyor.
  */
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const { downloadUrl, fileName, guncellendi } = (await response.json()) as { downloadUrl: string; fileName?: string; guncellendi?: string | null };
    if (eskiSurumMu(projectId, guncellendi ?? null)) return { hata: KAYDEDILMEMIS[dil] };
    const dosya = await fetch(downloadUrl);
    if (!dosya.ok) return { hata: VARSAYILAN_HATA[dil] };
    return { blob: await dosya.blob(), ad: fileName ?? "calisma.docx" };
  }
  /* Kaydedilmemiş taslak varken eski kayıttan üretilen dosya sessizce inmez
     (20.11.2026; ZIP de bu yoldan geçer). */
  if (eskiSurumMu(projectId, response.headers.get("X-Belge-Guncellendi"))) return { hata: KAYDEDILMEMIS[dil] };
  const adBasligi = response.headers.get("Content-Disposition") ?? "";
  const eslesme = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(adBasligi);
  return { blob: await response.blob(), ad: eslesme ? decodeURIComponent(eslesme[1]) : "calisma.docx" };
}

export function dosyayiKaydet(blob: Blob, ad: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ad;
  link.click();
  // Bazı tarayıcılar tıklamayı eşzamansız işliyor; bağlantı hemen bırakılırsa indirme boş kalıyordu.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function wordDosyasiniIndir(projectId: string, dil: Dil = "tr"): Promise<string | null> {
  const sonuc = await wordBlobu(projectId, dil);
  if ("hata" in sonuc) return sonuc.hata;
  dosyayiKaydet(sonuc.blob, sonuc.ad);
  return null;
}
