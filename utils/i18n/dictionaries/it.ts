import type { Dictionary } from '@/utils/i18n/types'

export const it: Dictionary = {
  header: {
    courses: "Corsi", events: "Eventi", music: "Musica", community: "Comunità", about: "Chi Siamo", login: "Login", profile: "Il Mio Profilo", dashboard: "Dashboard", logout: "Esci"
  },
  common: {
    processing: "Elaborazione...",
    subscribeNow: "Iscriviti Ora",
    login: "Accedi"
  },
  footer: {
    description: "Impara il Bachatango con Luis e Sara. La fusione perfetta tra la sensualità della bachata e l'eleganza del tango.",
    explore: "Esplora", home: "Home", contact: "Contatti", notice: "Avviso Legale",
    legal: "Legale", terms: "Termini e Condizioni", privacy: "Privacy", cookies: "Cookies", rights: "Tutti i diritti riservati.", blog: "Blog"
  },
  hero: {
    title: "Domina l'Arte del Bachatango",
    subtitle: "Impara con i migliori istruttori. Corsi esclusivi, tecnica raffinata e passione in ogni passo.",
    cta: "SCOPRI I NOSTRI CORSI",
    sampleClass: "Guarda la classe di esempio",
    scrollLabel: "Scorri per vedere di più",
    stats: { years: "ANNI DI BALLO", students: "STUDENTI", countries: "PAESI" }
  },
  features: {
    monthly: { title: "Corsi Completi", desc: "Programmi integrali dall'inizio alla fine. Impara dal livello principiante ad avanzato con un unico pagamento e accesso a vita." },
    exclusive: { title: "Contenuto Esclusivo", desc: "Accedi a segreti di tecnica e musicalità." },
    access: { title: "Accesso 24/7", desc: "La tua piattaforma di apprendimento sempre disponibile." }
  },
  testimonials: {
    title: "Cosa Dicono i Nostri Studenti",
    t1: { quote: "La metodologia di Luis e Sara è impeccabile.", role: "Studentessa" },
    t2: { quote: "Il bachatango è stata una scoperta.", role: "Ballerino Amatoriale" },
    t3: { quote: "Perfetto per praticare a casa.", role: "Coppia di Ballo" }
  },
  faq: {
    title: "Domande Frequenti",
    q1: { q: "Ho bisogno di esperienza?", a: "Non è necessario." },
    q2: { q: "Come accedo ai corsi?", a: "Accesso immediato dopo l'iscrizione." },
    q3: { q: "Posso cancellare quando voglio?", a: "Sì, senza vincoli." },
    q4: { q: "Serve il partner?", a: "No, molte lezioni sono individuali." }
  },
  newsletter: {
    title: "Unisciti alla Comunità", desc: "Ricevi consigli esclusivi.", placeholder: "La tua email", button: "Iscriviti",
    success: "Iscritto! Grazie.", error: "Invio fallito."
  },
  events: {
    title: "Agenda & Eventi", desc: "Scopri dove saremo.", details: "Più Info",
    create: "Nuovo evento",
    edit: "Modifica",
    delete: "Elimina",
    deleteConfirm: "Eliminare questo evento?",
    draft: "Bozza",
    empty: { title: "Stiamo preparando nuove date", text: "Torna presto o seguici sui social per la prossima tappa." },
    upcoming: { eyebrow: "AGENDA", heading: "Prossime tappe", pill: "Prossimo", singular: "DATA IN ARRIVO", plural: "DATE IN ARRIVO" },
    past: { eyebrow: "ARCHIVIO", heading: "Date passate", pill: "Passato" }
  },
  music: { title: "Le Nostre Playlist", desc: "La musica è il cuore del ballo." },
  blog: {
    title: "Blog & Articoli", desc: "Riflessioni, tecnica e cultura.", readMore: "Leggi Articolo",
    items: {
      a1: { t: "Cos'è davvero il Bachatango?", c: "Storia", e: "Scopri le origini." },
      a2: { t: "5 Errori Comuni", c: "Tecnica", e: "La base di una buona connessione." },
      a3: { t: "Musicalità Tango vs Bachata", c: "Musicalità", e: "Capire i tempi forti." }
    }
  },
  contact: {
    title: "Ingaggi", desc: "Vuoi portarci nella tua città?",
    success: "Messaggio inviato! Ti risponderemo presto.", error: "Invio fallito.",
    form: {
      name: "Nome", namePlace: "Il tuo nome",
      email: "Email", type: "Tipo Evento", types: { fest: "Festival", work: "Workshop", show: "Show", other: "Altro" },
      message: "Dettagli", messagePlace: "Raccontaci...", submit: "Invia"
    }
  },
  about: {
    heroTitle: "Passione ed Eleganza", heroSubtitle: "La Storia di Luis e Sara", bioTitle: "Più che Ballo",
    bio1: "Pionieri della fusione.", bio2: "Il viaggio è iniziato a Madrid.",
    stats: { s1: "Anni di Esperienza", s2: "Studenti Online", s3: "Paesi Visitati", s4: "Campioni Internazionali" },
    quote: "Bachatango è sentire.", cta: "Inizia a Ballare Oggi"
  },
  communityPage: {
    joinTitle: "Unisciti alla Comunità",
    joinDesc: "Per vedere e partecipare alle discussioni esclusive, devi essere registrato e abbonato.",
    alreadyAccount: "Hai già un account?",
    login: "Accedi",
    title: "Comunità",
    create: "Crea Post"
  },
  coursesPage: {
    title: "Corsi Disponibili",
    create: "+ Crea Corso",
    empty: "Nessun corso pubblicato al momento.",
    emptySub: "Torna presto per nuove lezioni!",
    view: "Vedi Corsi",
    viewMore: "Vedi altro →",
    buy: "Acquista →",
    hasAccess: "✓ Hai accesso",
    priceNA: "Prezzo non disponibile",
    completeCourses: "Corsi Completi",
    completeSub: "Prezzo fisso · Accesso permanente",
    monthlyClasses: "Classi Mensili",
    monthlySub: "4 classi al mese · Abbonamento o acquisto individuale mensile",
    filterAll: "Tutti",
    months: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]
  },
  lesson: {
    backToCourse: "← Torna al Corso",
    courseLessons: "Lezioni del Corso",
    lockedContent: "Contenuto Bloccato",
    lockedMessage: "Questo video è esclusivo per i membri Premium.",
    getPremium: "Ottieni Premium",
    editLesson: "✎ Modifica Lezione",
    exclusiveContent: "Il contenuto di questa lezione è esclusivo per i membri Premium.",
    description: "Descrizione",
    musicalResources: "Risorse Musicali",
    assignment: "Compito",
    comments: "Commenti",
    resourcesComingSoon: "Risorse musicali prossimamente...",
    assignmentNoTask: "Il professore non ha assegnato nessun compito per questa lezione.",
    assignmentNoTaskAdmin: "Nessun compito ancora per questa lezione. Aggiungine uno da \"Modifica Lezione\".",
    assignmentReviewed: "✓ Compito corretto",
    assignmentGradeLabel: "Voto:",
    assignmentResponseLabel: "La tua risposta (testo)",
    assignmentFileLabel: "Allega file (opzionale)",
    assignmentResponsePlaceholder: "Scrivi qui la tua risposta...",
    assignmentSubmitBtn: "Invia",
    assignmentUpdateBtn: "Aggiorna invio",
    assignmentUploading: "Caricamento file...",
    assignmentSending: "Invio in corso...",
    assignmentSuccess: "Compito inviato con successo!",
    assignmentViewSubmissions: "Vedi tutti gli invii",
    previousLesson: "Precedente",
    nextLesson: "Successivo",
    lessonNavigation: "Navigazione tra le lezioni"
  },
  dashboard: {
    title: "I Miei Corsi",
    viewClass: "VEDI CLASSE",
    empty: "Non hai ancora corsi.",
    emptySub: "Esplora il nostro catalogo e inizia a ballare oggi stesso.",
    discover: "Ultimi Corsi Aggiunti",
    exploreAll: "Vedi tutti i corsi →"
  },
  login: {
    title: "Accedi",
    subtitle: "Accedi alla piattaforma esclusiva di Luis e Sara",
    email: "Email",
    password: "Password",
    submit: "Accedi",
    noAccount: "Non hai un account? Registrati",
    forgotPassword: "Hai dimenticato la password?",
    or: "O",
    panelEyebrow: "ACCESSO PRIVATO",
    panelTitle: "Ballare è ",
    panelTitleEmphasis: "ricordare",
    panelTitleSuffix: " con il corpo.",
    panelLead: "Torna al tuo posto nell'accademia: nuove lezioni, comunità attiva e tutto l'archivio di Luis e Sara ti aspettano.",
    panelFeatures: ["Lezioni video in alta qualità", "Comunità di ballerini ed eventi", "I tuoi progressi, salvati lezione per lezione"],
    panelQuote: "La bachata non si impara, si sente. Ma si pratica.",
    cardEyebrow: "ACCEDI"
  },
  signup: {
    title: "Registrati",
    subtitle: "Crea il tuo account per accedere alla piattaforma",
    email: "Email",
    fullName: "Nome Completo",
    fullNamePlaceholder: "Mario Rossi",
    password: "Password",
    submit: "Registrati",
    hasAccount: "Hai già un account? Accedi",
    forgotPassword: "Hai dimenticato la password?",
    or: "O",
    panelEyebrow: "UNISCITI ALL'ACCADEMIA",
    panelTitle: "La tua prima ",
    panelTitleEmphasis: "lezione",
    panelTitleSuffix: " inizia con un passo.",
    panelLead: "Crea il tuo account e sblocca l'accesso alle lezioni, alle sfide mensili e alla comunità di Luis y Sara Bachatango.",
    panelFeatures: ["Accesso alle lezioni per tutti i livelli", "Eventi, incontri e musica curata", "Una comunità calorosa e autentica"],
    panelQuote: "Ciò che si balla lentamente, si capisce rapidamente.",
    cardEyebrow: "CREA ACCOUNT"
  },
  forgotPassword: {
    title: "Recupera Password",
    subtitle: "Inserisci la tua email per ricevere un link di recupero",
    email: "Email",
    submit: "Invia link",
    backToLogin: "Torna al login",
    panelEyebrow: "RECUPERA L'ACCESSO",
    panelTitle: "Torna in ",
    panelTitleEmphasis: "pista",
    panelTitleSuffix: " in pochi passi.",
    panelLead: "Ti inviamo un link sicuro alla tua email per creare una nuova password senza perdere i tuoi progressi.",
    panelFeatures: ["Link valido per un tempo limitato", "Il tuo account e le tue lezioni rimangono intatti", "Se non arriva, controlla la cartella spam"],
    cardEyebrow: "RECUPERA"
  },
  profile: {
    title: "Il Mio Profilo",
    editProfile: "Modifica Profilo",
    accountInfo: "Informazioni Account",
    email: "Email",
    subscription: "Abbonamento",
    status: "Stato",
    active: "Attivo",
    inactive: "Inattivo",
    activeUntil: "Il tuo abbonamento è attivo fino al",
    noActiveSubscription: "Non hai un abbonamento attivo al momento.",
    dangerZone: "Zona Pericolo",
    undoableWarning: "Queste azioni non possono essere annullate.",
    logout: "Esci",
    deleteAccount: "Elimina Account"
  },
  pricing: {
    title: "Abbonamenti",
    subtitle: "Accedi ai corsi di bachata di Luis e Sara con un abbonamento mensile. Ogni mese include 4 nuove lezioni.",
    comingSoon: "Prossimamente",
    mostPopular: "Più popolare",
    perMonth: "/mese",
    note: "Vuoi accedere a un mese precedente? Puoi acquistarlo individualmente dalla pagina del corso."
  },
  errors: {
    invalid_credentials: "Credenziali errate. Controlla la tua email e la password.",
    signup_failed: "Impossibile creare l'account. Riprova.",
    invalid_email: "Email non valida.",
    password_too_short: "La password deve contenere almeno 8 caratteri.",
    reset_failed: "Impossibile inviare il link. Riprova.",
    rate_limit: "Troppi tentativi. Attendi un minuto e riprova.",
    unknown: "Si è verificato un errore. Riprova."
  },
  messages: {
    email_confirmation: "Controlla la tua email per continuare il processo di registrazione.",
    email_reset: "Controlla la tua email per continuare il processo di recupero password.",
    account_deleted: "Account eliminato con successo."
  }
}
