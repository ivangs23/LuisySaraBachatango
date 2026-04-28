export type Locale = 'es' | 'en' | 'fr' | 'de' | 'it' | 'ja';

export const dictionaries = {
  es: {
    header: {
      courses: "Cursos",
      events: "Eventos",
      music: "Música",
      community: "Comunidad",
      about: "Sobre Nosotros",
      login: "Iniciar Sesión",
      profile: "Mi Perfil",
      dashboard: "Dashboard",
      logout: "Cerrar Sesión"
    },
    common: {
      processing: "Procesando...",
      subscribeNow: "Suscribirse Ahora",
      login: "Iniciar Sesión"
    },
    footer: {
      description: "Aprende Bachatango con Luis y Sara. La fusión perfecta entre la sensualidad de la bachata y la elegancia del tango.",
      explore: "Explorar",
      home: "Inicio",
      contact: "Contacto",
      notice: "Aviso Legal",
      legal: "Legal",
      terms: "Términos y Condiciones",
      privacy: "Política de Privacidad",
      cookies: "Política de Cookies",
      rights: "Todos los derechos reservados.",
      blog: "Blog"
    },
    hero: {
      title: "Domina el Arte del Bachatango",
      subtitle: "Aprende con los mejores instructores, Luis y Sara. Cursos exclusivos, técnica refinada y pasión en cada paso.",
      cta: "DESCUBRE NUESTROS CURSOS",
      sampleClass: "Ver clase de muestra",
      scrollLabel: "Bajar para ver más",
      stats: { years: "AÑOS BAILANDO", students: "ALUMNOS", countries: "PAÍSES" }
    },
    features: {
      monthly: {
        title: "Cursos Completos",
        desc: "Programas integrales de principio a fin. Aprende desde iniciación hasta nivel avanzado con un solo pago y acceso de por vida."
      },
      exclusive: {
        title: "Contenido Exclusivo",
        desc: "Accede a secretos de técnica, musicalidad y conexión que no encontrarás en ningún otro lugar. Masterclasses de expertos."
      },
      access: {
        title: "Acceso 24/7",
        desc: "Tu plataforma de aprendizaje siempre disponible. Practica a tu ritmo, repite las lecciones y perfecciona tu estilo desde casa."
      }
    },
    testimonials: {
      title: "Lo Que Dicen Nuestros Alumnos",
      // Note: User testimonials are usually database dynamics, but for hardcoded ones:
      t1: {
        quote: "Nunca creí que pudiera aprender a conectar así con mi pareja a través de una pantalla. La metodología de Luis y Sara es impecable.",
        role: "Alumna"
      },
      t2: {
        quote: "Llevo años bailando bachata, pero el bachatango ha sido un descubrimiento. La elegancia que transmiten en cada clase es inspiradora.",
        role: "Bailarín Amateur"
      },
      t3: {
        quote: "Perfecto para practicar en casa. Los detalles técnicos marcan la diferencia. 100% recomendado.",
        role: "Pareja de Baile"
      }
    },
    faq: {
      title: "Preguntas Frecuentes",
      q1: {
        q: "¿Necesito tener experiencia previa en baile?",
        a: "No es necesario. Tenemos cursos desde nivel iniciación diseñados para que aprendas desde cero, paso a paso."
      },
      q2: {
        q: "¿Cómo accedo a los cursos?",
        a: "Una vez te suscribes, tienes acceso inmediato a todo el contenido a través de la plataforma. Puedes ver las clases tantas veces como quieras."
      },
      q3: {
        q: "¿Puedo cancelar mi suscripción en cualquier momento?",
        a: "Sí, sin compromisos. Puedes cancelar tu suscripción desde tu perfil en cualquier momento y mantendrás el acceso hasta el final del periodo facturado."
      },
      q4: {
        q: "¿Sirve si no tengo pareja de baile?",
        a: "Absolutamente. Aunque el Bachatango es un baile de pareja, muchas lecciones se enfocan en técnica individual, musicalidad y estilo que puedes practicar solo/a."
      }
    },
    newsletter: {
      title: "Únete a la Comunidad",
      desc: "Recibe consejos exclusivos de baile, novedades sobre talleres y una clase gratuita al suscribirte.",
      placeholder: "Tu correo electrónico",
      button: "Suscribirme"
    },
    events: {
      title: "Agenda & Eventos",
      desc: "Descubre dónde estaremos próximamente. Ven a aprender, bailar y disfrutar con nosotros en vivo.",
      details: "Más Información",
      create: "Nuevo evento",
      edit: "Editar",
      delete: "Borrar",
      deleteConfirm: "¿Borrar este evento?",
      draft: "Borrador",
      empty: { title: "Estamos preparando nuevas fechas", text: "Vuelve pronto o síguenos en redes para enterarte de la próxima parada." },
      upcoming: { eyebrow: "AGENDA", heading: "Próximas paradas", pill: "Próxima", singular: "PRÓXIMA FECHA", plural: "PRÓXIMAS FECHAS" },
      past: { eyebrow: "ARCHIVO", heading: "Fechas pasadas", pill: "Pasado" }
    },
    music: {
      title: "Nuestras Playlists",
      desc: "La música es el corazón del baile. Aquí tienes las listas que usamos en nuestras clases y para entrenar cada día."
    },
    blog: {
      title: "Blog & Artículos",
      desc: "Reflexiones, técnica y cultura. Profundiza en tu conocimiento del baile más allá de los pasos.",
      readMore: "Leer Artículo",
      items: {
        a1: { t: "¿Qué es realmente el Bachatango?", c: "Historia", e: "Descubre los orígenes de esta fusión controversial y bella. No es solo bachata con pausas, es una conversación entre dos géneros." },
        a2: { t: "5 Errores Comunes en la Postura", c: "Técnica", e: "La base de una buena conexión empieza en tu propio eje. Analizamos los fallos más habituales que te impiden fluir con tu pareja." },
        a3: { t: "La Musicalidad en el Tango vs Bachata", c: "Musicalidad", e: "Entender los tiempos fuertes y las melodías es clave. Aprende a diferenciar cuándo pisar con fuerza y cuándo deslizarte." }
      }
    },
    contact: {
      title: "Contrataciones",
      desc: "¿Quieres llevarnos a tu ciudad? Rellena este formulario para solicitar información sobre talleres, shows y festivales.",
      form: {
        name: "Nombre / Organizador",
        namePlace: "Tu nombre o el de tu evento",
        email: "Correo Electrónico",
        type: "Tipo de Evento",
        types: { fest: "Festival de Baile", work: "Taller Intensivo", show: "Show / Exhibición", other: "Otro" },
        message: "Detalles",
        messagePlace: "Cuéntanos más sobre el evento (fechas, lugar, propuesta...)",
        submit: "Enviar Solicitud"
      }
    },
    about: {
      heroTitle: "Pasión y Elegancia",
      heroSubtitle: "La Historia de Luis y Sara",
      bioTitle: "Más que Baile, una Conexión",
      bio1: "Luis y Sara no son solo instructores; son pioneros en la fusión del Bachata y el Tango. Con más de una década de experiencia en los escenarios internacionales, han desarrollado una metodología única que combina la sensualidad fluida de la bachata con la precisión y el drama del tango.",
      bio2: "Su viaje comenzó en los salones de Madrid, donde sus estilos individuales chocaron para crear algo completamente nuevo. Hoy, viajan por el mundo compartiendo su visión: que el baile es el lenguaje más honesto del alma.",
      stats: {
        s1: "Años de Experiencia",
        s2: "Estudiantes Online",
        s3: "Países Visitados",
        s4: "Campeones Internacionales"
      },
      quote: "El bachatango no es solo pasos, es sentir la respiración de tu pareja y convertirla en movimiento. Queremos que nuestros alumnos no solo aprendan a bailar, sino a sentir.",
      cta: "Empieza a Bailar Hoy"
    },
    communityPage: {
      joinTitle: "Únete a la Comunidad",
      joinDesc: "Para ver y participar en las discusiones exclusivas de la comunidad Bachatango, necesitas estar registrado y suscrito.",
      alreadyAccount: "¿Ya tienes cuenta?",
      login: "Iniciar Sesión",
      title: "Comunidad",
      create: "Crear Post"
    },
    coursesPage: {
      title: "Cursos Disponibles",
      create: "+ Crear Curso",
      empty: "No hay cursos publicados en este momento.",
      emptySub: "¡Vuelve pronto para ver las nuevas clases de Luis y Sara!",
      view: "Ver Clases",
      viewMore: "Ver más →",
      buy: "Comprar →",
      hasAccess: "✓ Tienes acceso",
      priceNA: "Precio no disponible",
      completeCourses: "Cursos Completos",
      completeSub: "Precio fijo · Acceso permanente",
      monthlyClasses: "Clases Mensuales",
      monthlySub: "4 clases por mes · Suscripción o compra individual por mes",
      filterAll: "Todos",
      months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    },
    lesson: {
      backToCourse: "← Volver al Curso",
      courseLessons: "Lecciones del Curso",
      lockedContent: "Contenido Bloqueado",
      lockedMessage: "Este video es exclusivo para miembros Premium.",
      getPremium: "Obtener Premium",
      editLesson: "✎ Editar Lección",
      exclusiveContent: "El contenido de esta lección es exclusivo para miembros Premium.",
      description: "Descripción",
      musicalResources: "Recursos Musicales",
      assignment: "Tarea",
      comments: "Comentarios",
      resourcesComingSoon: "Recursos musicales próximamente...",
      assignmentNoTask: "El profesor no ha asignado ninguna tarea para esta lección.",
      assignmentNoTaskAdmin: "Aún no hay tarea para esta lección. Añade una desde \"Editar Lección\".",
      assignmentReviewed: "✓ Tarea corregida",
      assignmentGradeLabel: "Calificación:",
      assignmentResponseLabel: "Tu respuesta (texto)",
      assignmentFileLabel: "Adjuntar archivo (opcional)",
      assignmentResponsePlaceholder: "Escribe tu respuesta aquí...",
      assignmentSubmitBtn: "Enviar entrega",
      assignmentUpdateBtn: "Actualizar entrega",
      assignmentUploading: "Subiendo archivo...",
      assignmentSending: "Enviando...",
      assignmentSuccess: "¡Entrega enviada correctamente!",
      assignmentViewSubmissions: "Ver todas las entregas",
      previousLesson: "Anterior",
      nextLesson: "Siguiente",
      lessonNavigation: "Navegación entre lecciones"
    },
    dashboard: {
      title: "Mis Cursos",
      viewClass: "VER CLASE",
      empty: "Aún no tienes cursos.",
      emptySub: "Explora nuestro catálogo y empieza a bailar hoy mismo.",
      discover: "Últimos Cursos Añadidos",
      exploreAll: "Ver todos los cursos →"
    },
    login: {
      title: "Inicio de Sesión",
      subtitle: "Accede a la plataforma exclusiva de Luis y Sara",
      email: "Email",
      password: "Contraseña",
      submit: "Iniciar Sesión",
      noAccount: "¿No tienes cuenta? Regístrate",
      forgotPassword: "¿Olvidaste tu contraseña?",
      or: "O",
      panelEyebrow: "ACCESO PRIVADO",
      panelTitle: "Bailar es <em>recordar</em> con el cuerpo.",
      panelLead: "Vuelve a tu sitio en la academia: clases nuevas, comunidad activa y todo el archivo de Luis y Sara esperándote.",
      panelFeatures: ["Clases en vídeo en alta calidad", "Comunidad de bailarines y eventos", "Tu progreso, guardado lección a lección"],
      panelQuote: "La bachata no se aprende, se siente. Pero se practica.",
      cardEyebrow: "ENTRAR"
    },
    signup: {
      title: "Regístrate",
      subtitle: "Crea tu cuenta para acceder a la plataforma",
      email: "Email",
      fullName: "Nombre Completo",
      fullNamePlaceholder: "Juan Pérez",
      password: "Contraseña",
      submit: "Registrarse",
      hasAccount: "¿Ya tienes cuenta? Inicia Sesión",
      forgotPassword: "¿Olvidaste tu contraseña?",
      or: "O",
      panelEyebrow: "ÚNETE A LA ACADEMIA",
      panelTitle: "Tu primera <em>clase</em> empieza con un paso.",
      panelLead: "Crea tu cuenta y desbloquea acceso a las clases, los retos mensuales y la comunidad de Luis y Sara Bachatango.",
      panelFeatures: ["Acceso a clases para todos los niveles", "Eventos, quedadas y música cuidada", "Una comunidad cálida y sin postureo"],
      panelQuote: "Lo que se baila despacio, se entiende rápido.",
      cardEyebrow: "CREAR CUENTA"
    },
    forgotPassword: {
      title: "Recuperar Contraseña",
      subtitle: "Ingresa tu email para recibir un enlace de recuperación",
      email: "Email",
      submit: "Enviar enlace",
      backToLogin: "Volver al inicio de sesión",
      panelEyebrow: "RECUPERAR ACCESO",
      panelTitle: "Vuelve a la <em>pista</em> en un par de pasos.",
      panelLead: "Te enviamos un enlace seguro a tu email para que crees una nueva contraseña sin perder nada de tu progreso.",
      panelFeatures: ["Enlace válido durante un tiempo limitado", "Tu cuenta y tus clases siguen intactas", "Si no llega, revisa la carpeta de spam"],
      cardEyebrow: "RECUPERAR"
    },
    profile: {
      title: "Mi Perfil",
      editProfile: "Editar Perfil",
      accountInfo: "Información de Cuenta",
      email: "Email",
      subscription: "Suscripción",
      status: "Estado",
      active: "Activo",
      inactive: "Inactivo",
      activeUntil: "Tu suscripción está activa hasta el",
      noActiveSubscription: "No tienes una suscripción activa actualmente.",
      dangerZone: "Zona de Peligro",
      undoableWarning: "Estas acciones no se pueden deshacer.",
      logout: "Cerrar Sesión",
      deleteAccount: "Eliminar Cuenta"
    },
    pricing: {
      title: "Suscripciones",
      subtitle: "Accede a los cursos de bachata de Luis y Sara con una suscripción mensual. Cada mes incluye 4 clases nuevas.",
      comingSoon: "Próximamente",
      mostPopular: "Más popular",
      perMonth: "/mes",
      note: "¿Quieres acceder a un mes anterior? Puedes comprarlo individualmente desde la página del curso."
    },
    errors: {
      invalid_credentials: "Credenciales incorrectas. Comprueba tu email y contraseña.",
      signup_failed: "Error al crear la cuenta. Inténtalo de nuevo.",
      reset_failed: "Error al enviar el enlace. Inténtalo de nuevo.",
      unknown: "Ha ocurrido un error. Inténtalo de nuevo."
    },
    messages: {
      email_confirmation: "Revisa tu email para continuar el proceso de registro.",
      email_reset: "Revisa tu email para continuar el proceso de recuperación de contraseña.",
      account_deleted: "Cuenta eliminada correctamente."
    }
  },
  en: {
    header: {
      courses: "Courses",
      events: "Events",
      music: "Music",
      community: "Community",
      about: "About Us",
      login: "Login",
      profile: "My Profile",
      dashboard: "Dashboard",
      logout: "Log Out"
    },
    common: {
      processing: "Processing...",
      subscribeNow: "Subscribe Now",
      login: "Login"
    },
    footer: {
      description: "Learn Bachatango with Luis & Sara. The perfect fusion between the sensuality of bachata and the elegance of tango.",
      explore: "Explore",
      home: "Home",
      contact: "Contact",
      notice: "Legal Notice",
      legal: "Legal",
      terms: "Terms & Conditions",
      privacy: "Privacy Policy",
      cookies: "Cookie Policy",
      rights: "All rights reserved.",
      blog: "Blog"
    },
    hero: {
      title: "Master the Art of Bachatango",
      subtitle: "Learn with the best instructors, Luis & Sara. Exclusive courses, refined technique, and passion in every step.",
      cta: "DISCOVER OUR COURSES",
      sampleClass: "Watch sample class",
      scrollLabel: "Scroll to see more",
      stats: { years: "YEARS DANCING", students: "STUDENTS", countries: "COUNTRIES" }
    },
    features: {
      monthly: {
        title: "Complete Courses",
        desc: "Comprehensive programs from start to finish. Learn from beginner to advanced with a single payment and lifetime access."
      },
      exclusive: {
        title: "Exclusive Content",
        desc: "Access secrets of technique, musicality, and connection you won't find anywhere else. Expert masterclasses."
      },
      access: {
        title: "24/7 Access",
        desc: "Your learning platform always available. Practice at your own pace, repeat lessons, and perfect your style from home."
      }
    },
    testimonials: {
      title: "What Our Students Say",
      t1: {
        quote: "I never thought I could learn to connect like this with my partner through a screen. Luis and Sara's methodology is impeccable.",
        role: "Student"
      },
      t2: {
        quote: "I've been dancing bachata for years, but bachatango has been a discovery. The elegance they transmit in every class is inspiring.",
        role: "Amateur Dancer"
      },
      t3: {
        quote: "Perfect for home practice. Technical details make the difference. 100% recommended.",
        role: "Dance Couple"
      }
    },
    faq: {
      title: "Frequently Asked Questions",
      q1: {
        q: "Do I need previous dance experience?",
        a: "Not necessary. We have courses from beginner level designed for you to learn from scratch, step by step."
      },
      q2: {
        q: "How do I access the courses?",
        a: "Once you subscribe, you have immediate access to all content through the platform. You can watch classes as many times as you want."
      },
      q3: {
        q: "Can I cancel my subscription anytime?",
        a: "Yes, no commitments. You can cancel your subscription from your profile at any time and keep access until the end of the billing period."
      },
      q4: {
        q: "Does it work if I don't have a dance partner?",
        a: "Absolutely. Although Bachatango is a partner dance, many lessons focus on individual technique, musicality, and style that you can practice solo."
      }
    },
    newsletter: {
      title: "Join the Community",
      desc: "Receive exclusive dance tips, workshop news, and a free class when you subscribe.",
      placeholder: "Your email address",
      button: "Subscribe"
    },
    events: {
      title: "Agenda & Events",
      desc: "Discover where we will be next. Come learn, dance, and enjoy with us live.",
      details: "More Info",
      create: "New event",
      edit: "Edit",
      delete: "Delete",
      deleteConfirm: "Delete this event?",
      draft: "Draft",
      empty: { title: "We're preparing new dates", text: "Come back soon or follow us on social media for the next stop." },
      upcoming: { eyebrow: "AGENDA", heading: "Next stops", pill: "Upcoming", singular: "UPCOMING DATE", plural: "UPCOMING DATES" },
      past: { eyebrow: "ARCHIVE", heading: "Past dates", pill: "Past" }
    },
    music: {
      title: "Our Playlists",
      desc: "Music is the heart of dance. Here are the lists we use in our classes and for training every day."
    },
    blog: {
      title: "Blog & Articles",
      desc: "Reflections, technique, and culture. Deepen your knowledge of dance beyond steps.",
      readMore: "Read Article",
      items: {
        a1: { t: "What really is Bachatango?", c: "History", e: "Discover the origins of this controversial and beautiful fusion. It's not just bachata with pauses, it's a conversation between two genres." },
        a2: { t: "5 Common Posture Mistakes", c: "Technique", e: "The foundation of a good connection starts on your own axis. We analyze the most common faults preventing you from flowing with your partner." },
        a3: { t: "Musicality in Tango vs Bachata", c: "Musicality", e: "Understanding strong beats and melodies is key. Learn to differentiate when to step strongly and when to glide." }
      }
    },
    contact: {
      title: "Bookings",
      desc: "Do you want to bring us to your city? Fill out this form to request information about workshops, shows, and festivals.",
      form: {
        name: "Name / Organizer",
        namePlace: "Your name or event name",
        email: "Email Address",
        type: "Event Type",
        types: { fest: "Dance Festival", work: "Intensive Workshop", show: "Show / Performance", other: "Other" },
        message: "Details",
        messagePlace: "Tell us more about the event (dates, location, proposal...)",
        submit: "Send Request"
      }
    },
    about: {
      heroTitle: "Passion and Elegance",
      heroSubtitle: "The Story of Luis and Sara",
      bioTitle: "More than Dance, a Connection",
      bio1: "Luis and Sara are not just instructors; they are pioneers in the fusion of Bachata and Tango. With over a decade of experience on international stages, they have developed a unique methodology that combines the fluid sensuality of bachata with the precision and drama of tango.",
      bio2: "Their journey began in the dance halls of Madrid, where their individual styles collided to create something completely new. Today, they travel the world sharing their vision: that dance is the most honest language of the soul.",
      stats: {
        s1: "Years of Experience",
        s2: "Online Students",
        s3: "Countries Visited",
        s4: "International Champions"
      },
      quote: "Bachatango is not just steps, it is feeling your partner's breathing and converting it into movement. We want our students not only to learn to dance, but to feel.",
      cta: "Start Dancing Today"
    },
    communityPage: {
      joinTitle: "Join the Community",
      joinDesc: "To view and participate in exclusive Bachatango community discussions, you need to be registered and subscribed.",
      alreadyAccount: "Already have an account?",
      login: "Login",
      title: "Community",
      create: "Create Post"
    },
    coursesPage: {
      title: "Available Courses",
      create: "+ Create Course",
      empty: "No courses published at this moment.",
      emptySub: "Come back soon to see new classes from Luis & Sara!",
      view: "View Classes",
      viewMore: "View more →",
      buy: "Buy →",
      hasAccess: "✓ You have access",
      priceNA: "Price not available",
      completeCourses: "Full Courses",
      completeSub: "Fixed price · Permanent access",
      monthlyClasses: "Monthly Classes",
      monthlySub: "4 classes per month · Subscription or individual monthly purchase",
      filterAll: "All",
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    },
    lesson: {
      backToCourse: "← Back to Course",
      courseLessons: "Course Lessons",
      lockedContent: "Locked Content",
      lockedMessage: "This video is exclusive for Premium members.",
      getPremium: "Get Premium",
      editLesson: "✎ Edit Lesson",
      exclusiveContent: "The content of this lesson is exclusive for Premium members.",
      description: "Description",
      musicalResources: "Musical Resources",
      assignment: "Assignment",
      comments: "Comments",
      resourcesComingSoon: "Musical resources coming soon...",
      assignmentNoTask: "The instructor has not assigned any task for this lesson.",
      assignmentNoTaskAdmin: "No task yet for this lesson. Add one from \"Edit Lesson\".",
      assignmentReviewed: "✓ Task reviewed",
      assignmentGradeLabel: "Grade:",
      assignmentResponseLabel: "Your response (text)",
      assignmentFileLabel: "Attach file (optional)",
      assignmentResponsePlaceholder: "Write your response here...",
      assignmentSubmitBtn: "Submit",
      assignmentUpdateBtn: "Update submission",
      assignmentUploading: "Uploading file...",
      assignmentSending: "Sending...",
      assignmentSuccess: "Submission sent successfully!",
      assignmentViewSubmissions: "View all submissions",
      previousLesson: "Previous",
      nextLesson: "Next",
      lessonNavigation: "Lesson navigation"
    },
    dashboard: {
      title: "My Courses",
      viewClass: "VIEW CLASS",
      empty: "You don't have any courses yet.",
      emptySub: "Explore our catalog and start dancing today.",
      discover: "Latest Added Courses",
      exploreAll: "View all courses →"
    },
    login: {
      title: "Sign In",
      subtitle: "Access the exclusive Luis & Sara platform",
      email: "Email",
      password: "Password",
      submit: "Sign In",
      noAccount: "Don't have an account? Sign Up",
      forgotPassword: "Forgot your password?",
      or: "Or",
      panelEyebrow: "PRIVATE ACCESS",
      panelTitle: "Dance is <em>remembering</em> with your body.",
      panelLead: "Return to your place at the academy: new classes, active community, and the entire Luis & Sara archive waiting for you.",
      panelFeatures: ["High quality video classes", "Dancer community and events", "Your progress, saved lesson by lesson"],
      panelQuote: "Bachata is not learned, it is felt. But it is practiced.",
      cardEyebrow: "SIGN IN"
    },
    signup: {
      title: "Sign Up",
      subtitle: "Create your account to access the platform",
      email: "Email",
      fullName: "Full Name",
      fullNamePlaceholder: "John Doe",
      password: "Password",
      submit: "Sign Up",
      hasAccount: "Already have an account? Sign In",
      forgotPassword: "Forgot your password?",
      or: "Or",
      panelEyebrow: "JOIN THE ACADEMY",
      panelTitle: "Your first <em>class</em> starts with one step.",
      panelLead: "Create your account and unlock access to classes, monthly challenges, and the Luis & Sara Bachatango community.",
      panelFeatures: ["Access to classes for all levels", "Events, meetups, and curated music", "A warm, down-to-earth community"],
      panelQuote: "What is danced slowly, is understood quickly.",
      cardEyebrow: "CREATE ACCOUNT"
    },
    forgotPassword: {
      title: "Recover Password",
      subtitle: "Enter your email to receive a recovery link",
      email: "Email",
      submit: "Send link",
      backToLogin: "Back to login",
      panelEyebrow: "RECOVER ACCESS",
      panelTitle: "Get back on the <em>floor</em> in a few steps.",
      panelLead: "We'll send a secure link to your email so you can create a new password without losing any of your progress.",
      panelFeatures: ["Link valid for a limited time", "Your account and classes remain intact", "If it doesn't arrive, check your spam folder"],
      cardEyebrow: "RECOVER"
    },
    profile: {
      title: "My Profile",
      editProfile: "Edit Profile",
      accountInfo: "Account Information",
      email: "Email",
      subscription: "Subscription",
      status: "Status",
      active: "Active",
      inactive: "Inactive",
      activeUntil: "Your subscription is active until",
      noActiveSubscription: "You don't have an active subscription currently.",
      dangerZone: "Danger Zone",
      undoableWarning: "These actions cannot be undone.",
      logout: "Log Out",
      deleteAccount: "Delete Account"
    },
    pricing: {
      title: "Subscriptions",
      subtitle: "Access Luis & Sara's bachata courses with a monthly subscription. Each month includes 4 new classes.",
      comingSoon: "Coming Soon",
      mostPopular: "Most popular",
      perMonth: "/month",
      note: "Want to access a previous month? You can purchase it individually from the course page."
    },
    errors: {
      invalid_credentials: "Invalid credentials. Check your email and password.",
      signup_failed: "Failed to create account. Please try again.",
      reset_failed: "Failed to send reset link. Please try again.",
      unknown: "An error occurred. Please try again."
    },
    messages: {
      email_confirmation: "Check your email to continue the sign in process.",
      email_reset: "Check your email to continue the password reset process.",
      account_deleted: "Account deleted successfully."
    }
  },
  fr: {
    header: {
      courses: "Cours", events: "Événements", music: "Musique", community: "Communauté", about: "À Propos", login: "Connexion", profile: "Mon Profil", dashboard: "Dashboard", logout: "Déconnexion"
    },
    common: {
      processing: "Traitement...",
      subscribeNow: "S'abonner Maintenant",
      login: "Connexion"
    },
    footer: {
      description: "Apprenez le Bachatango avec Luis et Sara. La fusion parfaite entre la sensualité de la bachata et l'élégance du tango.",
      explore: "Explorer", home: "Accueil", contact: "Contact", notice: "Mentions Légales",
      legal: "Légal", terms: "Conditions Générales", privacy: "Politique de Confidentialité", cookies: "Politique de Cookies", rights: "Tous droits réservés.", blog: "Blog"
    },
    hero: {
      title: "Maîtrisez l'Art du Bachatango",
      subtitle: "Apprenez avec les meilleurs instructeurs, Luis et Sara. Cours exclusifs, technique raffinée et passion à chaque pas.",
      cta: "DÉCOUVREZ NOS COURS",
      sampleClass: "Voir la classe exemple",
      scrollLabel: "Défiler pour voir plus",
      stats: { years: "ANS DE DANSE", students: "ÉLÈVES", countries: "PAYS" }
    },
    features: {
      monthly: { title: "Cours Complets", desc: "Programmes complets de A à Z. Apprenez du niveau débutant à avancé avec un paiement unique et un accès à vie." },
      exclusive: { title: "Contenu Exclusif", desc: "Accédez à des secrets de technique, de musicalité et de connexion introuvables ailleurs. Masterclasses d'experts." },
      access: { title: "Accès 24/7", desc: "Votre plateforme d'apprentissage toujours disponible. Pratiquez à votre rythme, répétez les leçons et perfectionnez votre style depuis chez vous." }
    },
    testimonials: {
      title: "Ce Que Disent Nos Élèves",
      t1: { quote: "Je n'aurais jamais cru pouvoir apprendre à connecter ainsi avec mon partenaire via un écran. La méthodologie de Luis et Sara est impeccable.", role: "Élève" },
      t2: { quote: "Je danse la bachata depuis des années, mais le bachatango a été une découverte. L'élégance qu'ils transmettent dans chaque cours est inspirante.", role: "Danseur Amateur" },
      t3: { quote: "Parfait pour pratiquer à la maison. Les détails techniques font la différence. 100% recommandé.", role: "Couple de Danse" }
    },
    faq: {
      title: "Questions Fréquentes",
      q1: { q: "Ai-je besoin d'expérience en danse ?", a: "Ce n'est pas nécessaire. Nous avons des cours de niveau débutant conçus pour apprendre de zéro, étape par étape." },
      q2: { q: "Comment accéder aux cours ?", a: "Une fois abonné, vous avez un accès immédiat à tout le contenu sur la plateforme. Vous pouvez voir les cours autant de fois que vous le souhaitez." },
      q3: { q: "Puis-je annuler mon abonnement à tout moment ?", a: "Oui, sans engagement. Vous pouvez annuler votre abonnement depuis votre profil à tout moment et conserver l'accès jusqu'à la fin de la période facturée." },
      q4: { q: "Est-ce utile si je n'ai pas de partenaire ?", a: "Absolument. Bien que le Bachatango soit une danse de couple, de nombreuses leçons se concentrent sur la technique individuelle, la musicalité et le style." }
    },
    newsletter: {
      title: "Rejoignez la Communauté", desc: "Recevez des conseils exclusifs, des nouvelles sur les ateliers et un cours gratuit en vous abonnant.", placeholder: "Votre email", button: "S'abonner"
    },
    events: {
      title: "Agenda & Événements", desc: "Découvrez où nous serons prochainement. Venez apprendre, danser et profiter avec nous en direct.", details: "Plus d'infos",
      create: "Nouvel événement",
      edit: "Modifier",
      delete: "Supprimer",
      deleteConfirm: "Supprimer cet événement ?",
      draft: "Brouillon",
      empty: { title: "Nous préparons de nouvelles dates", text: "Revenez bientôt ou suivez-nous sur les réseaux sociaux pour la prochaine étape." },
      upcoming: { eyebrow: "AGENDA", heading: "Prochaines étapes", pill: "À venir", singular: "DATE À VENIR", plural: "DATES À VENIR" },
      past: { eyebrow: "ARCHIVES", heading: "Dates passées", pill: "Passé" }
    },
    music: { title: "Nos Playlists", desc: "La musique est le cœur de la danse. Voici les listes que nous utilisons dans nos cours." },
    blog: {
      title: "Blog & Articles", desc: "Réflexions, technique et culture. Approfondissez vos connaissances.", readMore: "Lire l'article",
      items: {
        a1: { t: "Qu'est-ce que le Bachatango vraiment ?", c: "Histoire", e: "Découvrez les origines de cette fusion controversée et belle." },
        a2: { t: "5 Erreurs Courantes de Posture", c: "Technique", e: "La base d'une bonne connexion commence par votre propre axe." },
        a3: { t: "La Musicalité dans le Tango vs Bachata", c: "Musicalité", e: "Comprendre les temps forts et les mélodies est clé." }
      }
    },
    contact: {
      title: "Bookings", desc: "Vous voulez nous faire venir dans votre ville ? Remplissez ce formulaire.",
      form: {
        name: "Nom / Organisateur", namePlace: "Votre nom ou nom de l'événement",
        email: "Email", type: "Type d'événement", types: { fest: "Festival", work: "Atelier", show: "Show", other: "Autre" },
        message: "Détails", messagePlace: "Dites-nous en plus...", submit: "Envoyer"
      }
    },
    about: {
      heroTitle: "Passion et Élégance", heroSubtitle: "L'Histoire de Luis et Sara", bioTitle: "Plus que de la Danse, une Connexion",
      bio1: "Luis et Sara sont des pionniers de la fusion Bachata et Tango. Avec plus de 10 ans d'expérience, ils ont créé une méthodologie unique.",
      bio2: "Leur voyage a commencé à Madrid. Aujourd'hui, ils parcourent le monde pour partager leur vision.",
      stats: { s1: "Années d'Expérience", s2: "Étudiants en Ligne", s3: "Pays Visités", s4: "Champions Internationaux" },
      quote: "Le bachatango n'est pas que des pas, c'est sentir la respiration de son partenaire.", cta: "Commencez à Danser Aujourd'hui"
    },
    communityPage: {
      joinTitle: "Rejoignez la Communauté",
      joinDesc: "Pour voir et participer aux discussions exclusives, vous devez être inscrit et abonné.",
      alreadyAccount: "Déjà un compte ?",
      login: "Connexion",
      title: "Communauté",
      create: "Créer un Post"
    },
    coursesPage: {
      title: "Cours Disponibles",
      create: "+ Créer un Cours",
      empty: "Aucun cours publié pour le moment.",
      emptySub: "Revenez bientôt pour voir les nouvelles classes !",
      view: "Voir les Cours",
      viewMore: "Voir plus →",
      buy: "Acheter →",
      hasAccess: "✓ Vous avez accès",
      priceNA: "Prix non disponible",
      completeCourses: "Cours Complets",
      completeSub: "Prix fixe · Accès permanent",
      monthlyClasses: "Cours Mensuels",
      monthlySub: "4 cours par mois · Abonnement ou achat individuel par mois",
      filterAll: "Tous",
      months: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    },
    lesson: {
      backToCourse: "← Retour au Cours",
      courseLessons: "Leçons du Cours",
      lockedContent: "Contenu Verrouillé",
      lockedMessage: "Cette vidéo est réservée aux membres Premium.",
      getPremium: "Obtenir Premium",
      editLesson: "✎ Modifier la Leçon",
      exclusiveContent: "Le contenu de cette leçon est réservé aux membres Premium.",
      description: "Description",
      musicalResources: "Ressources Musicales",
      assignment: "Devoir",
      comments: "Commentaires",
      resourcesComingSoon: "Ressources musicales bientôt...",
      assignmentNoTask: "Le professeur n'a assigné aucun devoir pour cette leçon.",
      assignmentNoTaskAdmin: "Pas encore de devoir pour cette leçon. Ajoutez-en un depuis \"Modifier la leçon\".",
      assignmentReviewed: "✓ Devoir corrigé",
      assignmentGradeLabel: "Note :",
      assignmentResponseLabel: "Votre réponse (texte)",
      assignmentFileLabel: "Joindre un fichier (optionnel)",
      assignmentResponsePlaceholder: "Écrivez votre réponse ici...",
      assignmentSubmitBtn: "Envoyer",
      assignmentUpdateBtn: "Mettre à jour",
      assignmentUploading: "Téléchargement...",
      assignmentSending: "Envoi...",
      assignmentSuccess: "Devoir envoyé avec succès !",
      assignmentViewSubmissions: "Voir toutes les soumissions",
      previousLesson: "Précédent",
      nextLesson: "Suivant",
      lessonNavigation: "Navigation entre leçons"
    },
    dashboard: {
      title: "Mes Cours",
      viewClass: "VOIR LA CLASSE",
      empty: "Vous n'avez encore aucun cours.",
      emptySub: "Explorez notre catalogue et commencez à danser dès aujourd'hui.",
      discover: "Derniers Cours Ajoutés",
      exploreAll: "Voir tous les cours →"
    },
    login: {
      title: "Connexion",
      subtitle: "Accédez à la plateforme exclusive de Luis et Sara",
      email: "Email",
      password: "Mot de passe",
      submit: "Se connecter",
      noAccount: "Pas de compte ? S'inscrire",
      forgotPassword: "Mot de passe oublié ?",
      or: "Ou",
      panelEyebrow: "ACCÈS PRIVÉ",
      panelTitle: "Danser, c'est <em>se souvenir</em> avec son corps.",
      panelLead: "Retrouvez votre place à l'académie : de nouveaux cours, une communauté active et toute l'archive de Luis et Sara vous attendent.",
      panelFeatures: ["Cours vidéo en haute qualité", "Communauté de danseurs et événements", "Votre progression, sauvegardée leçon par leçon"],
      panelQuote: "La bachata ne s'apprend pas, elle se ressent. Mais elle se pratique.",
      cardEyebrow: "SE CONNECTER"
    },
    signup: {
      title: "S'inscrire",
      subtitle: "Créez votre compte pour accéder à la plateforme",
      email: "Email",
      fullName: "Nom Complet",
      fullNamePlaceholder: "Jean Dupont",
      password: "Mot de passe",
      submit: "S'inscrire",
      hasAccount: "Déjà un compte ? Connexion",
      forgotPassword: "Mot de passe oublié ?",
      or: "Ou",
      panelEyebrow: "REJOIGNEZ L'ACADÉMIE",
      panelTitle: "Votre premier <em>cours</em> commence par un pas.",
      panelLead: "Créez votre compte et débloquez l'accès aux cours, aux défis mensuels et à la communauté Luis y Sara Bachatango.",
      panelFeatures: ["Accès aux cours pour tous les niveaux", "Événements, rencontres et musique sélectionnée", "Une communauté chaleureuse et authentique"],
      panelQuote: "Ce qui est dansé lentement est compris rapidement.",
      cardEyebrow: "CRÉER UN COMPTE"
    },
    forgotPassword: {
      title: "Récupérer le Mot de Passe",
      subtitle: "Entrez votre email pour recevoir un lien de récupération",
      email: "Email",
      submit: "Envoyer le lien",
      backToLogin: "Retour à la connexion",
      panelEyebrow: "RÉCUPÉRER L'ACCÈS",
      panelTitle: "Revenez sur la <em>piste</em> en quelques étapes.",
      panelLead: "Nous vous envoyons un lien sécurisé à votre email pour créer un nouveau mot de passe sans perdre votre progression.",
      panelFeatures: ["Lien valide pendant un temps limité", "Votre compte et vos cours restent intacts", "S'il n'arrive pas, vérifiez vos spams"],
      cardEyebrow: "RÉCUPÉRER"
    },
    profile: {
      title: "Mon Profil",
      editProfile: "Modifier le Profil",
      accountInfo: "Informations du Compte",
      email: "Email",
      subscription: "Abonnement",
      status: "Statut",
      active: "Actif",
      inactive: "Inactif",
      activeUntil: "Votre abonnement est actif jusqu'au",
      noActiveSubscription: "Vous n'avez pas d'abonnement actif actuellement.",
      dangerZone: "Zone Dangereuse",
      undoableWarning: "Ces actions sont irréversibles.",
      logout: "Déconnexion",
      deleteAccount: "Supprimer le Compte"
    },
    pricing: {
      title: "Abonnements",
      subtitle: "Accédez aux cours de bachata de Luis et Sara avec un abonnement mensuel. Chaque mois comprend 4 nouveaux cours.",
      comingSoon: "Bientôt",
      mostPopular: "Le plus populaire",
      perMonth: "/mois",
      note: "Vous voulez accéder à un mois précédent ? Vous pouvez l'acheter individuellement depuis la page du cours."
    },
    errors: {
      invalid_credentials: "Identifiants incorrects. Vérifiez votre email et votre mot de passe.",
      signup_failed: "Échec de la création du compte. Réessayez.",
      reset_failed: "Échec de l'envoi du lien. Réessayez.",
      unknown: "Une erreur s'est produite. Réessayez."
    },
    messages: {
      email_confirmation: "Consultez votre email pour continuer le processus d'inscription.",
      email_reset: "Consultez votre email pour continuer le processus de réinitialisation.",
      account_deleted: "Compte supprimé avec succès."
    }
  },
  de: {
    header: {
      courses: "Kurse", events: "Events", music: "Musik", community: "Community", about: "Über Uns", login: "Anmelden", profile: "Mein Profil", dashboard: "Dashboard", logout: "Abmelden"
    },
    common: {
      processing: "Verarbeitung...",
      subscribeNow: "Jetzt Abonnieren",
      login: "Anmelden"
    },
    footer: {
      description: "Lerne Bachatango mit Luis und Sara. Die perfekte Fusion zwischen der Sinnlichkeit von Bachata und der Eleganz des Tango.",
      explore: "Entdecken", home: "Startseite", contact: "Kontakt", notice: "Impressum",
      legal: "Rechtliches", terms: "AGB", privacy: "Datenschutz", cookies: "Cookie-Richtlinie", rights: "Alle Rechte vorbehalten.", blog: "Blog"
    },
    hero: {
      title: "Meistere die Kunst des Bachatango",
      subtitle: "Lerne von den besten Lehrern, Luis und Sara. Exklusive Kurse, verfeinerte Technik und Leidenschaft in jedem Schritt.",
      cta: "ENTDECKE UNSERE KURSE",
      sampleClass: "Musterklasse ansehen",
      scrollLabel: "Nach unten scrollen",
      stats: { years: "JAHRE TANZEND", students: "SCHÜLER", countries: "LÄNDER" }
    },
    features: {
      monthly: { title: "Komplette Kurse", desc: "Umfassende Programme von Anfang bis Ende. Lerne vom Anfänger bis zum Fortgeschrittenen mit einer einmaligen Zahlung und lebenslangem Zugang." },
      exclusive: { title: "Exklusiver Inhalt", desc: "Zugang zu Geheimnissen der Technik, Musikalität und Verbindung. Masterclasses von Experten." },
      access: { title: "24/7 Zugang", desc: "Deine Lernplattform immer verfügbar. Übe in deinem eigenen Tempo von zu Hause aus." }
    },
    testimonials: {
      title: "Was Unsere Schüler Sagen",
      t1: { quote: "Ich hätte nie gedacht, dass ich über einen Bildschirm so eine Verbindung lernen könnte.", role: "Schülerin" },
      t2: { quote: "Ich tanze seit Jahren Bachata, aber Bachatango war eine Entdeckung.", role: "Amateur-Tänzer" },
      t3: { quote: "Perfekt für das Üben zu Hause. Die technischen Details machen den Unterschied.", role: "Tanzpaar" }
    },
    faq: {
      title: "Häufige Fragen",
      q1: { q: "Brauche ich Vorkenntnisse?", a: "Nicht notwendig. Wir haben Anfängerkurse." },
      q2: { q: "Wie greife ich auf die Kurse zu?", a: "Nach dem Abonnieren hast du sofortigen Zugriff." },
      q3: { q: "Kann ich jederzeit kündigen?", a: "Ja, ohne Verpflichtungen." },
      q4: { q: "Geht das auch ohne Tanzpartner?", a: "Absolut. Viele Lektionen konzentrieren sich auf individuelle Technik." }
    },
    newsletter: {
      title: "Tritt der Community bei", desc: "Erhalte exklusive Tipps und eine kostenlose Klasse.", placeholder: "Deine Email", button: "Abonnieren"
    },
    events: {
      title: "Agenda & Events", desc: "Entdecke, wo wir als nächstes sind.", details: "Mehr Infos",
      create: "Neue Veranstaltung",
      edit: "Bearbeiten",
      delete: "Löschen",
      deleteConfirm: "Diese Veranstaltung löschen?",
      draft: "Entwurf",
      empty: { title: "Wir bereiten neue Termine vor", text: "Schauen Sie bald wieder vorbei oder folgen Sie uns in den sozialen Medien für den nächsten Termin." },
      upcoming: { eyebrow: "AGENDA", heading: "Nächste Stationen", pill: "Bevorstehend", singular: "KOMMENDER TERMIN", plural: "KOMMENDE TERMINE" },
      past: { eyebrow: "ARCHIV", heading: "Vergangene Termine", pill: "Vergangen" }
    },
    music: { title: "Unsere Playlists", desc: "Musik ist das Herz des Tanzes." },
    blog: {
      title: "Blog & Artikel", desc: "Reflexionen, Technik und Kultur.", readMore: "Artikel lesen",
      items: {
        a1: { t: "Was ist Bachatango wirklich?", c: "Geschichte", e: "Entdecke die Ursprünge dieser Fusion." },
        a2: { t: "5 Häufige Haltungsfehler", c: "Technik", e: "Die Basis einer guten Verbindung beginnt bei dir." },
        a3: { t: "Musikalität in Tango vs Bachata", c: "Musikalität", e: "Verstehe die starken Beats und Melodien." }
      }
    },
    contact: {
      title: "Buchungen", desc: "Willst du uns buchen?",
      form: {
        name: "Name / Veranstalter", namePlace: "Dein Name",
        email: "Email", type: "Event-Typ", types: { fest: "Festival", work: "Workshop", show: "Show", other: "Andere" },
        message: "Details", messagePlace: "Erzähl uns mehr...", submit: "Anfrage senden"
      }
    },
    about: {
      heroTitle: "Leidenschaft und Eleganz", heroSubtitle: "Die Geschichte von Luis und Sara", bioTitle: "Mehr als Tanz",
      bio1: "Luis und Sara sind Pioniere der Bachata-Tango-Fusion.",
      bio2: "Ihre Reise begann in Madrid. Heute reisen sie um die Welt.",
      stats: { s1: "Jahre Erfahrung", s2: "Online-Schüler", s3: "Besuchte Länder", s4: "Internationale Champions" },
      quote: "Bachatango ist nicht nur Schritte, es ist Fühlen.", cta: "Fang heute an zu tanzen"
    },
    communityPage: {
      joinTitle: "Tritt der Community bei",
      joinDesc: "Um an exklusiven Diskussionen teilzunehmen, musst du registriert und abonniert sein.",
      alreadyAccount: "Hast du schon ein Konto?",
      login: "Anmelden",
      title: "Community",
      create: "Beitrag erstellen"
    },
    coursesPage: {
      title: "Verfügbare Kurse",
      create: "+ Kurs erstellen",
      empty: "Momentan keine Kurse veröffentlicht.",
      emptySub: "Komm bald wieder für neue Klassen!",
      view: "Kurse ansehen",
      viewMore: "Mehr anzeigen →",
      buy: "Kaufen →",
      hasAccess: "✓ Du hast Zugang",
      priceNA: "Preis nicht verfügbar",
      completeCourses: "Vollständige Kurse",
      completeSub: "Festpreis · Dauerhafter Zugang",
      monthlyClasses: "Monatliche Klassen",
      monthlySub: "4 Klassen pro Monat · Abo oder monatlicher Einzelkauf",
      filterAll: "Alle",
      months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
    },
    lesson: {
      backToCourse: "← Zurück zum Kurs",
      courseLessons: "Kurslektionen",
      lockedContent: "Gesperrter Inhalt",
      lockedMessage: "Dieses Video ist exklusiv für Premium-Mitglieder.",
      getPremium: "Premium holen",
      editLesson: "✎ Lektion bearbeiten",
      exclusiveContent: "Der Inhalt dieser Lektion ist exklusiv für Premium-Mitglieder.",
      description: "Beschreibung",
      musicalResources: "Musikalische Ressourcen",
      assignment: "Aufgabe",
      comments: "Kommentare",
      resourcesComingSoon: "Musikalische Ressourcen demnächst...",
      assignmentNoTask: "Der Lehrer hat für diese Lektion keine Aufgabe zugewiesen.",
      assignmentNoTaskAdmin: "Noch keine Aufgabe für diese Lektion. Füge eine in \"Lektion bearbeiten\" hinzu.",
      assignmentReviewed: "✓ Aufgabe bewertet",
      assignmentGradeLabel: "Bewertung:",
      assignmentResponseLabel: "Deine Antwort (Text)",
      assignmentFileLabel: "Datei anhängen (optional)",
      assignmentResponsePlaceholder: "Schreibe deine Antwort hier...",
      assignmentSubmitBtn: "Einreichen",
      assignmentUpdateBtn: "Einreichung aktualisieren",
      assignmentUploading: "Datei wird hochgeladen...",
      assignmentSending: "Wird gesendet...",
      assignmentSuccess: "Einreichung erfolgreich gesendet!",
      assignmentViewSubmissions: "Alle Einreichungen ansehen",
      previousLesson: "Vorherige",
      nextLesson: "Nächste",
      lessonNavigation: "Lektionsnavigation"
    },
    dashboard: {
      title: "Meine Kurse",
      viewClass: "KLASSE ANSEHEN",
      empty: "Du hast noch keine Kurse.",
      emptySub: "Entdecke unseren Katalog und fang noch heute an zu tanzen.",
      discover: "Neueste Kurse",
      exploreAll: "Alle Kurse ansehen →"
    },
    login: {
      title: "Anmelden",
      subtitle: "Zugang zur exklusiven Plattform von Luis und Sara",
      email: "Email",
      password: "Passwort",
      submit: "Anmelden",
      noAccount: "Kein Konto? Registrieren",
      forgotPassword: "Passwort vergessen?",
      or: "Oder",
      panelEyebrow: "PRIVATER ZUGANG",
      panelTitle: "Tanzen ist <em>erinnern</em> mit dem Körper.",
      panelLead: "Kehr zu deinem Platz in der Akademie zurück: neue Kurse, aktive Community und das gesamte Archiv von Luis und Sara warten auf dich.",
      panelFeatures: ["Videoklassen in hoher Qualität", "Tänzergemeinschaft und Events", "Dein Fortschritt, Lektion für Lektion gespeichert"],
      panelQuote: "Bachata wird nicht gelernt, sie wird gefühlt. Aber sie wird geübt.",
      cardEyebrow: "ANMELDEN"
    },
    signup: {
      title: "Registrieren",
      subtitle: "Erstelle dein Konto für den Zugang zur Plattform",
      email: "Email",
      fullName: "Vollständiger Name",
      fullNamePlaceholder: "Max Mustermann",
      password: "Passwort",
      submit: "Registrieren",
      hasAccount: "Schon ein Konto? Anmelden",
      forgotPassword: "Passwort vergessen?",
      or: "Oder",
      panelEyebrow: "TRITT DER AKADEMIE BEI",
      panelTitle: "Deine erste <em>Stunde</em> beginnt mit einem Schritt.",
      panelLead: "Erstelle dein Konto und schalte Zugang zu Kursen, monatlichen Herausforderungen und der Luis y Sara Bachatango-Community frei.",
      panelFeatures: ["Zugang zu Kursen für alle Levels", "Events, Treffen und kuratierte Musik", "Eine herzliche und authentische Community"],
      panelQuote: "Was langsam getanzt wird, wird schnell verstanden.",
      cardEyebrow: "KONTO ERSTELLEN"
    },
    forgotPassword: {
      title: "Passwort Wiederherstellen",
      subtitle: "Gib deine E-Mail ein, um einen Wiederherstellungslink zu erhalten",
      email: "Email",
      submit: "Link senden",
      backToLogin: "Zurück zur Anmeldung",
      panelEyebrow: "ZUGANG WIEDERHERSTELLEN",
      panelTitle: "Zurück auf die <em>Tanzfläche</em> in wenigen Schritten.",
      panelLead: "Wir senden dir einen sicheren Link an deine E-Mail, damit du ein neues Passwort erstellen kannst, ohne deinen Fortschritt zu verlieren.",
      panelFeatures: ["Link für begrenzte Zeit gültig", "Dein Konto und deine Kurse bleiben unversehrt", "Falls er nicht ankommt, überprüfe deinen Spam-Ordner"],
      cardEyebrow: "WIEDERHERSTELLEN"
    },
    profile: {
      title: "Mein Profil",
      editProfile: "Profil bearbeiten",
      accountInfo: "Kontoinformationen",
      email: "Email",
      subscription: "Abonnement",
      status: "Status",
      active: "Aktiv",
      inactive: "Inaktiv",
      activeUntil: "Dein Abonnement ist aktiv bis",
      noActiveSubscription: "Du hast aktuell kein aktives Abonnement.",
      dangerZone: "Gefahrenzone",
      undoableWarning: "Diese Aktionen können nicht rückgängig gemacht werden.",
      logout: "Abmelden",
      deleteAccount: "Konto löschen"
    },
    pricing: {
      title: "Abonnements",
      subtitle: "Greife mit einem Monatsabonnement auf die Bachatakurse von Luis und Sara zu. Jeden Monat gibt es 4 neue Klassen.",
      comingSoon: "Demnächst",
      mostPopular: "Am beliebtesten",
      perMonth: "/Monat",
      note: "Möchtest du auf einen früheren Monat zugreifen? Du kannst ihn einzeln von der Kursseite kaufen."
    },
    errors: {
      invalid_credentials: "Falsche Anmeldedaten. Überprüfe deine E-Mail und dein Passwort.",
      signup_failed: "Konto konnte nicht erstellt werden. Bitte versuche es erneut.",
      reset_failed: "Link konnte nicht gesendet werden. Bitte versuche es erneut.",
      unknown: "Ein Fehler ist aufgetreten. Bitte versuche es erneut."
    },
    messages: {
      email_confirmation: "Überprüfe deine E-Mail, um den Anmeldeprozess fortzusetzen.",
      email_reset: "Überprüfe deine E-Mail, um den Passwort-Zurücksetzen-Prozess fortzusetzen.",
      account_deleted: "Konto erfolgreich gelöscht."
    }
  },
  it: {
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
      title: "Unisciti alla Comunità", desc: "Ricevi consigli esclusivi.", placeholder: "La tua email", button: "Iscriviti"
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
      panelTitle: "Ballare è <em>ricordare</em> con il corpo.",
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
      panelTitle: "La tua prima <em>lezione</em> inizia con un passo.",
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
      panelTitle: "Torna in <em>pista</em> in pochi passi.",
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
      reset_failed: "Impossibile inviare il link. Riprova.",
      unknown: "Si è verificato un errore. Riprova."
    },
    messages: {
      email_confirmation: "Controlla la tua email per continuare il processo di registrazione.",
      email_reset: "Controlla la tua email per continuare il processo di recupero password.",
      account_deleted: "Account eliminato con successo."
    }
  },
  ja: {
    header: {
      courses: "コース", events: "イベント", music: "音楽", community: "コミュニティ", about: "私達について", login: "ログイン", profile: "プロフィール", dashboard: "ダッシュボード", logout: "ログアウト"
    },
    common: {
      processing: "処理中...",
      subscribeNow: "今すぐ登録",
      login: "ログイン"
    },
    footer: {
      description: "ルイスとサラと一緒にバチャタンゴを学びましょう。バチャータの官能性とタンゴの優雅さの完璧な融合。",
      explore: "探索", home: "ホーム", contact: "お問い合わせ", notice: "法的通知",
      legal: "法的事項", terms: "利用規約", privacy: "プライバシーポリシー", cookies: "クッキーポリシー", rights: "全著作権所有。", blog: "ブログ"
    },
    hero: {
      title: "バチャタンゴの芸術をマスターする",
      subtitle: "最高のインストラクター、ルイスとサラから学びましょう。独占コース、洗練されたテクニック、そして情熱を一歩一歩。",
      cta: "コースを見る",
      sampleClass: "サンプルクラスを見る",
      scrollLabel: "スクロールして詳細を見る",
      stats: { years: "ダンス歴", students: "受講生", countries: "訪問国" }
    },
    features: {
      monthly: { title: "完全コース", desc: "初心者から上級者まで、最初から最後まで学べる総合プログラム。一度のお支払いで生涯アクセス可能。" },
      exclusive: { title: "独占コンテンツ", desc: "他では見られないテクニック、音楽性、コネクションの秘密。" },
      access: { title: "24時間365日アクセス", desc: "いつでも利用可能な学習プラットフォーム。" }
    },
    testimonials: {
      title: "生徒の声",
      t1: { quote: "画面越しにこんな風につながることを学べるとは思いませんでした。", role: "生徒" },
      t2: { quote: "バチャタンゴは発見でした。", role: "アマチュアダンサー" },
      t3: { quote: "自宅練習に最適。", role: "ダンスカップル" }
    },
    faq: {
      title: "よくある質問",
      q1: { q: "経験は必要ですか？", a: "必要ありません。" },
      q2: { q: "コースへのアクセス方法は？", a: "登録後すぐにアクセスできます。" },
      q3: { q: "キャンセルは可能ですか？", a: "はい、いつでも可能です。" },
      q4: { q: "パートナーがいなくても大丈夫？", a: "もちろんです。" }
    },
    newsletter: {
      title: "コミュニティに参加", desc: "独占的なダンスのヒントを受け取る。", placeholder: "メールアドレス", button: "登録する"
    },
    events: {
      title: "アジェンダ＆イベント", desc: "次に行く場所をチェック。", details: "詳細",
      create: "新しいイベント",
      edit: "編集",
      delete: "削除",
      deleteConfirm: "このイベントを削除しますか？",
      draft: "下書き",
      empty: { title: "新しい日程を準備中です", text: "近日中にまたチェックしてください。次の開催情報はSNSでお知らせします。" },
      upcoming: { eyebrow: "アジェンダ", heading: "次の開催地", pill: "まもなく", singular: "まもなく開催", plural: "今後の予定" },
      past: { eyebrow: "アーカイブ", heading: "過去の日程", pill: "終了" }
    },
    music: { title: "プレイリスト", desc: "音楽はダンスの心臓です。" },
    blog: {
      title: "ブログ＆記事", desc: "考察、テクニック、文化。", readMore: "続きを読む",
      items: {
        a1: { t: "バチャタンゴとは何か？", c: "歴史", e: "この融合の起源を発見する。" },
        a2: { t: "姿勢の5つのよくある間違い", c: "テクニック", e: "良いコネクションの基礎。" },
        a3: { t: "タンゴ対バチャータの音楽性", c: "音楽性", e: "強いビートとメロディーを理解する。" }
      }
    },
    contact: {
      title: "予約", desc: "あなたの街に私たちを呼びたいですか？",
      form: {
        name: "名前 / 主催者", namePlace: "あなたの名前",
        email: "メール", type: "イベントタイプ", types: { fest: "フェスティバル", work: "ワークショップ", show: "ショー", other: "その他" },
        message: "詳細", messagePlace: "詳しく教えてください...", submit: "送信"
      }
    },
    about: {
      heroTitle: "情熱と優雅さ", heroSubtitle: "ルイスとサラの物語", bioTitle: "ダンス以上のつながり",
      bio1: "ルイスとサラはバチャータとタンゴの融合のパイオニアです。",
      bio2: "彼らの旅はマドリードで始まりました。",
      stats: { s1: "年の経験", s2: "オンラインの生徒", s3: "訪問した国", s4: "国際チャンピオン" },
      quote: "バチャタンゴはただのステップではありません、感じることです。", cta: "今日から踊り始めよう"
    },
    communityPage: {
      joinTitle: "コミュニティに参加",
      joinDesc: "独占的な議論に参加するには、登録と購読が必要です。",
      alreadyAccount: "すでにアカウントをお持ちですか？",
      login: "ログイン",
      title: "コミュニティ",
      create: "投稿を作成"
    },
    coursesPage: {
      title: "利用可能なコース",
      create: "+ コースを作成",
      empty: "現在公開されているコースはありません。",
      emptySub: "すぐに新しいクラスをチェックしに来てください！",
      view: "クラスを見る",
      viewMore: "もっと見る →",
      buy: "購入する →",
      hasAccess: "✓ アクセス権があります",
      priceNA: "価格未設定",
      completeCourses: "完全コース",
      completeSub: "固定価格・永久アクセス",
      monthlyClasses: "月次クラス",
      monthlySub: "月4クラス・サブスクリプションまたは月別個別購入",
      filterAll: "すべて",
      months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    },
    lesson: {
      backToCourse: "← コースに戻る",
      courseLessons: "コースのレッスン",
      lockedContent: "ロックされたコンテンツ",
      lockedMessage: "このビデオはプレミアム会員専用です。",
      getPremium: "プレミアムを取得",
      editLesson: "✎ レッスンを編集",
      exclusiveContent: "このレッスンのコンテンツはプレミアム会員専用です。",
      description: "説明",
      musicalResources: "音楽リソース",
      assignment: "課題",
      comments: "コメント",
      resourcesComingSoon: "音楽リソース近日公開...",
      assignmentNoTask: "先生はこのレッスンにタスクを割り当てていません。",
      assignmentNoTaskAdmin: "このレッスンにはまだタスクがありません。「レッスンを編集」から追加してください。",
      assignmentReviewed: "✓ 課題採点済み",
      assignmentGradeLabel: "評価：",
      assignmentResponseLabel: "あなたの回答（テキスト）",
      assignmentFileLabel: "ファイルを添付（任意）",
      assignmentResponsePlaceholder: "ここに回答を書いてください...",
      assignmentSubmitBtn: "提出する",
      assignmentUpdateBtn: "提出を更新",
      assignmentUploading: "ファイルをアップロード中...",
      assignmentSending: "送信中...",
      assignmentSuccess: "提出が正常に送信されました！",
      assignmentViewSubmissions: "すべての提出を見る",
      previousLesson: "前へ",
      nextLesson: "次へ",
      lessonNavigation: "レッスン切り替え"
    },
    dashboard: {
      title: "マイコース",
      viewClass: "クラスを見る",
      empty: "まだコースがありません。",
      emptySub: "カタログを見て、今日から踊り始めましょう。",
      discover: "新着コース",
      exploreAll: "すべてのコースを見る →"
    },
    login: {
      title: "ログイン",
      subtitle: "ルイスとサラの独占プラットフォームにアクセス",
      email: "メール",
      password: "パスワード",
      submit: "ログイン",
      noAccount: "アカウントがない？登録する",
      forgotPassword: "パスワードをお忘れですか？",
      or: "または",
      panelEyebrow: "プライベートアクセス",
      panelTitle: "踊ることは体で<em>思い出す</em>こと。",
      panelLead: "アカデミーに戻りましょう：新しいクラス、活発なコミュニティ、ルイスとサラのアーカイブ全体があなたを待っています。",
      panelFeatures: ["高画質ビデオクラス", "ダンサーコミュニティとイベント", "あなたの進捗、レッスンごとに保存"],
      panelQuote: "バチャータは学ぶものではなく、感じるものです。でも練習が必要です。",
      cardEyebrow: "ログイン"
    },
    signup: {
      title: "登録する",
      subtitle: "プラットフォームにアクセスするためのアカウントを作成",
      email: "メール",
      fullName: "氏名",
      fullNamePlaceholder: "山田太郎",
      password: "パスワード",
      submit: "登録する",
      hasAccount: "すでにアカウントをお持ちですか？ログイン",
      forgotPassword: "パスワードをお忘れですか？",
      or: "または",
      panelEyebrow: "アカデミーに参加",
      panelTitle: "最初の<em>クラス</em>は一歩から始まります。",
      panelLead: "アカウントを作成して、クラス、月間チャレンジ、ルイス・イ・サラ・バチャタンゴコミュニティへのアクセスを開放しましょう。",
      panelFeatures: ["全レベルのクラスへのアクセス", "イベント、集まり、厳選された音楽", "温かくて親しみやすいコミュニティ"],
      panelQuote: "ゆっくり踊ることで、素早く理解できる。",
      cardEyebrow: "アカウント作成"
    },
    forgotPassword: {
      title: "パスワードの回復",
      subtitle: "回復リンクを受け取るためにメールアドレスを入力",
      email: "メール",
      submit: "リンクを送る",
      backToLogin: "ログインに戻る",
      panelEyebrow: "アクセスを回復",
      panelTitle: "数ステップで<em>フロア</em>に戻りましょう。",
      panelLead: "進捗を失わずに新しいパスワードを作成できるよう、メールに安全なリンクを送ります。",
      panelFeatures: ["リンクは限られた時間有効です", "アカウントとクラスは無傷のままです", "届かない場合はスパムフォルダを確認してください"],
      cardEyebrow: "回復する"
    },
    profile: {
      title: "マイプロフィール",
      editProfile: "プロフィールを編集",
      accountInfo: "アカウント情報",
      email: "メール",
      subscription: "サブスクリプション",
      status: "ステータス",
      active: "アクティブ",
      inactive: "非アクティブ",
      activeUntil: "サブスクリプションは",
      noActiveSubscription: "現在アクティブなサブスクリプションがありません。",
      dangerZone: "危険ゾーン",
      undoableWarning: "これらの操作は元に戻せません。",
      logout: "ログアウト",
      deleteAccount: "アカウントを削除"
    },
    pricing: {
      title: "サブスクリプション",
      subtitle: "月額サブスクリプションでルイスとサラのバチャータコースにアクセス。毎月4つの新しいクラスが含まれます。",
      comingSoon: "近日公開",
      mostPopular: "最人気",
      perMonth: "/月",
      note: "過去の月にアクセスしたいですか？コースページから個別に購入できます。"
    },
    errors: {
      invalid_credentials: "認証情報が正しくありません。メールとパスワードを確認してください。",
      signup_failed: "アカウントの作成に失敗しました。もう一度お試しください。",
      reset_failed: "リンクの送信に失敗しました。もう一度お試しください。",
      unknown: "エラーが発生しました。もう一度お試しください。"
    },
    messages: {
      email_confirmation: "登録プロセスを続けるにはメールを確認してください。",
      email_reset: "パスワードリセットプロセスを続けるにはメールを確認してください。",
      account_deleted: "アカウントが正常に削除されました。"
    }
  }
};
