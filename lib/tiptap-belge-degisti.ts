/*
  EDİTÖRÜN "update" OLAYI BELGE DEĞİŞİKLİĞİ DEMEK DEĞİL (05.11.2026).

  Tiptap "update" olayını iki yoldan yayınlıyor:
    - normal işlem yolu: yalnızca bir işlem belgeyi değiştirdiyse
      (ana işlem ya da bir eklentinin eklediği işlemlerden biri);
    - editor.setEditable(deger, emitUpdate = true): belgeye HİÇ
      dokunmadan, boş bir işlemle.
  Editör her açılışta setEditable çağırıyordu ve onUpdate doğrudan
  markDirty()'ye bağlıydı: kullanıcı tek tuşa basmadan belgenin tamamı
  yeniden kaydediliyor, updated_at / updated_by / word_count değişiyor,
  sürüm geçmişine boş bir sürüm ekleniyor ve aynı belgeyi açık tutan öteki
  sekme ya da kişi yersiz bir "başka biri değiştirdi" uyarısı alıyordu.

  Karar burada, saf: ana işlem ya da eklenen işlemlerden biri belgeyi
  değiştirdiyse kaydedilecek bir değişiklik vardır. Eklenen işlemlere de
  bakmak şart: bir eklentinin appendTransaction'ı belgeyi değiştirirken
  ana işlem yalnızca seçimi değiştirmiş olabilir — o değişiklik de
  kaydedilmeli. Testi: tests/unit/tiptap-belge-degisti.test.ts.
*/
type Islem = { readonly docChanged: boolean } | null | undefined;

export function belgeGercektenDegisti(olay: {
  transaction?: Islem;
  appendedTransactions?: readonly Islem[] | null;
}): boolean {
  if (olay.transaction?.docChanged) return true;
  return (olay.appendedTransactions ?? []).some((islem) => Boolean(islem?.docChanged));
}
