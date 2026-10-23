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

type Pregunta = { q: string; a: string };

export type LandingCopy = {
  hero: {
    h1: string;
    // `sub` lleva las cifras del temario y se resuelve en servidor (el hero es
    // de cliente); `subFallback` es para cuando la BD no responde.
    sub: string;
    subFallback: string;
    cta: string;
    micro: string;
    secondary: string;
    haveAccount: string;
    login: string;
  };
  sticky: { brand: string; cta: string; freeEmail: string };
  // Formulario «dos clases más por email», bajo la clase gratis (T3.1).
  freeEmail: {
    title: string;
    body: string;
    emailLabel: string;
    placeholder: string;
    consent: string;
    cta: string;
    sending: string;
    success: string;
    errors: Record<'invalid_email' | 'consent_required' | 'rate_limit' | 'server_error', string>;
  };
  learn: { title: string; subtitle: string; summary: string };
  method: { title: string; body: string };
  // Hechos concretos y comprobables, no adjetivos. Sustituye a la antigua bio
  // («instructores internacionales…»), que valía para cualquier profesor.
  authority: { title: string; body: string };
  // Solo el título: las citas salen de `landing_testimonials`, las mismas que
  // pinta la home (utils/landing/content.ts).
  testimonials: { title: string };
  freeClass: { title: string; body: string; cta: string; trust: readonly string[] };
  offer: {
    title: string;
    // Primera viñeta de la oferta. Lleva `{lessons}`, que se rellena con el
    // temario real; el fallback es para cuando la BD no responde.
    lessonsIncluded: string;
    lessonsIncludedFallback: string;
    includes: readonly string[];
    priceNote: string;
    cta: string;
    before: string;
    spotsLeft: string;
  };
  faqTitle: string;
  // Una respuesta con `{modules}`, `{lessons}` o `{duration}` se rellena con el
  // temario; si la BD no responde, esa pregunta no se pinta.
  faq: readonly Pregunta[];
  finalCta: { title: string; cta: string };
  // Página privada `/clase-gratis/mas`, con las dos clases que llegan por email.
  extraClasses: { title: string; lead: string; unavailable: string; ctaTitle: string; ctaBody: string; cta: string };
};

const es: LandingCopy = {
  hero: {
    // D7: llegaron los dos a la final de la 1.ª edición (Telecinco, 2024) y
    // ganó Luis. «Los ganadores», en plural, no sería exacto.
    h1: 'Aprende bachatango con los finalistas de Bailando con las Estrellas',
    sub: '{modules} módulos, {lessons} lecciones en vídeo, {duration}. Aprendes el rol de leader y el de follower, así que puedes empezar sin pareja.',
    subFallback: 'El curso completo en vídeo. Aprendes el rol de leader y el de follower, así que puedes empezar sin pareja.',
    cta: 'Empieza ahora',
    micro: 'Pago único · Acceso de por vida · Pago seguro con Stripe',
    secondary: 'Prueba una clase gratis',
    haveAccount: '¿Ya tienes cuenta?',
    login: 'Inicia sesión',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Comprar', freeEmail: 'Clase gratis por email' },
  freeEmail: {
    title: '¿Te ha gustado? Te mandamos dos clases más',
    body: 'La de posturas y la del segundo básico, gratis en tu correo.',
    emailLabel: 'Tu email',
    placeholder: 'tu@email.com',
    consent: 'Quiero recibir las clases y emails de Luis y Sara. Puedo darme de baja cuando quiera.',
    cta: 'Quiero las dos clases',
    sending: 'Enviando…',
    success: 'Hecho. Revisa tu correo: te acabamos de mandar las dos clases.',
    errors: {
      invalid_email: 'Revisa el email: no parece válido.',
      consent_required: 'Marca la casilla para que podamos mandarte las clases.',
      rate_limit: 'Has hecho varios intentos seguidos. Espera un rato y vuelve a probar.',
      server_error: 'No hemos podido apuntarte. Inténtalo de nuevo en un momento.',
    },
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
  authority: {
    title: 'Quiénes son Luis y Sara',
    body: 'Luis y Sara bailan juntos desde 2002, cuando tenían 9 años. Luis ganó la primera edición de Bailando con las Estrellas (Telecinco, 2024) y Sara llegó a la final. Son campeones internacionales de bailes de salón. Han bailado junto a Il Divo, Gente de Zona y Diego Torres, y en galas como los Premios Platino. Sara es licenciada en Pedagogía de la Danza y Luis es Juez Nacional de Baile Deportivo. Desde 2020 dirigen su propia escuela.',
  },
  testimonials: { title: 'Lo que dicen sus alumnos' },
  freeClass: {
    title: 'Empieza sin riesgo',
    body: 'Prueba una clase gratis antes de decidir. Sin tarjeta, sin compromiso.',
    cta: 'Ver clase gratis',
    trust: ['Pago seguro con Stripe', 'Acceso de por vida'],
  },
  offer: {
    title: 'CURSO BACHATANGO completo',
    lessonsIncluded: '{lessons} lecciones en vídeo HD',
    lessonsIncludedFallback: 'Todas las lecciones en vídeo HD',
    includes: [
      'Cada combinación explicada y después bailada con música',
      'Acceso de por vida, en móvil y ordenador',
      'Certificado al completar el curso',
    ],
    priceNote: 'Pago único · Acceso de por vida',
    before: 'Antes',
    spotsLeft: 'Quedan {n} plazas disponibles',
    cta: 'Comprar ahora',
  },
  faqTitle: 'Preguntas frecuentes',
  faq: [
    { q: '¿Necesito pareja?', a: 'No. El curso enseña tanto el rol de LIDER como el de FOLLOWER; puedes practicar solo/a y aplicarlo en pareja después.' },
    // Misma respuesta que la FAQ de la home (`landing_faq`): antes había aquí
    // dos preguntas sobre el nivel que se contradecían entre sí y con ella.
    { q: '¿Qué nivel necesito?', a: 'Ninguno. El curso empieza desde cero y avanza paso a paso. Si ya bailas bachata o tango partirás con ventaja, pero no es un requisito: lo único que damos por hecho es que quieres aprender.' },
    { q: '¿Me sirve si ya bailo bachata?', a: 'Sí, y partirás con ventaja. El bachatango tiene su propia técnica, así que el curso empieza por la postura y los básicos antes de llegar a los combos: no te saltas nada, pero lo que ya sabes de bachata te hará avanzar más rápido.' },
    { q: '¿Cuánto dura el curso?', a: '{modules} módulos y {lessons} lecciones en vídeo, {duration} en total. Lo ves a tu ritmo y puedes repetir cada lección las veces que quieras.' },
    { q: '¿En qué dispositivos lo veo?', a: 'En cualquier dispositivo con navegador: móvil, tablet u ordenador.' },
    { q: '¿Cuánto dura el acceso?', a: 'Acceso de por vida. Compras una vez y es tuyo para siempre.' },
    { q: '¿Es seguro el pago?', a: 'Sí. El pago se procesa con Stripe; no almacenamos datos de tu tarjeta.' },
  ],
  finalCta: { title: 'Empieza hoy con la lección 1', cta: 'Comprar el curso' },
  extraClasses: {
    title: 'Tus dos clases',
    lead: 'Dos lecciones del CURSO BACHATANGO para practicar en casa. Empieza por la de posturas: es la base de todo lo demás.',
    unavailable: 'Ahora mismo no podemos mostrar las clases. Vuelve a abrir el enlace del correo dentro de un rato.',
    ctaTitle: '¿Seguimos?',
    ctaBody: 'El curso completo sigue desde aquí, módulo a módulo: el resto de básicos y las combinaciones, cada una explicada y después bailada con música.',
    cta: 'Ver el curso completo',
  },
};

const en: LandingCopy = {
  hero: {
    h1: 'Learn bachatango with the finalists of Bailando con las Estrellas',
    sub: '{modules} modules, {lessons} video lessons, {duration}. You learn both the leader and the follower role, so you can start without a partner.',
    subFallback: 'The complete course on video. You learn both the leader and the follower role, so you can start without a partner.',
    cta: 'Start now',
    micro: 'One-time payment · Lifetime access · Secure payment with Stripe',
    secondary: 'Try a free class',
    haveAccount: 'Already have an account?',
    login: 'Log in',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Buy', freeEmail: 'Free class by email' },
  freeEmail: {
    title: "Enjoyed it? We'll send you two more classes",
    body: 'The posture class and the second basic step, free in your inbox (in Spanish, like the course).',
    emailLabel: 'Your email',
    placeholder: 'you@email.com',
    consent: 'I want to receive the classes and emails from Luis and Sara. I can unsubscribe at any time.',
    cta: 'Send me the two classes',
    sending: 'Sending…',
    success: 'Done. Check your inbox: we have just sent you the two classes.',
    errors: {
      invalid_email: 'Check your email address: it does not look valid.',
      consent_required: 'Tick the box so we can send you the classes.',
      rate_limit: 'Too many attempts in a row. Wait a little and try again.',
      server_error: "We couldn't sign you up. Please try again in a moment.",
    },
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
  authority: {
    title: 'Who Luis and Sara are',
    body: "Luis and Sara have danced together since 2002, when they were 9. Luis won the first season of Bailando con las Estrellas, Spain's Dancing with the Stars (Telecinco, 2024), and Sara reached the final. They are international ballroom champions. They have danced alongside Il Divo, Gente de Zona and Diego Torres, and at galas such as the Platino Awards. Sara holds a degree in Dance Pedagogy and Luis is a National DanceSport Judge. They have run their own school since 2020.",
  },
  testimonials: { title: 'What their students say' },
  freeClass: {
    title: 'Start with no risk',
    body: 'Try a free class before you decide. No card, no commitment.',
    cta: 'Watch the free class',
    trust: ['Secure payment with Stripe', 'Lifetime access'],
  },
  offer: {
    title: 'The complete CURSO BACHATANGO',
    lessonsIncluded: '{lessons} HD video lessons',
    lessonsIncludedFallback: 'Every lesson in HD video',
    includes: [
      'Every combination explained, then danced to music',
      'Lifetime access, on phone and computer',
      'Certificate when you complete the course',
    ],
    priceNote: 'One-time payment · Lifetime access',
    before: 'Before',
    spotsLeft: 'Only {n} spots left',
    cta: 'Buy now',
  },
  faqTitle: 'Frequently asked questions',
  faq: [
    { q: 'Do I need a partner?', a: 'No. The course teaches both the leader and the follower role; you can practise on your own and apply it with a partner later.' },
    { q: 'What level do I need?', a: 'None. The course starts from scratch and builds up step by step. If you already dance bachata or tango you will have a head start, but it is not a requirement — all we assume is that you want to learn.' },
    { q: 'Is it for me if I already dance bachata?', a: 'Yes, and you will have a head start. Bachatango has its own technique, so the course begins with posture and the basic steps before moving on to the combos: you skip nothing, but what you already know from bachata will help you progress faster.' },
    { q: 'How long is the course?', a: '{modules} modules and {lessons} video lessons, {duration} in total. You watch at your own pace and can replay each lesson as many times as you like.' },
    { q: 'What devices can I watch it on?', a: 'Any device with a browser: phone, tablet or computer.' },
    { q: 'How long does access last?', a: 'Lifetime access. You buy once and it is yours for good.' },
    { q: 'Is the payment secure?', a: 'Yes. Payment is processed by Stripe; we never store your card details.' },
  ],
  finalCta: { title: 'Start today with lesson 1', cta: 'Buy the course' },
  extraClasses: {
    title: 'Your two classes',
    lead: 'Two lessons from CURSO BACHATANGO to practise at home. Start with posture: everything else is built on it.',
    unavailable: "We can't show the classes right now. Open the link in the email again in a little while.",
    ctaTitle: 'Shall we carry on?',
    ctaBody: 'The full course continues from here, module by module: the rest of the basic steps and the combinations, each one explained and then danced to music.',
    cta: 'See the full course',
  },
};

const fr: LandingCopy = {
  hero: {
    h1: 'Apprenez le bachatango avec les finalistes de Bailando con las Estrellas',
    sub: '{modules} modules, {lessons} leçons en vidéo, {duration}. Vous apprenez le rôle de leader et celui de follower : vous pouvez commencer sans partenaire.',
    subFallback: 'Le cours complet en vidéo. Vous apprenez le rôle de leader et celui de follower : vous pouvez commencer sans partenaire.',
    cta: 'Commencer',
    micro: 'Paiement unique · Accès à vie · Paiement sécurisé avec Stripe',
    secondary: 'Essayer un cours gratuit',
    haveAccount: 'Vous avez déjà un compte ?',
    login: 'Se connecter',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Acheter', freeEmail: 'Cours gratuit par e-mail' },
  freeEmail: {
    title: 'Ça vous a plu ? On vous envoie deux cours de plus',
    body: 'Le cours sur la posture et le deuxième pas de base, gratuits dans votre boîte mail (en espagnol, comme le cours).',
    emailLabel: 'Votre e-mail',
    placeholder: 'vous@email.com',
    consent: 'Je veux recevoir les cours et les e-mails de Luis et Sara. Je peux me désinscrire à tout moment.',
    cta: 'Je veux les deux cours',
    sending: 'Envoi…',
    success: 'C’est fait. Vérifiez votre boîte mail : nous venons de vous envoyer les deux cours.',
    errors: {
      invalid_email: 'Vérifiez l’adresse e-mail : elle ne semble pas valide.',
      consent_required: 'Cochez la case pour que nous puissions vous envoyer les cours.',
      rate_limit: 'Trop de tentatives d’affilée. Attendez un peu et réessayez.',
      server_error: 'Nous n’avons pas pu vous inscrire. Réessayez dans un instant.',
    },
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
  authority: {
    title: 'Qui sont Luis et Sara',
    body: 'Luis et Sara dansent ensemble depuis 2002, quand ils avaient 9 ans. Luis a remporté la première saison de Bailando con las Estrellas, la version espagnole de Danse avec les stars (Telecinco, 2024), et Sara est allée en finale. Ils sont champions internationaux de danses de salon. Ils ont dansé aux côtés d’Il Divo, Gente de Zona et Diego Torres, et lors de galas comme les Prix Platino. Sara est diplômée en Pédagogie de la Danse et Luis est Juge National de Danse Sportive. Depuis 2020, ils dirigent leur propre école.',
  },
  testimonials: { title: 'Ce que disent leurs élèves' },
  freeClass: {
    title: 'Commencez sans risque',
    body: 'Essayez un cours gratuit avant de décider. Sans carte, sans engagement.',
    cta: 'Voir le cours gratuit',
    trust: ['Paiement sécurisé avec Stripe', 'Accès à vie'],
  },
  offer: {
    title: 'CURSO BACHATANGO complet',
    lessonsIncluded: '{lessons} leçons en vidéo HD',
    lessonsIncludedFallback: 'Toutes les leçons en vidéo HD',
    includes: [
      'Chaque combinaison expliquée, puis dansée en musique',
      'Accès à vie, sur mobile et ordinateur',
      'Certificat à la fin du cours',
    ],
    priceNote: 'Paiement unique · Accès à vie',
    before: 'Avant',
    spotsLeft: 'Plus que {n} places disponibles',
    cta: 'Acheter maintenant',
  },
  faqTitle: 'Questions fréquentes',
  faq: [
    { q: 'Ai-je besoin d’un partenaire ?', a: 'Non. Le cours enseigne le rôle de leader comme celui de follower ; vous pouvez travailler seul(e) puis l’appliquer en couple.' },
    { q: 'Quel niveau faut-il ?', a: 'Aucun. Le cours part de zéro et progresse pas à pas. Si vous dansez déjà la bachata ou le tango, vous aurez une longueur d’avance, mais ce n’est pas obligatoire : la seule chose que nous supposons, c’est votre envie d’apprendre.' },
    { q: 'Est-ce utile si je danse déjà la bachata ?', a: 'Oui, et vous aurez une longueur d’avance. Le bachatango a sa propre technique : le cours commence par la posture et les pas de base avant d’aborder les combinaisons. Vous ne sautez aucune étape, mais ce que vous savez déjà de la bachata vous fera progresser plus vite.' },
    { q: 'Combien de temps dure le cours ?', a: '{modules} modules et {lessons} leçons en vidéo, {duration} au total. Vous avancez à votre rythme et pouvez revoir chaque leçon autant de fois que vous le souhaitez.' },
    { q: 'Sur quels appareils puis-je le suivre ?', a: 'Sur tout appareil doté d’un navigateur : téléphone, tablette ou ordinateur.' },
    { q: 'Combien de temps dure l’accès ?', a: 'Accès à vie. Vous achetez une fois et c’est à vous pour toujours.' },
    { q: 'Le paiement est-il sécurisé ?', a: 'Oui. Le paiement est traité par Stripe ; nous ne conservons aucune donnée de votre carte.' },
  ],
  finalCta: { title: 'Commencez aujourd’hui avec la leçon 1', cta: 'Acheter le cours' },
  extraClasses: {
    title: 'Vos deux cours',
    lead: 'Deux leçons du CURSO BACHATANGO pour pratiquer chez vous. Commencez par la posture : tout le reste repose dessus.',
    unavailable: 'Nous ne pouvons pas afficher les cours pour le moment. Rouvrez le lien de l’e-mail un peu plus tard.',
    ctaTitle: 'On continue ?',
    ctaBody: 'Le cours complet reprend à partir d’ici, module par module : les autres pas de base et les combinaisons, chacune expliquée puis dansée en musique.',
    cta: 'Voir le cours complet',
  },
};

const de: LandingCopy = {
  hero: {
    h1: 'Lerne Bachatango mit den Finalisten von Bailando con las Estrellas',
    sub: '{modules} Module, {lessons} Videolektionen, {duration}. Du lernst die Leader- und die Follower-Rolle, also kannst du auch ohne Partner anfangen.',
    subFallback: 'Der komplette Kurs als Video. Du lernst die Leader- und die Follower-Rolle, also kannst du auch ohne Partner anfangen.',
    cta: 'Jetzt starten',
    micro: 'Einmalzahlung · Lebenslanger Zugang · Sichere Zahlung mit Stripe',
    secondary: 'Kostenlose Stunde testen',
    haveAccount: 'Du hast schon ein Konto?',
    login: 'Anmelden',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Kaufen', freeEmail: 'Gratis-Stunde per E-Mail' },
  freeEmail: {
    title: 'Hat es dir gefallen? Wir schicken dir zwei weitere Stunden',
    body: 'Die Stunde zur Haltung und den zweiten Grundschritt, kostenlos per E-Mail (auf Spanisch, wie der Kurs).',
    emailLabel: 'Deine E-Mail',
    placeholder: 'du@email.com',
    consent: 'Ich möchte die Stunden und E-Mails von Luis und Sara erhalten. Ich kann mich jederzeit abmelden.',
    cta: 'Ich will die zwei Stunden',
    sending: 'Wird gesendet…',
    success: 'Erledigt. Schau in dein Postfach: Wir haben dir gerade die zwei Stunden geschickt.',
    errors: {
      invalid_email: 'Prüfe die E-Mail-Adresse: Sie scheint nicht gültig zu sein.',
      consent_required: 'Setz das Häkchen, damit wir dir die Stunden schicken können.',
      rate_limit: 'Zu viele Versuche hintereinander. Warte kurz und versuch es noch einmal.',
      server_error: 'Wir konnten dich nicht eintragen. Versuch es gleich noch einmal.',
    },
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
  authority: {
    title: 'Wer Luis und Sara sind',
    body: 'Luis und Sara tanzen seit 2002 zusammen, damals waren sie 9 Jahre alt. Luis gewann die erste Staffel von Bailando con las Estrellas, der spanischen Ausgabe von Let’s Dance (Telecinco, 2024), und Sara erreichte das Finale. Sie sind internationale Meister im Gesellschaftstanz. Sie haben mit Il Divo, Gente de Zona und Diego Torres getanzt und bei Galas wie den Platino Awards. Sara hat einen Abschluss in Tanzpädagogik und Luis ist nationaler Wertungsrichter im Tanzsport. Seit 2020 leiten sie ihre eigene Tanzschule.',
  },
  testimonials: { title: 'Was ihre Schüler sagen' },
  freeClass: {
    title: 'Fang ohne Risiko an',
    body: 'Teste eine kostenlose Stunde, bevor du dich entscheidest. Ohne Karte, ohne Verpflichtung.',
    cta: 'Kostenlose Stunde ansehen',
    trust: ['Sichere Zahlung mit Stripe', 'Lebenslanger Zugang'],
  },
  offer: {
    title: 'CURSO BACHATANGO komplett',
    lessonsIncluded: '{lessons} Lektionen als HD-Video',
    lessonsIncludedFallback: 'Alle Lektionen als HD-Video',
    includes: [
      'Jede Kombination erklärt und danach zur Musik getanzt',
      'Lebenslanger Zugang, auf Handy und Computer',
      'Zertifikat nach Abschluss des Kurses',
    ],
    priceNote: 'Einmalzahlung · Lebenslanger Zugang',
    before: 'Vorher',
    spotsLeft: 'Nur noch {n} Plätze frei',
    cta: 'Jetzt kaufen',
  },
  faqTitle: 'Häufige Fragen',
  faq: [
    { q: 'Brauche ich einen Partner?', a: 'Nein. Der Kurs vermittelt sowohl die Leader- als auch die Follower-Rolle; du kannst allein üben und es später zu zweit anwenden.' },
    { q: 'Welches Niveau brauche ich?', a: 'Keines. Der Kurs beginnt bei null und baut Schritt für Schritt auf. Wenn du schon Bachata oder Tango tanzt, hast du einen Vorsprung, aber Voraussetzung ist es nicht — wir setzen nur voraus, dass du lernen willst.' },
    { q: 'Lohnt sich der Kurs, wenn ich schon Bachata tanze?', a: 'Ja, und du hast einen Vorsprung. Bachatango hat eine eigene Technik, deshalb beginnt der Kurs mit Haltung und Grundschritten, bevor es an die Kombinationen geht: Du überspringst nichts, aber was du von der Bachata schon kannst, lässt dich schneller vorankommen.' },
    { q: 'Wie lang ist der Kurs?', a: '{modules} Module und {lessons} Videolektionen, insgesamt {duration}. Du lernst in deinem Tempo und kannst jede Lektion so oft ansehen, wie du willst.' },
    { q: 'Auf welchen Geräten kann ich zusehen?', a: 'Auf jedem Gerät mit Browser: Handy, Tablet oder Computer.' },
    { q: 'Wie lange gilt der Zugang?', a: 'Lebenslang. Einmal kaufen und er gehört dir für immer.' },
    { q: 'Ist die Zahlung sicher?', a: 'Ja. Die Zahlung wird über Stripe abgewickelt; wir speichern keine Kartendaten.' },
  ],
  finalCta: { title: 'Fang heute mit Lektion 1 an', cta: 'Kurs kaufen' },
  extraClasses: {
    title: 'Deine zwei Stunden',
    lead: 'Zwei Lektionen aus dem CURSO BACHATANGO zum Üben zu Hause. Fang mit der Haltung an: Darauf baut alles andere auf.',
    unavailable: 'Wir können die Stunden gerade nicht anzeigen. Öffne den Link aus der E-Mail in einer Weile noch einmal.',
    ctaTitle: 'Machen wir weiter?',
    ctaBody: 'Der komplette Kurs geht von hier aus weiter, Modul für Modul: die übrigen Grundschritte und die Kombinationen, jede erklärt und danach zur Musik getanzt.',
    cta: 'Zum kompletten Kurs',
  },
};

const it: LandingCopy = {
  hero: {
    h1: 'Impara il bachatango con i finalisti di Bailando con las Estrellas',
    sub: '{modules} moduli, {lessons} lezioni in video, {duration}. Impari sia il ruolo di leader sia quello di follower, quindi puoi iniziare senza partner.',
    subFallback: 'Il corso completo in video. Impari sia il ruolo di leader sia quello di follower, quindi puoi iniziare senza partner.',
    cta: 'Inizia ora',
    micro: 'Pagamento unico · Accesso a vita · Pagamento sicuro con Stripe',
    secondary: 'Prova una lezione gratis',
    haveAccount: 'Hai già un account?',
    login: 'Accedi',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: 'Acquista', freeEmail: 'Lezione gratis via email' },
  freeEmail: {
    title: 'Ti è piaciuta? Ti mandiamo altre due lezioni',
    body: 'La lezione sulla postura e il secondo passo base, gratis nella tua email (in spagnolo, come il corso).',
    emailLabel: 'La tua email',
    placeholder: 'tu@email.com',
    consent: 'Voglio ricevere le lezioni e le email di Luis e Sara. Posso disiscrivermi quando voglio.',
    cta: 'Voglio le due lezioni',
    sending: 'Invio in corso…',
    success: 'Fatto. Controlla la tua email: ti abbiamo appena mandato le due lezioni.',
    errors: {
      invalid_email: 'Controlla l’indirizzo email: non sembra valido.',
      consent_required: 'Spunta la casella così possiamo mandarti le lezioni.',
      rate_limit: 'Troppi tentativi di seguito. Aspetta un po’ e riprova.',
      server_error: 'Non siamo riusciti a iscriverti. Riprova tra un momento.',
    },
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
  authority: {
    title: 'Chi sono Luis e Sara',
    body: 'Luis e Sara ballano insieme dal 2002, quando avevano 9 anni. Luis ha vinto la prima edizione di Bailando con las Estrellas, la versione spagnola di Ballando con le stelle (Telecinco, 2024), e Sara è arrivata in finale. Sono campioni internazionali di balli da sala. Hanno ballato con Il Divo, Gente de Zona e Diego Torres, e in gala come i Premi Platino. Sara è laureata in Pedagogia della Danza e Luis è Giudice Nazionale di Danza Sportiva. Dal 2020 dirigono la loro scuola di ballo.',
  },
  testimonials: { title: 'Cosa dicono i loro allievi' },
  freeClass: {
    title: 'Inizia senza rischi',
    body: 'Prova una lezione gratis prima di decidere. Senza carta, senza impegno.',
    cta: 'Guarda la lezione gratis',
    trust: ['Pagamento sicuro con Stripe', 'Accesso a vita'],
  },
  offer: {
    title: 'CURSO BACHATANGO completo',
    lessonsIncluded: '{lessons} lezioni in video HD',
    lessonsIncludedFallback: 'Tutte le lezioni in video HD',
    includes: [
      'Ogni combinazione spiegata e poi ballata con la musica',
      'Accesso a vita, da telefono e computer',
      'Certificato al termine del corso',
    ],
    priceNote: 'Pagamento unico · Accesso a vita',
    before: 'Prima',
    spotsLeft: 'Restano solo {n} posti',
    cta: 'Acquista ora',
  },
  faqTitle: 'Domande frequenti',
  faq: [
    { q: 'Mi serve un partner?', a: 'No. Il corso insegna sia il ruolo di leader sia quello di follower; puoi esercitarti da solo/a e applicarlo in coppia più avanti.' },
    { q: 'Che livello serve?', a: 'Nessuno. Il corso parte da zero e procede passo dopo passo. Se balli già bachata o tango partirai avvantaggiato, ma non è un requisito: l’unica cosa che diamo per scontata è la voglia di imparare.' },
    { q: 'Fa per me se ballo già bachata?', a: 'Sì, e partirai avvantaggiato. Il bachatango ha una tecnica propria, quindi il corso comincia dalla postura e dai passi base prima di arrivare alle combinazioni: non salti nulla, ma quello che sai già della bachata ti farà avanzare più in fretta.' },
    { q: 'Quanto dura il corso?', a: '{modules} moduli e {lessons} lezioni in video, {duration} in tutto. Lo segui al tuo ritmo e puoi rivedere ogni lezione tutte le volte che vuoi.' },
    { q: 'Su quali dispositivi posso vederlo?', a: 'Su qualsiasi dispositivo con un browser: telefono, tablet o computer.' },
    { q: 'Quanto dura l’accesso?', a: 'Accesso a vita. Acquisti una volta ed è tuo per sempre.' },
    { q: 'Il pagamento è sicuro?', a: 'Sì. Il pagamento è gestito da Stripe; non conserviamo i dati della tua carta.' },
  ],
  finalCta: { title: 'Inizia oggi con la lezione 1', cta: 'Acquista il corso' },
  extraClasses: {
    title: 'Le tue due lezioni',
    lead: 'Due lezioni del CURSO BACHATANGO da praticare a casa. Comincia dalla postura: tutto il resto si basa su quella.',
    unavailable: 'In questo momento non riusciamo a mostrare le lezioni. Riapri il link dell’email tra poco.',
    ctaTitle: 'Continuiamo?',
    ctaBody: 'Il corso completo riparte da qui, modulo per modulo: gli altri passi base e le combinazioni, ognuna spiegata e poi ballata con la musica.',
    cta: 'Vedi il corso completo',
  },
};

const ja: LandingCopy = {
  hero: {
    h1: '『Bailando con las Estrellas』ファイナリストと学ぶバチャタンゴ',
    sub: '{modules}モジュール、{lessons}本の動画レッスン、{duration}。リーダーとフォロワーの両方の役割を学べるので、パートナーなしで始められます。',
    subFallback: '動画で学べる完全コース。リーダーとフォロワーの両方の役割を学べるので、パートナーなしで始められます。',
    cta: 'はじめる',
    micro: '買い切り · 生涯アクセス · Stripeによる安全な決済',
    secondary: '無料レッスンを試す',
    haveAccount: 'すでにアカウントをお持ちですか',
    login: 'ログイン',
  },
  sticky: { brand: 'Luis y Sara · CURSO BACHATANGO', cta: '購入', freeEmail: 'メールで無料レッスン' },
  freeEmail: {
    title: '気に入りましたか？あと2つのレッスンをお送りします',
    body: '姿勢のレッスンと2つ目のベーシックを、無料でメールにお届けします（コースと同じくスペイン語です）。',
    emailLabel: 'メールアドレス',
    placeholder: 'you@email.com',
    consent: 'ルイスとサラからレッスンとメールを受け取ります。いつでも配信を停止できます。',
    cta: '2つのレッスンを受け取る',
    sending: '送信中…',
    success: '完了しました。メールをご確認ください。2つのレッスンをお送りしました。',
    errors: {
      invalid_email: 'メールアドレスをご確認ください。正しくないようです。',
      consent_required: 'レッスンをお送りするため、チェックボックスにチェックを入れてください。',
      rate_limit: '短時間に何度も試行されました。少し待ってからもう一度お試しください。',
      server_error: '登録できませんでした。しばらくしてからもう一度お試しください。',
    },
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
  authority: {
    title: 'ルイスとサラについて',
    body: 'ルイスとサラは、9歳だった2002年から一緒に踊り続けています。スペイン版『ダンシング・ウィズ・ザ・スターズ』である『Bailando con las Estrellas』（テレシンコ、2024年）の第1シーズンでルイスが優勝し、サラも決勝に進出しました。二人は社交ダンスの国際チャンピオンです。イル・ディーヴォ、ヘンテ・デ・ソナ、ディエゴ・トーレスと共演し、プラティノ賞などのガラにも出演しています。サラはダンス教育学の学位を持ち、ルイスは競技ダンスの国内審査員です。2020年からは自分たちのダンススクールを運営しています。',
  },
  testimonials: { title: '受講生の声' },
  freeClass: {
    title: 'リスクなしではじめる',
    body: '決める前に無料レッスンをお試しください。カード登録も、義務もありません。',
    cta: '無料レッスンを見る',
    trust: ['Stripeによる安全な決済', '生涯アクセス'],
  },
  offer: {
    title: 'CURSO BACHATANGO 完全版',
    lessonsIncluded: '{lessons}本のHD動画レッスン',
    lessonsIncludedFallback: '全レッスンをHD動画で',
    includes: [
      '各コンビネーションを解説し、音楽に合わせて踊ります',
      'スマートフォンでもパソコンでも、生涯アクセス',
      'コース修了時に修了証',
    ],
    priceNote: '買い切り · 生涯アクセス',
    before: '通常価格',
    spotsLeft: '残り{n}席',
    cta: '今すぐ購入',
  },
  faqTitle: 'よくある質問',
  faq: [
    { q: 'パートナーは必要ですか', a: 'いいえ。リーダーとフォロワーの両方の役割を学べます。ひとりで練習し、あとからペアで活かせます。' },
    { q: 'どのくらいのレベルが必要ですか', a: '特別なレベルは必要ありません。コースはゼロから始まり、一歩ずつ進みます。バチャタやタンゴの経験があれば有利ですが、必須ではありません。前提となるのは、学びたいという気持ちだけです。' },
    { q: 'すでにバチャタを踊っていても役立ちますか', a: 'はい、しかも有利なスタートを切れます。バチャタンゴには独自のテクニックがあるため、コースはコンビネーションに進む前に、姿勢とベーシックから始めます。どのステップも飛ばしませんが、バチャタで身につけたことが上達を早めてくれます。' },
    { q: 'コースの長さはどのくらいですか', a: '{modules}モジュール、{lessons}本の動画レッスン、合計{duration}です。自分のペースで進められ、各レッスンは何度でも見直せます。' },
    { q: 'どの端末で見られますか', a: 'ブラウザのある端末ならどれでも。スマートフォン、タブレット、パソコン。' },
    { q: 'アクセス期間はどのくらいですか', a: '生涯アクセスです。一度購入すれば、ずっとご利用いただけます。' },
    { q: '決済は安全ですか', a: 'はい。決済はStripeが処理し、カード情報を当方で保存することはありません。' },
  ],
  finalCta: { title: '今日、レッスン1から始めよう', cta: 'コースを購入する' },
  extraClasses: {
    title: 'あなたの2つのレッスン',
    lead: '自宅で練習できる、CURSO BACHATANGOの2つのレッスンです。まずは姿勢から。ほかのすべての土台になります。',
    unavailable: '現在レッスンを表示できません。しばらくしてから、メールのリンクをもう一度開いてください。',
    ctaTitle: '続けてみませんか',
    ctaBody: 'コース全体はここから続きます。残りのベーシックと各コンビネーションを、モジュールごとに解説し、音楽に合わせて踊ります。',
    cta: 'コース全体を見る',
  },
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
