-- Seeds the 4 events that previously lived in utils/dictionaries.ts (t.events.items).
-- Run once after applying supabase/events.sql.

insert into public.events (start_date, end_date, location, is_published, title, description) values
(
  '2026-02-15', '2026-02-17', 'Madrid, España', true,
  jsonb_build_object(
    'es', 'Madrid Bachata Congress',
    'en', 'Madrid Bachata Congress',
    'fr', 'Madrid Bachata Congress',
    'de', 'Madrid Bachata Congress',
    'it', 'Madrid Bachata Congress',
    'ja', 'マドリードバチャタコングレス'
  ),
  jsonb_build_object(
    'es', 'Tres días de puro baile. Estaremos impartiendo dos talleres de Bachatango Fusión y ofreciendo un show exclusivo el sábado noche.',
    'en', 'Three days of pure dance. We will be teaching two Bachatango Fusion workshops and performing an exclusive show on Saturday night.',
    'fr', 'Trois jours de pure danse. Nous donnerons deux ateliers de Bachatango Fusion et un show exclusif le samedi soir.',
    'de', 'Drei Tage purer Tanz. Wir leiten zwei Bachatango-Fusion-Workshops und eine exklusive Show am Samstagabend.',
    'it', 'Tre giorni di puro ballo. Terremo due workshop di Bachatango Fusion e uno show esclusivo il sabato sera.',
    'ja', '3日間のダンス三昧。バチャタンゴフュージョンのワークショップを2つ開催し、土曜夜には特別ショーを披露します。'
  )
),
(
  '2026-03-05', '2026-03-05', 'Online', true,
  jsonb_build_object(
    'es', 'Masterclass Técnica de Giros',
    'en', 'Turn Technique Masterclass',
    'fr', 'Masterclass Technique de Tours',
    'de', 'Masterclass Drehtechnik',
    'it', 'Masterclass Tecnica dei Giri',
    'ja', 'ターンテクニック・マスタークラス'
  ),
  jsonb_build_object(
    'es', 'Clase intensiva online de 2 horas enfocada en el equilibrio y la fluidez en los giros. Incluye sesión de preguntas y respuestas.',
    'en', 'A 2-hour online intensive class focused on balance and fluidity in turns. Includes a Q&A session.',
    'fr', 'Cours intensif en ligne de 2 heures sur l''équilibre et la fluidité des tours. Inclut une session de questions/réponses.',
    'de', 'Zweistündiger Online-Intensivkurs zu Gleichgewicht und Fluss bei Drehungen. Inklusive Q&A-Session.',
    'it', 'Lezione intensiva online di 2 ore su equilibrio e fluidità nei giri. Include una sessione di domande e risposte.',
    'ja', 'バランスと流れに重点を置いた2時間のオンライン集中クラス。Q&Aセッション含む。'
  )
),
(
  '2026-04-20', '2026-04-22', 'París, Francia', true,
  jsonb_build_object(
    'es', 'Paris Sensual Weekend',
    'en', 'Paris Sensual Weekend',
    'fr', 'Paris Sensual Weekend',
    'de', 'Paris Sensual Weekend',
    'it', 'Paris Sensual Weekend',
    'ja', 'パリ・センシュアル・ウィークエンド'
  ),
  jsonb_build_object(
    'es', 'Vuelve el evento más elegante del año. Únete a nosotros en la ciudad del amor para aprender a conectar a otro nivel.',
    'en', 'The most elegant event of the year is back. Join us in the city of love to learn to connect on another level.',
    'fr', 'L''événement le plus élégant de l''année revient. Rejoignez-nous dans la ville de l''amour pour apprendre à vous connecter à un autre niveau.',
    'de', 'Die eleganteste Veranstaltung des Jahres ist zurück. Treffen Sie uns in der Stadt der Liebe und lernen Sie, sich auf einer neuen Ebene zu verbinden.',
    'it', 'Torna l''evento più elegante dell''anno. Unisciti a noi nella città dell''amore per imparare a connetterti a un altro livello.',
    'ja', '今年最もエレガントなイベントが帰ってきます。愛の都パリで、もう一段深いつながりを学びましょう。'
  )
),
(
  '2026-05-10', '2026-05-10', 'Sevilla, España', true,
  jsonb_build_object(
    'es', 'Taller Intensivo Coreográfico',
    'en', 'Choreography Intensive Workshop',
    'fr', 'Atelier Intensif Chorégraphique',
    'de', 'Intensiver Choreografie-Workshop',
    'it', 'Workshop Intensivo di Coreografia',
    'ja', '振付集中ワークショップ'
  ),
  jsonb_build_object(
    'es', 'Aprende nuestra última coreografía en un taller de 4 horas. Nivel intermedio/avanzado.',
    'en', 'Learn our latest choreography in a 4-hour workshop. Intermediate/advanced level.',
    'fr', 'Apprenez notre dernière chorégraphie dans un atelier de 4 heures. Niveau intermédiaire/avancé.',
    'de', 'Lernen Sie unsere neueste Choreografie in einem 4-stündigen Workshop. Mittleres/fortgeschrittenes Niveau.',
    'it', 'Impara la nostra ultima coreografia in un workshop di 4 ore. Livello intermedio/avanzato.',
    'ja', '4時間のワークショップで最新の振付を学びましょう。中級〜上級者向け。'
  )
);
