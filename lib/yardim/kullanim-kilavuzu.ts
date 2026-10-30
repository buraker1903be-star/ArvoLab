/*
  KULLANIM KILAVUZU (30.10.2026, kurum sahibinin isteği: "yeni başlayan
  için paneli nasıl kullanabileceğini anlatacak kılavuz").

  Saf modül: sayfa (app/dashboard/yardim) ve testi
  (tests/unit/kullanim-kilavuzu.test.ts) aynı içeriği okur.

  "Kılavuz" kelimesi panelde TEZ YAZIM KILAVUZU için kullanılıyor
  (çalışmaya yüklenen üniversite kılavuzu). Karışmasın diye bu sayfanın
  adı "Kullanım Kılavuzu", adresi /dashboard/yardim.

  Metinler ekrandaki düğme adlarını BİREBİR kullanır: kullanıcı kılavuzda
  okuduğu adı ekranda arayacak. Bir düğmenin adı değişirse burası da
  değişmeli; testi bağlantıların gerçek sayfalara gittiğini sabitliyor,
  adların doğruluğunu sabitleyemiyor.

  Sayılar (saatlik asistan hakkı, dosya sınırları) koddaki sabitten
  gelir ya da o sabitin yanında yazılıdır; kılavuz ayrı bir sayı
  uydurmaz.

  Bölümler role göre süzülür: öğrenci personel ekranlarını, personel iç
  ekibin ekranlarını görmez — göremediği bir ekranı anlatan kılavuz
  kullanıcıyı olmayan bir düğmeyi aramaya gönderir.
*/
import type { Metin } from "@/lib/dil";
import { ADMIN_ROLES, OVERSIGHT_ROLES, STAFF_ROLES } from "@/lib/project-labels";
import { SAATLIK_HAK } from "@/lib/ai/sinirlar";

export type KilavuzAdimi = Metin;

export type KilavuzBolumu = {
  /** Sayfadaki çapa (#id); bağlantılar ve içindekiler bunu kullanır. */
  id: string;
  baslik: Metin;
  ozet: Metin;
  /** Sırayla yapılacaklar. */
  adimlar?: KilavuzAdimi[];
  /** Bilinmesi gerekenler: sınırlar, kurallar. */
  notlar?: Metin[];
  /** İlgili ekran; düğme olarak gösterilir. */
  baglanti?: { href: string; etiket: Metin };
  /** Yalnızca bu rollerde gösterilir; yoksa herkese. */
  roller?: readonly string[];
};

export type KilavuzSorusu = { soru: Metin; cevap: Metin };

export const KILAVUZ_ADRESI = "/dashboard/yardim";

const BOLUMLER: KilavuzBolumu[] = [
  {
    id: "ilk-adimlar",
    baslik: { tr: "İlk adımlar: panelin düzeni", en: "First steps: the panel layout" },
    ozet: {
      tr: "ArvoLab bir masaüstü gibi düzenlenmiştir: altta uygulama çubuğu (dock), üstte arama, bildirimler ve hesap menünüz.",
      en: "ArvoLab is laid out like a desktop: the app bar (dock) at the bottom, and search, notifications and your account menu at the top.",
    },
    adimlar: [
      {
        tr: "İlk girişte Kullanım Sözleşmesi açılır. Metni sonuna kadar kaydırın; \"Okudum ve onaylıyorum\" düğmesi ancak o zaman etkinleşir. Onayın bir kopyası e-postanıza gelir.",
        en: "On your first sign-in the Terms of Use open. Scroll to the end of the text; only then does \"I have read and agree\" become active. A copy of your approval is emailed to you.",
      },
      {
        tr: "Alttaki çubukta günlük işin uygulamaları sırayla durur: Ana Sayfa, Çalışmalarım, Kaynaklar, Analiz Merkezi, Belge Kontrol, Destek, Ayarlar. Simgenin üstüne gelince adı görünür.",
        en: "The bar at the bottom holds the everyday apps in order: Home, My works, Sources, Analysis Center, Document Check, Support, Settings. Hover over an icon to see its name.",
      },
      {
        tr: "Çubuğun sonundaki \"Tüm uygulamalar\" düğmesi, çubukta yer almayan sayfaları (örneğin Abonelik ve Kredi, bu kılavuz) açar.",
        en: "The \"All apps\" button at the end of the bar opens the pages that are not on the bar (for example Subscription and Credits, and this guide).",
      },
      {
        tr: "Herhangi bir yerden Ctrl+K (Mac'te Cmd+K) ile arama penceresini açın; sayfa ya da komut adını yazıp Enter'a basın.",
        en: "Press Ctrl+K (Cmd+K on Mac) anywhere to open search; type a page or command name and press Enter.",
      },
      {
        tr: "Zil simgesi \"Son gelişmeler\"i açar: yorumlar, uzman atamaları ve durum değişiklikleri burada görünür.",
        en: "The bell icon opens \"Latest updates\": comments, expert assignments and status changes appear here.",
      },
      {
        tr: "Sağ üstteki adınıza tıklayınca Ayarlar, Abonelik ve kredi, Destek ve Çıkış yap bağlantıları açılır.",
        en: "Clicking your name at the top right opens links to Settings, Subscription and credits, Support and Sign out.",
      },
    ],
    notlar: [
      {
        tr: "Telefonda alttaki çubuk, sayfalar arası geçişin kendisidir; her ekran telefona göre yeniden dizilir.",
        en: "On a phone the bottom bar is your navigation; every screen rearranges itself for the phone.",
      },
    ],
  },
  {
    id: "ilk-calisma",
    baslik: { tr: "İlk çalışmanızı açın", en: "Create your first work" },
    ozet: {
      tr: "Her şey bir çalışmaya bağlıdır: tez, makale ya da proje. Kaynaklar, analizler ve belge kontrolü hangi çalışmaya ait olduklarını bilir.",
      en: "Everything belongs to a work: a thesis, an article or a project. Sources, analyses and document checks know which work they belong to.",
    },
    adimlar: [
      {
        tr: "Ana Sayfa'da \"Yeni çalışma\" düğmesine basın (ya da Çalışmalarım'da aynı düğmeye).",
        en: "On Home, click \"New work\" (or the same button in My works).",
      },
      {
        tr: "Başlığı yazın, türü seçin (Tez, Makale, Proje). Üniversite, anabilim dalı ve teslim tarihi isteğe bağlıdır; teslim tarihi verirseniz ana sayfa kalan günü sayar.",
        en: "Enter the title and choose the type (Thesis, Article, Project). University, department and due date are optional; if you give a due date, Home counts down the days left.",
      },
      {
        tr: "Kaynakça sistemini seçin (APA, IEEE vb.) ve \"Çalışmayı oluştur\"a basın.",
        en: "Choose the citation style (APA, IEEE, etc.) and click \"Create work\".",
      },
      {
        tr: "Tezde ikinci adım tez yazım kılavuzunuzdur: üniversitenizin kılavuzunu PDF olarak yükleyin ya da adresini verin. ArvoLab kuralları (kaynakça sistemi, zorunlu bölümler, sayfa sınırları) çıkarır, siz kontrol edip \"Kurallarımı uygula\" dersiniz.",
        en: "For a thesis, the second step is your thesis writing guideline: upload your university's guideline as a PDF or give its address. ArvoLab extracts the rules (citation style, required sections, page limits); you review them and click \"Apply my rules\".",
      },
      {
        tr: "Kılavuzunuz hazır değilse \"Kılavuzu sonra eklerim, yazmaya başla\" ile devam edin; sonra çalışmanın \"Kılavuz\" penceresinden eklersiniz.",
        en: "If your guideline isn't ready, continue with \"I'll add the guideline later, start writing\"; you can add it later from the work's \"Guideline\" window.",
      },
    ],
    notlar: [
      {
        tr: "Kılavuzdan çıkarılan kurallar size yardımcı olmak içindir; resmî bir onay yerine geçmez. Son söz kurumunuzun ve danışmanınızındır.",
        en: "Rules extracted from the guideline are there to help you; they are not an official approval. The final word belongs to your institution and your advisor.",
      },
      {
        tr: "Makalede ikinci adım dergi bilgileridir (hedef dergi, kelime ve özet sınırları). Bu bilgiler çalışmanın \"Makale\" sekmesinde durur.",
        en: "For an article, the second step is the journal details (target journal, word and abstract limits). They live in the work's \"Article\" tab.",
      },
    ],
    baglanti: { href: "/dashboard/editor?yeni=1", etiket: { tr: "Yeni çalışma başlat", en: "Start a new work" } },
  },
  {
    id: "yazim",
    baslik: { tr: "Yazım editörü", en: "The writing editor" },
    ozet: {
      tr: "Çalışmanızı \"Yazmaya devam et\" ile açın. Editör yazdıklarınızı kendiliğinden kaydeder; soldaki araç kartları biçim, ekleme ve belge ayarlarını, sağdaki panel bölümleri, kaynakları ve canlı kontrolleri taşır.",
      en: "Open your work with \"Continue writing\". The editor saves automatically; the tool cards on the left hold formatting, insert and document settings, and the side panel holds sections, sources and live checks.",
    },
    adimlar: [
      {
        tr: "Kayıt durumu üstte yazar: \"Kaydediliyor…\", sonra \"Kaydedildi\" ve saati. İsterseniz Ctrl+S ile hemen kaydedin.",
        en: "Save status is shown at the top: \"Saving…\", then \"Saved\" with the time. Press Ctrl+S to save right away if you like.",
      },
      {
        tr: "Başlıkları \"Başlık ve liste\" kartından (ya da Ctrl+Alt+1/2/3 ile) verin. \"Belge\" → \"Sayfa ayarı\" içindeki \"Başlıkları otomatik numarala\" seçeneği 1., 1.1. numaralarını kendisi verir; elle yazdığınız numaraları kaldırın.",
        en: "Set headings from the \"Headings and lists\" card (or with Ctrl+Alt+1/2/3). \"Document\" → \"Page setup\" → \"Number headings automatically\" adds 1., 1.1. numbers for you; remove numbers you typed by hand.",
      },
      {
        tr: "Atıf eklemek için \"Ekle\" → \"Atıf\"ı seçin. \"Listemden\" sekmesinde kaynağınızı arayın ya da \"Yeni kaynak\" sekmesine DOI yapıştırıp \"Bilgileri getir\" deyin. Atıf imlecin olduğu yere girer, kaynak kaynakçaya yazılır.",
        en: "To add a citation, choose \"Insert\" → \"Citation\". Search your source in the \"My list\" tab, or paste a DOI in the \"New source\" tab and click \"Fetch details\". The citation goes in at the cursor and the source is added to the reference list.",
      },
      {
        tr: "Şekil ve tablo başlıklarını \"Ekle\" → \"Şekil başlığı\" / \"Tablo başlığı\" ile ekleyin; numaralar yerlerine göre kendiliğinden verilir.",
        en: "Add figure and table captions with \"Insert\" → \"Figure caption\" / \"Table caption\"; numbers follow their position automatically.",
      },
      {
        tr: "Word'de yazdığınız bir metni \"Ekle\" → \"Word'den aktar\" ile getirin (.docx, en fazla 20 MB). \"Yerine koy\" seçerseniz mevcut metin önce sürüm olarak saklanır.",
        en: "Bring in text you wrote in Word with \"Insert\" → \"Import from Word\" (.docx, up to 20 MB). If you choose \"Replace\", the current text is saved as a version first.",
      },
      {
        tr: "Ctrl+F ile metinde arayın ve değiştirin. Arama büyük/küçük harfe bakmaz; ı ile i de ayrılmaz.",
        en: "Press Ctrl+F to find and replace. Search ignores upper/lower case, and treats ı and i the same.",
      },
      {
        tr: "\"Belge\" → \"Sürümler\" ile adlandırılmış bir sürüm kaydedin; eski sürümleri önizleyebilir, karşılaştırabilir ve geri yükleyebilirsiniz. Yazarken en fazla on dakikada bir otomatik sürüm de alınır.",
        en: "Save a named version with \"Document\" → \"Versions\"; you can preview, compare and restore older versions. An automatic version is also taken at most every ten minutes while you write.",
      },
      {
        tr: "Bir cümleyi seçip \"Yorum ekle\" ile not bırakın; yorumlar sağdaki \"Yorumlar\" panelinde \"Çözüldü\" olarak işaretlenir.",
        en: "Select a sentence and use \"Add comment\" to leave a note; comments are marked \"Resolved\" in the \"Comments\" panel on the right.",
      },
    ],
    notlar: [
      {
        tr: "Sağdaki \"Canlı kontrol\" boş bölümleri, atlanan başlık düzeylerini, şekil/tablo numaralarını ve metindeki atıflarla kaynakçanın eşleşmesini yazarken gösterir.",
        en: "\"Live check\" on the right shows empty sections, skipped heading levels, figure/table numbering and whether in-text citations match the reference list as you write.",
      },
      {
        tr: "Bütün kısayolların listesi \"Belge\" → \"Kısayollar\"da ve Ayarlar → \"Klavye kısayolları\"ndadır.",
        en: "The full list of shortcuts is under \"Document\" → \"Shortcuts\" and in Settings → \"Keyboard shortcuts\".",
      },
      {
        tr: "Aynı çalışma iki yerde açıkken \"Çakışma var\" uyarısı çıkarsa iki sürümden birini seçmeniz istenir; hiçbir metin sessizce kaybolmaz.",
        en: "If the same work is open in two places and \"Conflict\" appears, you are asked to choose one of the two versions; no text is lost silently.",
      },
    ],
    baglanti: { href: "/dashboard/editor", etiket: { tr: "Çalışmalarım", en: "My works" } },
  },
  {
    id: "kaynaklar",
    baslik: { tr: "Kaynaklar: literatür ve kaynakça", en: "Sources: literature and references" },
    ozet: {
      tr: "Okuyacağınız ve kullandığınız kaynakların listesi ile kaynakçanızın denetimi aynı sayfadadır.",
      en: "The list of sources you will read and use, and the check of your reference list, are on the same page.",
    },
    adimlar: [
      {
        tr: "\"Kaynak bul\" ile OpenAlex ve Crossref dizinlerinde arayın; yıl aralığı ve \"Yalnızca açık erişim\" süzgeçleri vardır. Beğendiğinizi \"Listeme ekle\" ile alın.",
        en: "Use \"Find sources\" to search the OpenAlex and Crossref indexes; there are year-range and \"Open access only\" filters. Add what you want with \"Add to my list\".",
      },
      {
        tr: "Zotero, Mendeley ya da EndNote'tan gelen RIS veya BibTeX dosyasını \"İçe aktar\" ile yükleyin (en fazla 5 MB) ya da tek bir DOI ile ekleyin.",
        en: "Upload a RIS or BibTeX file from Zotero, Mendeley or EndNote with \"Import\" (up to 5 MB), or add a single DOI.",
      },
      {
        tr: "Her kaynağın durumunu ilerletin: Okunacak → \"Okudum\" → \"Metinde kullandım\". Ana sayfadaki sayılar buradan gelir.",
        en: "Move each source along: To read → \"Read\" → \"Used in text\". The numbers on Home come from here.",
      },
      {
        tr: "\"Kaynakçamı denetle\" editördeki kaynakçanızı (ya da yapıştırdığınız metni) biçim, atıf eşleşmesi ve dizin kaydı açısından kontrol eder.",
        en: "\"Check my reference list\" checks the reference list in your editor (or text you paste) for format, citation matching and index records.",
      },
      {
        tr: "\"Dışa aktar\" ile kaynakçayı kopyalayın ya da RIS/BibTeX olarak indirin.",
        en: "Use \"Export\" to copy the reference list or download it as RIS/BibTeX.",
      },
    ],
    notlar: [
      {
        tr: "Dizin doğrulaması ilk 25 kaynakla sınırlıdır; biçim ve atıf eşleşmesi kaynakçanın tamamında çalışır.",
        en: "Index verification is limited to the first 25 sources; format and citation matching run on the whole list.",
      },
      {
        tr: "Asistan kaynak önermez: \"Tarama asistanı\" arama stratejisi ve arama dizesi kurar, yazar ya da makale adı vermez. Okumadığınız bir çalışmaya atıf yapmayın.",
        en: "The assistant does not suggest sources: the \"Search assistant\" builds a search strategy and search strings, never authors or article titles. Don't cite work you haven't read.",
      },
    ],
    baglanti: { href: "/dashboard/literature", etiket: { tr: "Kaynaklar", en: "Sources" } },
  },
  {
    id: "kanit",
    baslik: { tr: "Kanıt matrisi", en: "Evidence matrix" },
    ozet: {
      tr: "Metninizdeki önemli iddiaları kaynaklarıyla eşleştirir: künye doğru mu, kaynak iddiayı gerçekten destekliyor mu, ayrı ayrı izlenir.",
      en: "Matches the key claims in your text to their sources: whether the reference is correct and whether the source actually supports the claim are tracked separately.",
    },
    adimlar: [
      {
        tr: "Çalışmanın \"Kanıt matrisi\" sekmesinde \"İddia ekle\" ile iddiayı yazın ve listenizden kaynağını seçin.",
        en: "In the work's \"Evidence matrix\" tab, use \"Add claim\" to write the claim and pick its source from your list.",
      },
      {
        tr: "\"Künyeyi dizinde doğrula\" ile kaynağın bibliyografik bilgisini kontrol edin.",
        en: "Use \"Verify reference in index\" to check the source's bibliographic details.",
      },
      {
        tr: "\"Kaynaktan metin ekle\" ile kaynağın ilgili bölümünü kendiniz yapıştırın; sayfa numarasını da siz yazın.",
        en: "With \"Add text from source\", paste the relevant passage yourself, and type the page number yourself.",
      },
      {
        tr: "Sonra \"Asistanla karşılaştır\" ya da \"Kendim değerlendireyim\" ile destek düzeyini belirleyin.",
        en: "Then set the level of support with \"Compare with assistant\" or \"Assess it myself\".",
      },
    ],
    notlar: [
      {
        tr: "İddiayı ya da kaynak metnini değiştirirseniz eski değerlendirme düşer; yeniden değerlendirmeniz gerekir. Asistanın görüşü nihai akademik hüküm değildir.",
        en: "If you change the claim or the source text, the earlier assessment is cleared and must be redone. The assistant's view is not a final academic judgment.",
      },
    ],
  },
  {
    id: "analiz",
    baslik: { tr: "Analiz Merkezi", en: "Analysis Center" },
    ozet: {
      tr: "Excel ya da CSV verinizle istatistiksel analiz yapar; t testlerinden faktör analizine, aracı ve düzenleyici değişken analizine kadar.",
      en: "Runs statistical analyses on your Excel or CSV data, from t-tests to factor analysis, mediation and moderation.",
    },
    adimlar: [
      {
        tr: "Veri dosyanızı yükleyin (.xlsx, .xls, .csv). Hesap tarayıcınızda yapılır; dosyanın kendisi sunucuya gönderilmez, yalnızca kaydettiğiniz sonuç saklanır.",
        en: "Upload your data file (.xlsx, .xls, .csv). The computation happens in your browser; the file itself is not sent to the server, only results you save are stored.",
      },
      {
        tr: "Gerekirse \"Veri hazırlama\" ile ters maddeleri çevirin ve ölçek puanı hesaplayın.",
        en: "If needed, use \"Data preparation\" to reverse-score items and compute scale scores.",
      },
      {
        tr: "\"Hangi analiz?\" bölümünden analizi ve değişkenleri seçip \"Analizi Çalıştır\"a basın. Tüm temel analizler için \"Kapsamlı Raporu Oluştur\"u kullanın.",
        en: "Choose the analysis and variables under \"Which analysis?\" and click \"Run analysis\". For all the core analyses at once, use \"Generate Comprehensive Report\".",
      },
      {
        tr: "Sonucu \"Teze ekleme sırasına koy\"; editörde \"Ekle\" → \"Analiz\" ile tablo olarak metninize ekleyin.",
        en: "Use \"Queue for thesis\"; then add it to your text as a table with \"Insert\" → \"Analysis\" in the editor.",
      },
    ],
    notlar: [
      {
        tr: "Bulgunun yorumunu kendi cümlenizle yazın. \"Asistana okut\" neyin eksik olduğunu söyler, yorum cümlesini kurmaz.",
        en: "Write the interpretation of a finding in your own words. \"Ask the assistant\" tells you what is missing; it does not write the sentence.",
      },
      {
        tr: "SPSS, R ve Python sözdizimini kopyalayıp aynı analizi kendi yazılımınızda tekrarlayabilirsiniz.",
        en: "You can copy SPSS, R and Python syntax to repeat the same analysis in your own software.",
      },
    ],
    baglanti: { href: "/dashboard/analysis", etiket: { tr: "Analiz Merkezi", en: "Analysis Center" } },
  },
  {
    id: "belge",
    baslik: { tr: "Belge Kontrol", en: "Document Check" },
    ozet: {
      tr: "Başka yerde yazdığınız bir dosyayı kılavuzunuza ve kaynakça kurallarına göre denetler.",
      en: "Checks a file you wrote elsewhere against your guideline and citation rules.",
    },
    adimlar: [
      {
        tr: "\"Belge yükle\" ile Word (.docx) ya da PDF dosyanızı seçin (en fazla 20 MB) ve \"Yükle ve Analiz Et\"e basın.",
        en: "Choose your Word (.docx) or PDF file with \"Upload document\" (up to 20 MB) and click \"Upload and analyze\".",
      },
      {
        tr: "Sonuçta zorunlu bölümlerin varlığını, kaynakça uyum puanını ve eşleşmeyen atıfları görürsünüz; yeni bir sürüm yüklediğinizde önceki sürüme göre fark gösterilir.",
        en: "The result shows whether required sections are present, a reference-compliance score and unmatched citations; when you upload a new version, the difference from the previous one is shown.",
      },
      {
        tr: "\"Ön kontrolü çalıştır\" belgenizi ArvoLab'daki belge havuzuyla karşılaştırır.",
        en: "\"Run pre-check\" compares your document with the ArvoLab document pool.",
      },
    ],
    notlar: [
      {
        tr: "Ön kontrol yalnızca ArvoLab havuzuna bakar; Turnitin gibi bir benzerlik raporunun yerini tutmaz.",
        en: "The pre-check only looks at the ArvoLab pool; it does not replace a similarity report such as Turnitin.",
      },
    ],
    baglanti: { href: "/dashboard/documents", etiket: { tr: "Belge Kontrol", en: "Document Check" } },
  },
  {
    id: "teslim",
    baslik: { tr: "Teslime hazırlık ve çıktı", en: "Getting ready to submit, and output" },
    ozet: {
      tr: "Teslimden önce editördeki kontrollerden geçin, sonra Word ya da PDF alın.",
      en: "Before submitting, run the checks in the editor, then export to Word or PDF.",
    },
    adimlar: [
      {
        tr: "Editörün üstündeki \"Teslim kontrolü\" eksik maddeleri \"Hazır\", \"Bakılmalı\", \"Eksik\" olarak listeler.",
        en: "\"Submission check\" at the top of the editor lists items as \"Ready\", \"Review\" or \"Missing\".",
      },
      {
        tr: "\"Kılavuz ve kaynakça kontrolü\" zorunlu bölümleri, kaynakça sistemini ve atıf–kaynakça eşleşmesini denetler.",
        en: "\"Guideline and reference check\" checks required sections, the citation style and citation–reference matching.",
      },
      {
        tr: "\"Belge\" → \"Kapak\" ile kapak sayfasını doldurun; \"Sayfa ayarı\"ndan kenar boşluklarını, sayfa numarasını ve içindekiler tablosunu açın.",
        en: "Fill in the cover page with \"Document\" → \"Cover\"; turn on margins, page numbers and the table of contents in \"Page setup\".",
      },
      {
        tr: "\"Word olarak indir\" ya da \"PDF / Yazdır\" (Ctrl+P) ile çıktı alın. Çalışma özetindeki \"Teslim paketi (ZIP)\" metni kaynak PDF'leriyle birlikte indirir.",
        en: "Export with \"Download as Word\" or \"PDF / Print\" (Ctrl+P). \"Submission package (ZIP)\" in the work summary downloads the text together with source PDFs.",
      },
    ],
    notlar: [
      {
        tr: "Teslim kontrolü bir yardımcıdır; danışman ve jüri kontrolünün yerini tutmaz.",
        en: "The submission check is a helper; it does not replace your advisor's and committee's review.",
      },
    ],
  },
  {
    id: "danisman",
    baslik: { tr: "Danışmanınızla paylaşmak", en: "Sharing with your advisor" },
    ozet: {
      tr: "Danışmanınız ArvoLab hesabı olmadan, salt okunur bir bağlantıyla metninizi okuyabilir.",
      en: "Your advisor can read your text through a read-only link, without an ArvoLab account.",
    },
    adimlar: [
      {
        tr: "Editörde \"Belge\" → \"Paylaş\"ı açın, kime gönderdiğinizi yazın, geçerlilik süresini (7, 30 ya da 90 gün) seçip \"Bağlantı oluştur\"a basın.",
        en: "In the editor open \"Document\" → \"Share\", write who it is for, pick how long it is valid (7, 30 or 90 days) and click \"Create link\".",
      },
      {
        tr: "Bağlantı yalnızca bir kez gösterilir ve panonuza kopyalanır; danışmanınıza e-postayla gönderin.",
        en: "The link is shown only once and copied to your clipboard; send it to your advisor by email.",
      },
      {
        tr: "Bireysel abonelikte Ana Sayfa'daki \"Danışmanıma gönder\" kartı aynı işi tek düğmeyle yapar ve danışmanınızın bağlantıyı kaç kez açtığını gösterir.",
        en: "On an individual subscription, the \"Send to my advisor\" card on Home does the same in one click and shows how many times your advisor opened the link.",
      },
      {
        tr: "Bağlantıyı istediğiniz an \"İptal et\" ile kapatabilirsiniz.",
        en: "You can close a link at any time with \"Revoke\".",
      },
    ],
    notlar: [
      {
        tr: "Danışmanın metne yorum yazabilmesi için kurumunuzun ArvoLab kullanması gerekir; bağlantı yalnızca okumaya açıktır.",
        en: "For your advisor to comment on the text, your institution needs to use ArvoLab; the link is read-only.",
      },
    ],
  },
  {
    id: "asistan",
    baslik: { tr: "Asistan: ne yapar, ne yapmaz", en: "The assistant: what it does and doesn't do" },
    ozet: {
      tr: "ArvoLab'daki yapay zekâ asistanı bir denetçidir, yazar değildir: neyin eksik olduğunu ve neden önemli olduğunu söyler.",
      en: "ArvoLab's AI assistant is a reviewer, not a writer: it tells you what is missing and why it matters.",
    },
    adimlar: [
      {
        tr: "Asistan; kaynakça, analiz sonucu, kanıt, belge ve makale bölümleri gibi ekranlarda ilgili düğmeyle çalışır ve bulgularını kısa maddeler hâlinde verir.",
        en: "The assistant runs from the relevant button on screens such as references, analysis results, evidence, documents and article sections, and returns its findings as short items.",
      },
      {
        tr: "Her bulguyu puanlayabilirsiniz; bu değerlendirme asistanın gelişmesine katkı verir.",
        en: "You can rate each finding; your rating helps the assistant improve.",
      },
    ],
    notlar: [
      {
        tr: "Asistan çalışmanıza yapıştırılacak cümle, paragraf ya da özet yazmaz; kaynak (yazar, başlık, DOI) önermez.",
        en: "The assistant does not write sentences, paragraphs or abstracts for your work, and does not suggest sources (authors, titles, DOIs).",
      },
      {
        tr: "Asistanın verdiği her sayı sizin girdinizde geçmek zorundadır; geçmeyen bir değer bulunursa cevabın tamamı gösterilmez.",
        en: "Every number the assistant gives must appear in your input; if one doesn't, the whole answer is withheld.",
      },
      {
        tr: `Kullanım hakkı: saatte en fazla ${SAATLIK_HAK} istek; aylık kredi ve satın alınan ek kredi Abonelik ve Kredi sayfasında görünür.`,
        en: `Usage: at most ${SAATLIK_HAK} requests an hour; your monthly credits and any extra credits you buy are shown on the Subscription and Credits page.`,
      },
    ],
  },
  {
    id: "destek",
    baslik: { tr: "Yardım almak", en: "Getting help" },
    ozet: {
      tr: "Destek sayfasında iki yol vardır: çalışmanızla ilgili uzman desteği ve uygulamayla ilgili sorunlar için uygulama desteği.",
      en: "The Support page has two routes: expert help with your work, and app support for problems with the application.",
    },
    adimlar: [
      {
        tr: "\"Uzmana sor\" ile çalışmanızı ve konuyu (analiz, istatistik, metodoloji, dil/biçim) seçip mesajınızı yazın. Yanıt aynı yazışmada gelir, zil simgesiyle haber verilir.",
        en: "Use \"Ask an expert\" to choose your work and the topic (analysis, statistics, methodology, language/format) and write your message. The reply arrives in the same thread and the bell notifies you.",
      },
      {
        tr: "Bir hata, erişim sorunu ya da ödeme sorusu için \"Bize yaz\"ı kullanın.",
        en: "For a bug, an access problem or a payment question, use \"Write to us\".",
      },
    ],
    notlar: [
      {
        tr: "Aboneliğiniz kapalı olsa bile Destek, Abonelik ve Ayarlar sayfaları ve bu kılavuz açık kalır.",
        en: "Even if your subscription is closed, the Support, Subscription and Settings pages and this guide stay open.",
      },
    ],
    baglanti: { href: "/dashboard/expert-requests", etiket: { tr: "Destek", en: "Support" } },
  },
  {
    id: "hesap",
    baslik: { tr: "Hesabınız, abonelik ve ayarlar", en: "Your account, subscription and settings" },
    ozet: {
      tr: "Ad, dil, şifre, oturumlar, verileriniz ve aboneliğiniz.",
      en: "Name, language, password, sessions, your data and your subscription.",
    },
    adimlar: [
      {
        tr: "Ayarlar'da ad soyadınızı düzenleyin (kapak sayfasında kullanılır) ve arayüz dilini seçin.",
        en: "In Settings, edit your full name (used on the cover page) and choose the interface language.",
      },
      {
        tr: "Şifrenizi \"Değiştir\" ile güncelleyin; bir cihazı kaybettiyseniz \"Diğer cihazlar\" → \"Kapat\" ile öteki oturumları sonlandırın.",
        en: "Update your password with \"Change\"; if you lost a device, end other sessions with \"Other devices\" → \"Sign out\".",
      },
      {
        tr: "\"Verilerim\" → \"İndir\" bütün verilerinizi tek dosya olarak verir.",
        en: "\"My data\" → \"Download\" gives you all your data in one file.",
      },
      {
        tr: "Abonelik ve Kredi sayfasında dönem sonunuzu, asistan kredinizi ve faturalarınızı görürsünüz; bireysel abonelik kartla ödenir, her ödeme bankanızın 3D Secure onayıyla yapılır ve kartınızdan otomatik çekim yapılmaz.",
        en: "The Subscription and Credits page shows your period end, assistant credits and invoices; an individual subscription is paid by card, every payment is approved with your bank's 3D Secure check, and your card is never charged automatically.",
      },
    ],
    notlar: [
      {
        tr: "Kuruma bağlı hesaplarda rolünüzü ve aboneliği kurumunuz yönetir; değişiklik için kurum yöneticinize başvurun.",
        en: "For institution accounts, your role and subscription are managed by your institution; contact your institution administrator for changes.",
      },
      {
        tr: "\"Hesabımı sil\" hemen silmez, bir bekleme süresi başlatır; bu sürede vazgeçebilirsiniz.",
        en: "\"Delete my account\" doesn't delete immediately; it starts a waiting period during which you can change your mind.",
      },
    ],
    baglanti: { href: "/dashboard/settings", etiket: { tr: "Ayarlar", en: "Settings" } },
  },
  {
    id: "personel",
    baslik: { tr: "Personel için: takip ve onay", en: "For staff: tracking and approval" },
    ozet: {
      tr: "Kurumunuzdaki çalışmaları izler, uzman taleplerini yanıtlar ve teslim onayı verirsiniz. Yalnızca kendi kurumunuzun verisini görürsünüz.",
      en: "You follow your institution's works, answer expert requests and approve submissions. You only see your own institution's data.",
    },
    adimlar: [
      {
        tr: "Ana Sayfa'daki \"Dikkat isteyenler\" kartı teslimi geçen, yaklaşan, sorumlusu olmayan ve onay bekleyen çalışmalara götürür.",
        en: "The \"Needs attention\" card on Home takes you to overdue, upcoming, unassigned and awaiting-approval works.",
      },
      {
        tr: "Çalışmalarım'da süzgeçlerle (Durum, Teslim, Aşama, Sorumlu, \"Yalnızca onay bekleyenler\") listeyi daraltın.",
        en: "In My works, narrow the list with the filters (Status, Due, Stage, Assignee, \"Only awaiting approval\").",
      },
      {
        tr: "Destek sayfasında \"Kuyruklar\" görünümü açık uzman taleplerini ve size atananları gösterir.",
        en: "On the Support page, the \"Queues\" view shows open expert requests and the ones assigned to you.",
      },
      {
        tr: "Çalışmanın durumunu \"Çalışma ayarları\"ndan değiştirebilirsiniz (Kontrolör ve üstü).",
        en: "You can change a work's status from \"Work settings\" (Controller and above).",
      },
    ],
    notlar: [
      {
        tr: "Doçentlik Puanı aracı \"Tüm uygulamalar\"dadır; ÜAK duyurusunun yerini tutmaz.",
        en: "The Associate Professorship Score tool is under \"All apps\"; it does not replace the official ÜAK announcement.",
      },
    ],
    roller: STAFF_ROLES,
  },
  {
    id: "yonetim",
    baslik: { tr: "İç ekip için: ekip ve kayıtlar", en: "For the internal team: team and logs" },
    ozet: {
      tr: "Kurumları ve kullanıcıları yönetir, asistan kayıtlarını incelersiniz.",
      en: "You manage institutions and users, and review assistant logs.",
    },
    adimlar: [
      {
        tr: "\"Tüm uygulamalar\" → \"Ekip Yönetimi\"nde \"Kurum ekle\" ve \"Kullanıcı davet et\" ile hesap açın; rol ve kurumu satırdan kaydedin.",
        en: "In \"All apps\" → \"Team Management\", open accounts with \"Add institution\" and \"Invite user\"; save role and institution on each row.",
      },
      {
        tr: "\"Asistan Kayıtları\" her asistan çalışmasını, kullanıcı puanlarını ve model karşılaştırmasını gösterir.",
        en: "\"Assistant Logs\" shows every assistant run, user ratings and the model comparison.",
      },
    ],
    notlar: [
      {
        tr: "Kendi rolünüzü değiştiremezsiniz; kurucu rolünü yalnızca bir kurucu verebilir.",
        en: "You cannot change your own role; only a founder can grant the founder role.",
      },
    ],
    roller: ADMIN_ROLES,
  },
];

const SORULAR: KilavuzSorusu[] = [
  {
    soru: { tr: "Yazdıklarım kaybolur mu?", en: "Can I lose what I wrote?" },
    cevap: {
      tr: "Editör kendiliğinden kaydeder ve düzenli olarak sürüm alır. \"Sürümler\"den eski bir hâle dönebilirsiniz.",
      en: "The editor saves automatically and takes versions regularly. You can go back to an earlier state from \"Versions\".",
    },
  },
  {
    soru: { tr: "Asistan tezimi benim yerime yazar mı?", en: "Will the assistant write my thesis for me?" },
    cevap: {
      tr: "Hayır. Asistan eksikleri ve nedenlerini gösterir; cümleyi siz kurarsınız. Bu, çalışmanızın size ait kalması içindir.",
      en: "No. The assistant shows what is missing and why; you write the sentences. This keeps your work your own.",
    },
  },
  {
    soru: { tr: "Kılavuzumu sonradan değiştirebilir miyim?", en: "Can I change my guideline later?" },
    cevap: {
      tr: "Evet. Çalışmanın \"Kılavuz\" penceresinden yeni bir PDF yükleyip kuralları yeniden onaylarsınız.",
      en: "Yes. Upload a new PDF from the work's \"Guideline\" window and approve the rules again.",
    },
  },
  {
    soru: { tr: "Verilerimi kim görebilir?", en: "Who can see my data?" },
    cevap: {
      tr: "Bireysel abonelikte yalnızca siz. Kuruma bağlıysanız kurumunuzun yetkili personeli; başka bir kurum göremez. Paylaşım bağlantısı verdiğiniz kişi yalnızca okur.",
      en: "On an individual subscription, only you. If you belong to an institution, its authorized staff; no other institution can. Anyone you give a share link to can only read.",
    },
  },
  {
    soru: { tr: "Aboneliğim biterse ne olur?", en: "What happens if my subscription ends?" },
    cevap: {
      tr: "Çalışmalarınız silinmez. Ödemeyi yapana kadar yazma ve analiz ekranları kapanır; Abonelik, Destek, Ayarlar ve bu kılavuz açık kalır, verilerinizi indirebilirsiniz.",
      en: "Your works are not deleted. Until you pay, the writing and analysis screens close; Subscription, Support, Settings and this guide stay open, and you can download your data.",
    },
  },
];

/*
  Yeni çalışma iki yerden açılıyor: öğrenci düzeninde Çalışmalarım'daki
  pencere (?yeni=1), gözetim rollerinde ayrı sayfa (editor/new) —
  app/dashboard/editor/page.tsx'teki ogrenciDuzeni ile aynı ayrım.
  Personel pencere adresine gitseydi pencere açılmazdı.
*/
const yeniCalismaAdresi = (rol: string | null | undefined) =>
  rol && (OVERSIGHT_ROLES as readonly string[]).includes(rol) ? "/dashboard/editor/new" : "/dashboard/editor?yeni=1";

/** Kullanıcının rolüne göre görünen bölümler. Rolü bilinmeyen yalnızca herkese açık bölümleri görür. */
export function kilavuzBolumleri(rol: string | null | undefined): KilavuzBolumu[] {
  return BOLUMLER.filter((b) => !b.roller || (!!rol && b.roller.includes(rol))).map((b) =>
    b.id === "ilk-calisma" && b.baglanti ? { ...b, baglanti: { ...b.baglanti, href: yeniCalismaAdresi(rol) } } : b,
  );
}

export function kilavuzSorulari(): KilavuzSorusu[] {
  return SORULAR;
}

/** Testler için: süzülmemiş tam liste. */
export const TUM_BOLUMLER: readonly KilavuzBolumu[] = BOLUMLER;

