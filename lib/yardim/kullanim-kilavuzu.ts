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
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/project-labels";
import { SAATLIK_HAK } from "@/lib/ai/sinirlar";
import { DENEME_ASISTAN_HAKKI } from "@/lib/ai/deneme-hakki";

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
      tr: "Bölümler bilgisayarda solda, tablette solda dar bir şeritte, telefonda ekranın altında durur; üstte arama, bildirimler ve hesap menünüz.",
      en: "Sections sit on the left on a computer, in a narrow strip on the left on a tablet, and at the bottom of the screen on a phone; search, notifications and your account menu are at the top.",
    },
    adimlar: [
      {
        tr: "Kullanım Sözleşmesi'ni kayıt olurken onaylarsınız: kutuya basınca metin açılır, sonuna kadar kaydırınca \"Okudum ve onaylıyorum\" düğmesi etkinleşir. Onayın bir kopyası e-postanıza gelir. Sözleşmenin yeni bir sürümü yayımlanırsa girişte yeniden onayınız istenir.",
        en: "You accept the Terms of Use when you sign up: ticking the box opens the text, and \"I have read and agree\" becomes active once you scroll to the end. A copy of your approval is emailed to you. If a new version is published, you're asked to accept it again when you sign in.",
      },
      {
        tr: "Gezinmede günlük işin bölümleri sırayla durur: Ana Sayfa, Çalışmalarım, Kaynaklar, Analiz Merkezi, Belge Kontrol, Destek, Ayarlar. Bir çalışmayı açtığınızda bilgisayarda o çalışmanın bölümleri (Özet, Yazım, Kanıt matrisi, Etik kurul) en üstte görünür.",
        en: "The navigation holds the everyday sections in order: Home, My works, Sources, Analysis Center, Document Check, Support, Settings. When you open a work, on a computer that work's sections (Overview, Writing, Evidence matrix, Ethics) appear at the top.",
      },
      {
        tr: "Seyrek açılan sayfalar (örneğin Abonelik ve Kredi, bu kılavuz) bilgisayarda \"Diğer\" başlığının altında, tablet ve telefonda \"Daha fazla\" düğmesindedir.",
        en: "Pages you open less often (for example Subscription and Credits, and this guide) are under \"More\" on a computer, and behind the \"More\" button on a tablet or phone.",
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
      tr: "Çalışmanızı \"Yazmaya devam et\" ile açın. Editör yazdıklarınızı kendiliğinden kaydeder. Üstteki tek satırlık araç çubuğunda biçim, asistan ve atıf; \"Paragraf\", \"Ekle\" ve ⋯ menülerinde seyrek kullanılanlar var. Sağdaki \"İncele\" paneli bölümleri, kaynakları ve canlı kontrolleri taşır; kapatabilir ya da odak moduyla yalnızca metni bırakabilirsiniz (Esc çıkar).",
      en: "Open your work with \"Continue writing\". The editor saves automatically. The single-row toolbar at the top has formatting, the assistant and citations; less frequent tools are in the \"Paragraph\", \"Insert\" and ⋯ menus. The \"Review\" panel on the right holds sections, sources and live checks; you can close it, or use focus mode to keep only the text (Esc exits).",
    },
    adimlar: [
      {
        tr: "Kayıt durumu üstte yazar: \"Kaydediliyor…\", sonra \"Kaydedildi\" ve saati. İsterseniz Ctrl+S ile hemen kaydedin.",
        en: "Save status is shown at the top: \"Saving…\", then \"Saved\" with the time. Press Ctrl+S to save right away if you like.",
      },
      {
        tr: "Başlıkları araç çubuğundaki H1/H2/H3 düğmeleriyle (ya da Ctrl+Alt+1/2/3 ile) verin. \"Belge\" → \"Sayfa ayarı\" içindeki \"Başlıkları otomatik numarala\" seçeneği 1., 1.1. numaralarını kendisi verir; elle yazdığınız numaraları kaldırın.",
        en: "Set headings with the H1/H2/H3 buttons on the toolbar (or with Ctrl+Alt+1/2/3). \"Document\" → \"Page setup\" → \"Number headings automatically\" adds 1., 1.1. numbers for you; remove numbers you typed by hand.",
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
        tr: "Kaynakça penceresinde PDF'i olan her kaynakta \"Kaynağa sor\" vardır: makaleye soru sorun (yöntem, örneklem, bulgular). Cevap kaynaktan birebir alıntı ve PDF sayfasıyla gelir; alıntı kaynakta bulunamazsa cevap gösterilmez.",
        en: "In the reference list window, every source with a PDF has \"Ask the source\": ask the paper a question (method, sample, findings). The answer comes with word-for-word quotes and the PDF page; if a quote isn't in the source, the answer is withheld.",
      },
      {
        tr: "Editörde bir cümle seçip araç çubuğundaki \"Kaynak bul\"a basın: önce kütüphanenizde o cümleye yakın kaynaklar, sonra OpenAlex ve Crossref'te gerçek kayıtlar listelenir; \"Ekle ve atıf yap\" kaynağı kütüphanenize ekleyip imlece atıf koyar. Eşleşme başlıktaki ortak sözcüklere dayanır; kaynağın cümleyi desteklediğini okuyarak doğrulayın.",
        en: "Select a sentence in the editor and press \"Find source\" on the toolbar: sources in your library close to that sentence come first, then real records from OpenAlex and Crossref; \"Add and cite\" adds the source to your library and inserts a citation at the cursor. Matching is based on shared title words; confirm by reading that the source supports the sentence.",
      },
      {
        tr: "Atıf stili listesinde yedi yerleşik stilin yanında \"Dergi ya da yayınevi stili ara…\" vardır: Zotero ve Mendeley'in kullandığı 10.800'den fazla dergi stili (Nature, AMA, Elsevier…). Bu stillerde atıf ve künye stilin kendi kuralıyla yazılır; denetim atıf–kaynakça eşleşmesine ve numaralara bakar, künyenin biçimine bakmaz.",
        en: "Next to the seven built-in styles, the citation style list has \"Search journal or publisher styles…\": more than 10,800 journal styles used by Zotero and Mendeley (Nature, AMA, Elsevier…). In these styles citations and references are written by the style's own rules; the check covers citation–reference matching and numbering, not the reference format.",
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
    id: "etik",
    baslik: { tr: "Etik kurul başvurusu", en: "Ethics committee application" },
    ozet: {
      tr: "Çalışmanın \"Etik kurul\" sekmesi başvurunuzu takip eder, kurulun istediği belgeleri listeler ve verinin onaydan önce toplanmadığını denetler.",
      en: "The work's \"Ethics\" tab tracks your application, lists the documents the committee requires and checks that no data is collected before approval.",
    },
    adimlar: [
      {
        tr: "Sekmede \"Durum\"u seçin: etik kurul gerekmiyorsa gerekçesini yazın, gerekiyorsa başvurunun hangi aşamada olduğunu işaretleyin.",
        en: "Choose the \"Status\" in the tab: if approval isn't needed, write why; if it is, mark where your application stands.",
      },
      {
        tr: "\"Yönerge yükle\" ile kurulunuzun başvuru yönergesini yükleyin. Yönergede geçen belgeler listeye eklenir; her birinin altında \"Yönergede ne diyor\" cümlesi durur. Yönergede olmayan bir belgeyi elle ekleyebilirsiniz.",
        en: "Upload your committee's application guideline with \"Upload guideline\". Documents mentioned in it are added to the list, each with \"What the guideline says\". You can add documents that aren't in it by hand.",
      },
      {
        tr: "Her belgeyi \"Eksik\", \"Hazırlanıyor\" ya da \"Hazır\" diye işaretleyip \"Listeyi kaydet\"e basın.",
        en: "Mark each document \"Missing\", \"In progress\" or \"Ready\" and click \"Save list\".",
      },
      {
        tr: "Karar gelince onay tarihini ve karar sayısını, veri toplamaya başladığınızda da başlama tarihini girin.",
        en: "When the decision arrives, enter the approval date and decision number, and the start date once you begin collecting data.",
      },
    ],
    notlar: [
      {
        tr: "Veri toplama onay tarihinden önce başladıysa sekme, Analiz Merkezi ve teslim kontrolü bunu tehlike olarak gösterir: onaydan önce toplanan veri kullanılamaz.",
        en: "If data collection started before the approval date, the tab, the Analysis Center and the submission check flag it as a danger: data collected before approval can't be used.",
      },
      {
        tr: "Teslim kontrolü karar sayısının metninizde geçip geçmediğine bakar; yöntem bölümüne kurul adını, karar tarihini ve sayısını yazın.",
        en: "The submission check looks for the decision number in your text; write the committee name, decision date and number in your method section.",
      },
      {
        tr: "Başvuru formunu, protokolü ve onam formunu siz yazarsınız; ArvoLab bunları yazmaz. Bir uzmanın bakmasını isterseniz Destek'te \"Etik kurul başvurusu\" konusunu seçin.",
        en: "You write the application form, protocol and consent form; ArvoLab doesn't. To have an expert review them, choose the \"Ethics committee application\" topic in Support.",
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
        tr: "\"Word olarak indir\" ya da \"PDF / Yazdır\" (Ctrl+P) ile çıktı alın. Çalışmalarım'daki çalışma kartında \"Teslim paketi (ZIP)\" metni kaynak PDF'leriyle birlikte indirir.",
        en: "Export with \"Download as Word\" or \"PDF / Print\" (Ctrl+P). \"Submission package (ZIP)\" on the work's card in My works downloads the text together with source PDFs.",
      },
      {
        tr: "\"LaTeX\" düğmesi çalışmayı main.tex, kaynaklar.bib ve görsellerle bir ZIP olarak indirir; Overleaf'te \"Yeni proje → ZIP yükle\" ile açılır. Başlık numaraları yazdırmayla aynıdır, kaynakça editördeki biçimiyle gelir.",
        en: "The \"LaTeX\" button downloads the work as a ZIP with main.tex, kaynaklar.bib and the images; open it in Overleaf with \"New project → Upload ZIP\". Heading numbers match the print output; the reference list keeps its editor formatting.",
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
      tr: "Editördeki yazım asistanı sizinle sohbet ederek metin yazar; metne eklemek size kalır. Öteki ekranlardaki asistan bir denetçidir: neyin eksik olduğunu ve neden önemli olduğunu söyler.",
      en: "The writing assistant in the editor writes text with you in a chat; inserting it is up to you. The assistant on the other screens is a reviewer: it tells you what is missing and why it matters.",
    },
    adimlar: [
      {
        tr: "Editörde araç çubuğundaki \"Asistan\" düğmesi yazım asistanını sağda açar. Ne yazmak istediğinizi anlatın ya da metin seçip \"Devam ettir\", \"Akademikleştir\", \"Kısalt\", \"Genişlet\" düğmelerini kullanın.",
        en: "In the editor, the \"Assistant\" button on the toolbar opens the writing assistant on the right. Describe what you want to write, or select text and use \"Continue\", \"Make academic\", \"Shorten\", \"Expand\".",
      },
      {
        tr: "Sağ paneldeki \"Yazım ipuçları\" yazarken kendiliğinden güncellenir: atıfsız iddia (\"çalışmalar göstermektedir\" deyip atıf vermeyen cümle), aşırı kesin dil (\"kanıtlamaktadır\"), kişisel görüş kalıbı (\"bence\") ve çok uzun cümle/paragraf. \"Göster\" metindeki yeri seçer. Yapay zekâ kullanmaz, kredi harcamaz.",
        en: "\"Writing tips\" in the right panel update as you write: uncited claims (a sentence saying \"studies have shown\" with no citation), overstated language (\"proves\"), personal-opinion phrases (\"I think\") and very long sentences/paragraphs. \"Show\" selects the spot in the text. It doesn't use AI or credits.",
      },
      {
        tr: "Sağ paneldeki \"Yazarlık\" kartı gövdenin yüzde kaçının yazım asistanından eklendiğini gösterir; pencerede eklemeler listelenir ve istenirse editörde vurgulanır. Kopyala–yapıştırla alınan metin bu sayıya girmez; bu bir yapay zekâ tespit puanı değildir.",
        en: "The \"Authorship\" card in the right panel shows what percentage of the body was inserted from the writing assistant; the window lists the insertions and can highlight them in the editor. Text taken by copy–paste isn't counted; this is not an AI-detection score.",
      },
      {
        tr: "Satır içi öneri: editörde Alt+/ imlecin önüne gri bir devam önerir; Tab kabul eder, Esc ya da yazmaya devam etmek vazgeçer. Araç çubuğundaki \"Öneri\" açıksa yazma durduğunda öneri kendiliğinden gelir. Her öneri bir asistan hakkı kullanır; öneri de kütüphanenizde olmayan kaynağa atıf yapamaz ve metninizde olmayan sayı yazamaz.",
        en: "Inline suggestions: in the editor, Alt+/ shows a grey continuation at the cursor; Tab accepts, Esc or continuing to type dismisses. With \"Suggest\" on the toolbar turned on, a suggestion appears when you pause. Each suggestion uses one assistant credit; suggestions also can't cite sources outside your library or write numbers that aren't in your text.",
      },
      {
        tr: "Paneldeki \"Ana hat\" kılavuzunuzun zorunlu bölümlerini omurga alarak bir başlık iskeleti ve her başlık altına ne yazılacağına dair kısa notlar önerir; \"İmlece ekle\" ile başlıklar ve köşeli parantezli notlar belgeye girer, notların yerine kendi metninizi yazarsınız.",
        en: "\"Outline\" in the panel proposes a heading skeleton built on your guideline's required sections, with a short note under each heading on what to write; \"Insert at cursor\" adds the headings and bracketed notes, which you replace with your own text.",
      },
      {
        tr: "Asistanın yazdığı metin belgenize kendiliğinden girmez: \"İmlece ekle\", \"Seçilenin yerine koy\" ya da \"Kopyala\" ile siz eklersiniz. Eklemeden önce okuyun ve kendi sözcüklerinizle düzenleyin.",
        en: "Text the assistant writes never enters your document by itself: you insert it with \"Insert at cursor\", \"Replace selection\" or \"Copy\". Read it and edit it in your own words before inserting.",
      },
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
        tr: "Yazım asistanı yalnızca Literatür kütüphanenizdeki kaynaklara atıf yapar; kütüphanede olmayan bir kaynağa atıf yaparsa ya da kaynakça satırı (künye, DOI) yazarsa metin gösterilmez. Kaynak önermez: kaynağı siz eklersiniz.",
        en: "The writing assistant only cites sources in your Literature library; if it cites a source that isn't there or writes a reference entry (author–title, DOI), the text is withheld. It doesn't suggest sources: you add them.",
      },
      {
        tr: "Kurumunuzun ve danışmanınızın yapay zekâ kullanım kurallarına uymak sizin sorumluluğunuzdadır.",
        en: "Following your institution's and advisor's rules on AI use is your responsibility.",
      },
      {
        tr: "Asistanın verdiği her sayı sizin girdinizde geçmek zorundadır; geçmeyen bir değer bulunursa cevabın tamamı gösterilmez.",
        en: "Every number the assistant gives must appear in your input; if one doesn't, the whole answer is withheld.",
      },
      {
        tr: `Kullanım hakkı: saatte en fazla ${SAATLIK_HAK} istek; aylık kredi ve satın alınan ek kredi Abonelik ve Kredi sayfasında görünür.`,
        en: `Usage: at most ${SAATLIK_HAK} requests an hour; your monthly credits and any extra credits you buy are shown on the Subscription and Credits page.`,
      },
      {
        tr: `Ücretsiz deneme süresinde asistanı ${DENEME_ASISTAN_HAKKI} kez kullanabilirsiniz; sonra asistan, aboneliğinizi başlatana kadar kapanır. Editör, kaynaklar ve analiz deneme boyunca açık kalır.`,
        en: `During the free trial you can use the assistant ${DENEME_ASISTAN_HAKKI} times; after that the assistant stays closed until you start your subscription. The editor, sources and analysis stay open throughout the trial.`,
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
        tr: "Şifrenizi \"Değiştir\" ile güncelleyin. Hesabınız aynı anda tek cihazda açık kalır: başka bir cihazdan giriş yapınca öncekindeki oturum uyarıyla kapanır. \"Diğer cihazlar\" → \"Kapat\" aynı işi hemen yapar.",
        en: "Update your password with \"Change\". Your account stays signed in on one device at a time: signing in on another device signs out the previous one with a notice. \"Other devices\" → \"Sign out\" does the same right away.",
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
        tr: "Çalışmalarım'da bir çalışmayı seçince sağdaki kartta öğrencinin gördüğü pencerelerin aynısı açılır: kılavuz, literatür, kaynakça, kanıt matrisi, etik kurul ve analiz. Teslim hazırlığı da orada.",
        en: "Selecting a work in My works shows, on the right, the same windows the student sees: guideline, literature, references, evidence matrix, ethics and analysis. Submission readiness is there too.",
      },
      {
        tr: "Ana Sayfa'daki \"Etik kurul sorunu\" maddesi, verisi onaydan önce toplanmış ya da başvurusu reddedilmiş çalışmaları açar; listede bu çalışmalar kırmızı kalkanla işaretlidir.",
        en: "The \"Ethics approval problem\" item on Home opens works whose data was collected before approval or whose application was rejected; in the list they carry a red shield.",
      },
      {
        tr: "Çalışmanın durumunu \"Çalışma ayarları\"ndan değiştirebilirsiniz (Kontrolör ve üstü).",
        en: "You can change a work's status from \"Work settings\" (Controller and above).",
      },
    ],
    notlar: [
      {
        tr: "Doçentlik Puanı aracı gezinmede \"Diğer\" başlığının altında (tablet ve telefonda \"Daha fazla\"da) durur; ÜAK duyurusunun yerini tutmaz.",
        en: "The Associate Professorship Score tool is under \"More\" in the navigation; it does not replace the official ÜAK announcement.",
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
        tr: "\"Diğer\" → \"Ekip Yönetimi\"nde \"Kurum ekle\" ve \"Kullanıcı davet et\" ile hesap açın; rol ve kurumu satırdan kaydedin.",
        en: "In \"More\" → \"Team Management\", open accounts with \"Add institution\" and \"Invite user\"; save role and institution on each row.",
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
      tr: "Evet. Editördeki kılavuz penceresinde \"Kılavuzu değiştir\"e basın (ya da Çalışmalarım'da çalışmanın \"Kılavuz\" penceresini açın), yeni dosyayı yükleyip kuralları onaylayın. Kurumunuzun onaylı kılavuzu bağlı olsa da yüklediğiniz kılavuz onun yerine geçer; kaldırırsanız onaylı olan geri gelir.",
      en: "Yes. Click \"Change guideline\" in the editor's guideline window (or open the work's \"Guideline\" window in My works), upload the new file and approve the rules. Even if your institution's approved guideline is linked, the one you upload replaces it; remove yours and the approved one applies again.",
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
    soru: { tr: "Deneme süresi nasıl işliyor?", en: "How does the trial work?" },
    cevap: {
      tr: `Kayıt olduğunuzda ücretsiz deneme kendiliğinden başlar; bütün ekranlar açıktır, asistanı ${DENEME_ASISTAN_HAKKI} kez kullanabilirsiniz. Süre bitmeden bir gün önce ve bittiğinde e-posta ve panel bildirimi alırsınız. Ödeme yapmazsanız çalışma ekranlarına erişim durur, verileriniz silinmez.`,
      en: `The free trial starts automatically when you sign up; every screen is open and you can use the assistant ${DENEME_ASISTAN_HAKKI} times. You get an email and a panel notification one day before it ends and when it ends. If you don't pay, access to the working screens stops; your data is not deleted.`,
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
  Yeni çalışma herkes için Çalışmalarım'daki pencerede (?yeni=1). Eskiden
  gözetim rolleri ayrı sayfaya (editor/new) gidiyordu; 02.11.2026'dan beri
  personelin tam formu da pencerede (personel-yeni-calisma-penceresi.tsx),
  eski adres buraya yönlendiriyor.
*/
const YENI_CALISMA_ADRESI = "/dashboard/editor?yeni=1";

/** Kullanıcının rolüne göre görünen bölümler. Rolü bilinmeyen yalnızca herkese açık bölümleri görür. */
export function kilavuzBolumleri(rol: string | null | undefined): KilavuzBolumu[] {
  return BOLUMLER.filter((b) => !b.roller || (!!rol && b.roller.includes(rol))).map((b) =>
    b.id === "ilk-calisma" && b.baglanti ? { ...b, baglanti: { ...b.baglanti, href: YENI_CALISMA_ADRESI } } : b,
  );
}

export function kilavuzSorulari(): KilavuzSorusu[] {
  return SORULAR;
}

/** Testler için: süzülmemiş tam liste. */
export const TUM_BOLUMLER: readonly KilavuzBolumu[] = BOLUMLER;

