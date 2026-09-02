import type { Locale } from '@/utils/i18n/types';

/**
 * Textos del embudo de venta, por idioma.
 *
 * Viven aquí y no en `utils/i18n/dictionaries/*` porque son una pieza de
 * marketing que se edita como bloque: cuando cambia la oferta cambian el
 * titular, las viñetas y el FAQ a la vez. Repartirlos entre seis diccionarios
 * generales obligaría a saltar de fichero para cada ajuste de copy.
 *
 * La página los resuelve en servidor con la cookie de idioma y los baja por
 * props. No se usa `useLanguage()` en los componentes de cliente a propósito:
 * ese contexto se inicializa en el navegador, así que el servidor podría
 * pintar un idioma y el cliente otro durante un instante, justo en la página
 * que más importa que se vea bien a la primera.
 *
 * `leader` y `follower` se dejan sin traducir en los idiomas latinos: es como
 * se nombran los roles en la escena de baile social, y traducirlos confundiría
 * a quien ya baila.
 */

type Testimonio = { quote: string; author: string };
type Pregunta = { q: string; a: string };

export type LandingCopy = {
  hero: { h1: string; sub: string; cta: string; micro: string; secondary: string; haveAccount: string; login: string };
  sticky: { brand: string; cta: string };
  pain: { title: string; items: readonly string[]; promise: string };
  learn: { title: string; subtitle: string; summary: string };
  method: { title: string; body: string };
  bio: { title: string; body: string };
  testimonials: { title: string; items: readonly Testimonio[] };
  freeClass: { title: string; body: string; cta: string; trust: readonly string[] };
  offer: { title: string; includes: readonly string[]; priceNote: string; cta: string };
  faq: readonly Pregunta[];
  finalCta: { title: string; cta: string };
};

const es: LandingCopy = {
  hero: {
    h1: 'Baila bachatango como nunca imaginaste',
    sub: 'El método completo de Luis y Sara para dominar la técnica, la conexión y la musicalidad — a tu ritmo, desde casa.',
    cta: 'Empieza ahora',
    micro: 'Pago único · Acceso de por vida · Pago seguro con Stripe',
    secondary: 'Prueba una clase gratis',
    haveAccount: '¿Ya tienes cuenta?',
    login: 'Inicia sesión',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Comprar' },
  pain: {
    title: '¿Te suena esto?',
    items: [
      '¿Te trabas con las figuras y pierdes el hilo?',
      '¿No terminas de conectar con tu pareja?',
      '¿Sientes que no marcas el tiempo de la música?',
    ],
    promise: 'Este curso te lleva de la frustración a bailar con seguridad, estilo y disfrute.',
  },
  learn: {
    title: 'Qué vas a aprender',
    // El detalle sale de la BD (utils/courses/curriculum.ts): son los módulos
    // reales del curso. Antes había seis viñetas genéricas que valdrían para
    // cualquier curso de baile y no probaban que este existiera.
    subtitle: 'El temario completo, módulo a módulo.',
    summary: '{modules} módulos · {lessons} lecciones · {duration}',
  },
  method: {
    title: 'El método Luis y Sara',
    body: 'Cada movimiento desglosado y explicado desde una base sólida, estudiada y probada, con práctica guiada y una progresión pensada para que interiorices sin frustrarte. No son clases sueltas: es un camino completo.',
  },
  bio: {
    title: 'Quiénes son Luis y Sara',
    body: 'Instructores internacionales de bailes de salón, latinos y bachatango. Años formando bailarines dentro y fuera de la pista, con un método propio que ahora tienes a tu alcance desde casa.',
  },
  testimonials: {
    title: 'Lo que dicen sus alumnos',
    items: [
      { quote: 'En dos meses noté un cambio brutal en mi conexión y mi tiempo.', author: 'María, Madrid' },
      { quote: 'Por fin entiendo la música y no solo cuento pasos.', author: 'Javier, Valencia' },
      { quote: 'El método es clarísimo. Cada clase suma.', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'Empieza sin riesgo',
    body: 'Prueba una clase gratis antes de decidir. Sin tarjeta, sin compromiso.',
    cta: 'Ver clase gratis',
    trust: ['Pago seguro con Stripe', 'Acceso de por vida', 'Comunidad de bailarines'],
  },
  offer: {
    title: 'CURSO BACHATANGO completo',
    includes: [
      'Todas las lecciones en vídeo HD',
      'Técnica, figuras, musicalidad y estilo',
      'Acceso de por vida y actualizaciones',
      'Comunidad privada de alumnos',
    ],
    priceNote: 'Pago único · Acceso de por vida',
    cta: 'Comprar ahora',
  },
  faq: [
    { q: '¿Necesito pareja?', a: 'No. El curso enseña tanto el rol de LIDER como el de FOLLOWER; puedes practicar solo/a y aplicarlo en pareja después.' },
    { q: '¿Qué nivel necesito?', a: 'Nivel básico de bachata. Empieza desde cero y progresa hasta nivel avanzado.' },
    { q: '¿En qué dispositivos lo veo?', a: 'En cualquier dispositivo con navegador: móvil, tablet u ordenador.' },
    { q: '¿Cuánto dura el acceso?', a: 'Acceso de por vida. Compras una vez y es tuyo para siempre.' },
    { q: '¿Es seguro el pago?', a: 'Sí. El pago se procesa con Stripe; no almacenamos datos de tu tarjeta.' },
    { q: '¿Puedo empezar sin experiencia?', a: 'Totalmente. El método está diseñado para llevarte de la mano desde el primer paso.' },
  ],
  finalCta: { title: 'Tu mejor versión bailando empieza hoy', cta: 'Comprar el curso' },
};

const en: LandingCopy = {
  hero: {
    h1: 'Dance bachatango like you never imagined',
    sub: "Luis and Sara's complete method for mastering technique, connection and musicality — at your own pace, from home.",
    cta: 'Start now',
    micro: 'One-time payment · Lifetime access · Secure payment with Stripe',
    secondary: 'Try a free class',
    haveAccount: 'Already have an account?',
    login: 'Log in',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Buy' },
  pain: {
    title: 'Sound familiar?',
    items: [
      'Do you stumble through the figures and lose your thread?',
      'Do you never quite connect with your partner?',
      'Do you feel you are not hitting the beat?',
    ],
    promise: 'This course takes you from frustration to dancing with confidence, style and joy.',
  },
  learn: {
    title: 'What you will learn',
    subtitle: 'The full syllabus, module by module.',
    summary: '{modules} modules · {lessons} lessons · {duration}',
  },
  method: {
    title: 'The Luis y Sara method',
    body: 'Every movement broken down and explained from a solid, studied and tested foundation, with guided practice and a progression designed so it sinks in without frustrating you. These are not scattered classes: it is a complete path.',
  },
  bio: {
    title: 'Who Luis and Sara are',
    body: 'International instructors of ballroom, Latin and bachatango. Years training dancers on and off the floor, with a method of their own that you can now follow from home.',
  },
  testimonials: {
    title: 'What their students say',
    items: [
      { quote: 'In two months I noticed a huge change in my connection and my timing.', author: 'María, Madrid' },
      { quote: 'I finally understand the music instead of just counting steps.', author: 'Javier, Valencia' },
      { quote: 'The method is crystal clear. Every class adds something.', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'Start with no risk',
    body: 'Try a free class before you decide. No card, no commitment.',
    cta: 'Watch the free class',
    trust: ['Secure payment with Stripe', 'Lifetime access', 'A community of dancers'],
  },
  offer: {
    title: 'The complete CURSO BACHATANGO',
    includes: [
      'Every lesson in HD video',
      'Technique, figures, musicality and style',
      'Lifetime access and updates',
      'Private student community',
    ],
    priceNote: 'One-time payment · Lifetime access',
    cta: 'Buy now',
  },
  faq: [
    { q: 'Do I need a partner?', a: 'No. The course teaches both the leader and the follower role; you can practise on your own and apply it with a partner later.' },
    { q: 'What level do I need?', a: 'Basic bachata level. It starts from the ground up and progresses to advanced.' },
    { q: 'What devices can I watch it on?', a: 'Any device with a browser: phone, tablet or computer.' },
    { q: 'How long does access last?', a: 'Lifetime access. You buy once and it is yours for good.' },
    { q: 'Is the payment secure?', a: 'Yes. Payment is processed by Stripe; we never store your card details.' },
    { q: 'Can I start with no experience?', a: 'Absolutely. The method is designed to take you by the hand from the very first step.' },
  ],
  finalCta: { title: 'Your best dancing self starts today', cta: 'Buy the course' },
};

const fr: LandingCopy = {
  hero: {
    h1: 'Dansez le bachatango comme vous ne l’aviez jamais imaginé',
    sub: 'La méthode complète de Luis et Sara pour maîtriser la technique, la connexion et la musicalité — à votre rythme, depuis chez vous.',
    cta: 'Commencer',
    micro: 'Paiement unique · Accès à vie · Paiement sécurisé avec Stripe',
    secondary: 'Essayer un cours gratuit',
    haveAccount: 'Vous avez déjà un compte ?',
    login: 'Se connecter',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Acheter' },
  pain: {
    title: 'Ça vous parle ?',
    items: [
      'Vous bloquez sur les figures et perdez le fil ?',
      'Vous n’arrivez pas vraiment à connecter avec votre partenaire ?',
      'Vous avez l’impression de ne pas être dans le tempo ?',
    ],
    promise: 'Ce cours vous mène de la frustration à une danse sûre, élégante et joyeuse.',
  },
  learn: {
    title: 'Ce que vous allez apprendre',
    subtitle: 'Le programme complet, module par module.',
    summary: '{modules} modules · {lessons} leçons · {duration}',
  },
  method: {
    title: 'La méthode Luis y Sara',
    body: 'Chaque mouvement décomposé et expliqué à partir d’une base solide, étudiée et éprouvée, avec une pratique guidée et une progression pensée pour intégrer sans se décourager. Ce ne sont pas des cours isolés : c’est un parcours complet.',
  },
  bio: {
    title: 'Qui sont Luis et Sara',
    body: 'Professeurs internationaux de danses de salon, latines et bachatango. Des années à former des danseurs sur la piste et en dehors, avec une méthode qui leur est propre, désormais accessible depuis chez vous.',
  },
  testimonials: {
    title: 'Ce que disent leurs élèves',
    items: [
      { quote: 'En deux mois, ma connexion et mon timing ont énormément changé.', author: 'María, Madrid' },
      { quote: 'Je comprends enfin la musique au lieu de simplement compter les pas.', author: 'Javier, Valencia' },
      { quote: 'La méthode est limpide. Chaque cours apporte quelque chose.', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'Commencez sans risque',
    body: 'Essayez un cours gratuit avant de décider. Sans carte, sans engagement.',
    cta: 'Voir le cours gratuit',
    trust: ['Paiement sécurisé avec Stripe', 'Accès à vie', 'Une communauté de danseurs'],
  },
  offer: {
    title: 'CURSO BACHATANGO complet',
    includes: [
      'Toutes les leçons en vidéo HD',
      'Technique, figures, musicalité et style',
      'Accès à vie et mises à jour',
      'Communauté privée d’élèves',
    ],
    priceNote: 'Paiement unique · Accès à vie',
    cta: 'Acheter maintenant',
  },
  faq: [
    { q: 'Ai-je besoin d’un partenaire ?', a: 'Non. Le cours enseigne le rôle de leader comme celui de follower ; vous pouvez travailler seul(e) puis l’appliquer en couple.' },
    { q: 'Quel niveau faut-il ?', a: 'Un niveau de base en bachata. Le cours part de zéro et progresse jusqu’au niveau avancé.' },
    { q: 'Sur quels appareils puis-je le suivre ?', a: 'Sur tout appareil doté d’un navigateur : téléphone, tablette ou ordinateur.' },
    { q: 'Combien de temps dure l’accès ?', a: 'Accès à vie. Vous achetez une fois et c’est à vous pour toujours.' },
    { q: 'Le paiement est-il sécurisé ?', a: 'Oui. Le paiement est traité par Stripe ; nous ne conservons aucune donnée de votre carte.' },
    { q: 'Puis-je commencer sans expérience ?', a: 'Tout à fait. La méthode est conçue pour vous accompagner dès le premier pas.' },
  ],
  finalCta: { title: 'Votre meilleure version en danse commence aujourd’hui', cta: 'Acheter le cours' },
};

const de: LandingCopy = {
  hero: {
    h1: 'Tanze Bachatango, wie du es nie für möglich gehalten hast',
    sub: 'Die komplette Methode von Luis und Sara für Technik, Verbindung und Musikalität — in deinem Tempo, von zu Hause aus.',
    cta: 'Jetzt starten',
    micro: 'Einmalzahlung · Lebenslanger Zugang · Sichere Zahlung mit Stripe',
    secondary: 'Kostenlose Stunde testen',
    haveAccount: 'Du hast schon ein Konto?',
    login: 'Anmelden',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Kaufen' },
  pain: {
    title: 'Kommt dir das bekannt vor?',
    items: [
      'Du kommst bei den Figuren ins Stocken und verlierst den Faden?',
      'Die Verbindung zu deinem Partner will nicht recht entstehen?',
      'Du hast das Gefühl, den Takt nicht zu treffen?',
    ],
    promise: 'Dieser Kurs bringt dich von der Frustration zu sicherem, stilvollem Tanzen mit Freude.',
  },
  learn: {
    title: 'Was du lernen wirst',
    subtitle: 'Der komplette Lehrplan, Modul für Modul.',
    summary: '{modules} Module · {lessons} Lektionen · {duration}',
  },
  method: {
    title: 'Die Methode von Luis y Sara',
    body: 'Jede Bewegung aufgeschlüsselt und erklärt, auf einer soliden, durchdachten und erprobten Grundlage, mit angeleiteter Übung und einem Aufbau, der dich verinnerlichen lässt, ohne zu frustrieren. Das sind keine einzelnen Stunden, sondern ein vollständiger Weg.',
  },
  bio: {
    title: 'Wer Luis und Sara sind',
    body: 'Internationale Lehrer für Gesellschafts-, Latein- und Bachatango-Tanz. Seit Jahren bilden sie Tänzerinnen und Tänzer auf und neben der Fläche aus — mit einer eigenen Methode, die du jetzt von zu Hause aus nutzen kannst.',
  },
  testimonials: {
    title: 'Was ihre Schüler sagen',
    items: [
      { quote: 'In zwei Monaten hat sich meine Verbindung und mein Timing enorm verändert.', author: 'María, Madrid' },
      { quote: 'Endlich verstehe ich die Musik, statt nur Schritte zu zählen.', author: 'Javier, Valencia' },
      { quote: 'Die Methode ist glasklar. Jede Stunde bringt etwas.', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'Fang ohne Risiko an',
    body: 'Teste eine kostenlose Stunde, bevor du dich entscheidest. Ohne Karte, ohne Verpflichtung.',
    cta: 'Kostenlose Stunde ansehen',
    trust: ['Sichere Zahlung mit Stripe', 'Lebenslanger Zugang', 'Eine Community von Tanzenden'],
  },
  offer: {
    title: 'CURSO BACHATANGO komplett',
    includes: [
      'Alle Lektionen als HD-Video',
      'Technik, Figuren, Musikalität und Stil',
      'Lebenslanger Zugang und Aktualisierungen',
      'Private Community für Teilnehmende',
    ],
    priceNote: 'Einmalzahlung · Lebenslanger Zugang',
    cta: 'Jetzt kaufen',
  },
  faq: [
    { q: 'Brauche ich einen Partner?', a: 'Nein. Der Kurs vermittelt sowohl die Leader- als auch die Follower-Rolle; du kannst allein üben und es später zu zweit anwenden.' },
    { q: 'Welches Niveau brauche ich?', a: 'Bachata-Grundkenntnisse. Der Kurs beginnt bei null und führt bis zum fortgeschrittenen Niveau.' },
    { q: 'Auf welchen Geräten kann ich zusehen?', a: 'Auf jedem Gerät mit Browser: Handy, Tablet oder Computer.' },
    { q: 'Wie lange gilt der Zugang?', a: 'Lebenslang. Einmal kaufen und er gehört dir für immer.' },
    { q: 'Ist die Zahlung sicher?', a: 'Ja. Die Zahlung wird über Stripe abgewickelt; wir speichern keine Kartendaten.' },
    { q: 'Kann ich ohne Vorkenntnisse anfangen?', a: 'Auf jeden Fall. Die Methode nimmt dich vom ersten Schritt an bei der Hand.' },
  ],
  finalCta: { title: 'Deine beste Version auf der Tanzfläche beginnt heute', cta: 'Kurs kaufen' },
};

const it: LandingCopy = {
  hero: {
    h1: 'Balla il bachatango come non avresti mai immaginato',
    sub: 'Il metodo completo di Luis e Sara per padroneggiare tecnica, connessione e musicalità — al tuo ritmo, da casa.',
    cta: 'Inizia ora',
    micro: 'Pagamento unico · Accesso a vita · Pagamento sicuro con Stripe',
    secondary: 'Prova una lezione gratis',
    haveAccount: 'Hai già un account?',
    login: 'Accedi',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Acquista' },
  pain: {
    title: 'Ti suona familiare?',
    items: [
      'Ti blocchi sulle figure e perdi il filo?',
      'Non riesci a connetterti davvero con il tuo partner?',
      'Hai la sensazione di non andare a tempo?',
    ],
    promise: 'Questo corso ti porta dalla frustrazione a ballare con sicurezza, stile e piacere.',
  },
  learn: {
    title: 'Che cosa imparerai',
    subtitle: 'Il programma completo, modulo per modulo.',
    summary: '{modules} moduli · {lessons} lezioni · {duration}',
  },
  method: {
    title: 'Il metodo Luis y Sara',
    body: 'Ogni movimento scomposto e spiegato da una base solida, studiata e collaudata, con pratica guidata e una progressione pensata per farti interiorizzare senza frustrazione. Non sono lezioni sparse: è un percorso completo.',
  },
  bio: {
    title: 'Chi sono Luis e Sara',
    body: 'Insegnanti internazionali di balli da sala, latini e bachatango. Anni a formare ballerini dentro e fuori dalla pista, con un metodo tutto loro che ora puoi seguire da casa.',
  },
  testimonials: {
    title: 'Cosa dicono i loro allievi',
    items: [
      { quote: 'In due mesi ho notato un cambiamento enorme nella connessione e nel tempo.', author: 'María, Madrid' },
      { quote: 'Finalmente capisco la musica invece di contare solo i passi.', author: 'Javier, Valencia' },
      { quote: 'Il metodo è chiarissimo. Ogni lezione aggiunge qualcosa.', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'Inizia senza rischi',
    body: 'Prova una lezione gratis prima di decidere. Senza carta, senza impegno.',
    cta: 'Guarda la lezione gratis',
    trust: ['Pagamento sicuro con Stripe', 'Accesso a vita', 'Una comunità di ballerini'],
  },
  offer: {
    title: 'CURSO BACHATANGO completo',
    includes: [
      'Tutte le lezioni in video HD',
      'Tecnica, figure, musicalità e stile',
      'Accesso a vita e aggiornamenti',
      'Comunità privata di allievi',
    ],
    priceNote: 'Pagamento unico · Accesso a vita',
    cta: 'Acquista ora',
  },
  faq: [
    { q: 'Mi serve un partner?', a: 'No. Il corso insegna sia il ruolo di leader sia quello di follower; puoi esercitarti da solo/a e applicarlo in coppia più avanti.' },
    { q: 'Che livello serve?', a: 'Livello base di bachata. Si parte da zero e si arriva al livello avanzato.' },
    { q: 'Su quali dispositivi posso vederlo?', a: 'Su qualsiasi dispositivo con un browser: telefono, tablet o computer.' },
    { q: 'Quanto dura l’accesso?', a: 'Accesso a vita. Acquisti una volta ed è tuo per sempre.' },
    { q: 'Il pagamento è sicuro?', a: 'Sì. Il pagamento è gestito da Stripe; non conserviamo i dati della tua carta.' },
    { q: 'Posso iniziare senza esperienza?', a: 'Assolutamente. Il metodo è pensato per accompagnarti dal primo passo.' },
  ],
  finalCta: { title: 'La tua versione migliore in pista inizia oggi', cta: 'Acquista il corso' },
};

const ja: LandingCopy = {
  hero: {
    h1: '想像を超えるバチャタンゴを踊る',
    sub: 'テクニック、コネクション、音楽性を身につけるためのルイス＆サラの完全メソッド。自宅で、自分のペースで。',
    cta: 'はじめる',
    micro: '買い切り · 生涯アクセス · Stripeによる安全な決済',
    secondary: '無料レッスンを試す',
    haveAccount: 'すでにアカウントをお持ちですか',
    login: 'ログイン',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: '購入' },
  pain: {
    title: 'こんな悩みはありませんか',
    items: [
      'フィガーでつまずいて、流れを見失っていませんか',
      'パートナーとうまくつながれていないと感じませんか',
      '音楽のタイミングに乗れていないと感じませんか',
    ],
    promise: 'このコースは、もどかしさから自信・スタイル・楽しさをもって踊れる状態へと導きます。',
  },
  learn: {
    title: '学べる内容',
    subtitle: 'カリキュラム全体を、モジュールごとに。',
    summary: '{modules}モジュール · {lessons}レッスン · {duration}',
  },
  method: {
    title: 'ルイス＆サラのメソッド',
    body: 'すべての動きを、確かな理論と実践に裏づけられた土台から分解して解説します。ガイド付きの練習と、無理なく身につくよう設計された段階構成。単発のレッスンではなく、ひとつづきの道のりです。',
  },
  bio: {
    title: 'ルイスとサラについて',
    body: '社交ダンス、ラテン、バチャタンゴの国際的なインストラクター。フロアの内外で長年ダンサーを育ててきた独自のメソッドを、自宅から学べます。',
  },
  testimonials: {
    title: '受講生の声',
    items: [
      { quote: '2か月でコネクションとタイミングが大きく変わりました。', author: 'María, Madrid' },
      { quote: 'ステップを数えるだけでなく、ようやく音楽が理解できました。', author: 'Javier, Valencia' },
      { quote: 'メソッドがとても明快です。毎回のレッスンに発見があります。', author: 'Lucía, Sevilla' },
    ],
  },
  freeClass: {
    title: 'リスクなしではじめる',
    body: '決める前に無料レッスンをお試しください。カード登録も、義務もありません。',
    cta: '無料レッスンを見る',
    trust: ['Stripeによる安全な決済', '生涯アクセス', 'ダンサーのコミュニティ'],
  },
  offer: {
    title: 'CURSO BACHATANGO 完全版',
    includes: [
      '全レッスンをHD動画で',
      'テクニック、フィガー、音楽性、スタイル',
      '生涯アクセスと今後の更新',
      '受講生限定のコミュニティ',
    ],
    priceNote: '買い切り · 生涯アクセス',
    cta: '今すぐ購入',
  },
  faq: [
    { q: 'パートナーは必要ですか', a: 'いいえ。リーダーとフォロワーの両方の役割を学べます。ひとりで練習し、あとからペアで活かせます。' },
    { q: 'どのくらいのレベルが必要ですか', a: 'バチャタの基礎レベルです。ゼロから始めて上級まで進みます。' },
    { q: 'どの端末で見られますか', a: 'ブラウザのある端末ならどれでも。スマートフォン、タブレット、パソコン。' },
    { q: 'アクセス期間はどのくらいですか', a: '生涯アクセスです。一度購入すれば、ずっとご利用いただけます。' },
    { q: '決済は安全ですか', a: 'はい。決済はStripeが処理し、カード情報を当方で保存することはありません。' },
    { q: '未経験でも始められますか', a: 'もちろんです。最初の一歩から手を取って進める設計になっています。' },
  ],
  finalCta: { title: '踊るあなたの最高の姿は、今日から', cta: 'コースを購入する' },
};

const POR_IDIOMA: Record<Locale, LandingCopy> = { es, en, fr, de, it, ja };

/** Devuelve el copy del idioma pedido; español si no hubiera traducción. */
export function getLandingCopy(locale: Locale): LandingCopy {
  return POR_IDIOMA[locale] ?? es;
}

/**
 * Español, para los pocos sitios que aún no reciben el idioma por props.
 * @deprecated Usa `getLandingCopy(locale)`.
 */
export const LANDING_COPY = es;
