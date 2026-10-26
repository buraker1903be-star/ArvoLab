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

const VARSAYILAN_HATA = "Word dosyası oluşturulamadı. Metin çok büyükse resimleri küçültüp tekrar deneyin.";

/** Word dosyasının kendisi (ZIP'e konmak için); hata varsa Türkçe mesaj. */
export async function wordBlobu(projectId: string): Promise<{ blob: Blob; ad: string } | { hata: string }> {
  const response = await fetch(`/api/manuscripts/${projectId}/export`, { cache: "no-store" });
  if (!response.ok) {
    const govde = (await response.json().catch(() => null)) as { error?: string } | null;
    return { hata: govde?.error ?? VARSAYILAN_HATA };
  }
  /*
    Büyük dosyalar Vercel'in yanıt sınırına takıldığı için depoya yazılıp
    imzalı bağlantıyla dönüyor; küçük dosyalar doğrudan geliyor.
  */
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const { downloadUrl, fileName } = (await response.json()) as { downloadUrl: string; fileName?: string };
    const dosya = await fetch(downloadUrl);
    if (!dosya.ok) return { hata: VARSAYILAN_HATA };
    return { blob: await dosya.blob(), ad: fileName ?? "calisma.docx" };
  }
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

export async function wordDosyasiniIndir(projectId: string): Promise<string | null> {
  const sonuc = await wordBlobu(projectId);
  if ("hata" in sonuc) return sonuc.hata;
  dosyayiKaydet(sonuc.blob, sonuc.ad);
  return null;
}
