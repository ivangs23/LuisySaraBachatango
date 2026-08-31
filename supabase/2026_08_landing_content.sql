-- ============================================================================
-- Contenido editable de la landing: cifras, testimonios y preguntas frecuentes.
--
-- Por qué: cambiar una cifra o un testimonio exigía editar TypeScript, abrir un
-- PR y esperar un despliegue. Y las cifras estaban copiadas a mano en tres
-- ficheros (Hero, AboutClient, opengraph-image), que ya se desincronizaron: el
-- hero decía 50 países y "sobre nosotros" 30.
--
-- Texto en jsonb por idioma con español obligatorio, igual que `events`.
--
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Cifras. Conjunto FIJO de cuatro claves: el panel edita valores, no añade
-- filas. Una quinta cifra necesitaría su etiqueta traducida a seis idiomas en
-- los diccionarios, o sea código.
--
-- El valor se guarda SIN signo ('25'): Hero pinta '+25' y AboutClient '25+'.
-- El número es el dato; el adorno es de la vista.
-- ---------------------------------------------------------------------------
create table if not exists public.landing_stats (
  key        text primary key,
  value      text not null,
  position   int  not null,
  updated_at timestamptz not null default now(),
  constraint landing_stats_key_chk check (key in ('years', 'students', 'countries', 'titles')),
  constraint landing_stats_value_chk check (length(trim(value)) > 0)
);

create table if not exists public.landing_testimonials (
  id           uuid primary key default gen_random_uuid(),
  name         text    not null,
  quote        jsonb   not null,
  stars        int     not null default 5,
  position     int     not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint landing_testimonials_name_chk check (length(trim(name)) > 0),
  constraint landing_testimonials_stars_chk check (stars between 1 and 5),
  constraint landing_testimonials_quote_es_chk
    check (length(trim(coalesce(quote->>'es', ''))) > 0)
);

create table if not exists public.landing_faq (
  id           uuid primary key default gen_random_uuid(),
  question     jsonb   not null,
  answer       jsonb   not null,
  position     int     not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint landing_faq_question_es_chk
    check (length(trim(coalesce(question->>'es', ''))) > 0),
  constraint landing_faq_answer_es_chk
    check (length(trim(coalesce(answer->>'es', ''))) > 0)
);

create index if not exists landing_testimonials_position_idx
  on public.landing_testimonials (position) where is_published;
create index if not exists landing_faq_position_idx
  on public.landing_faq (position) where is_published;

-- ---------------------------------------------------------------------------
-- RLS: lectura pública de lo publicado, escritura solo admin.
--
-- La comprobación de admin va por public.is_admin() (SECURITY DEFINER,
-- 2026_08_fix_anon_read_admin_check.sql). Leer profiles.role dentro de una
-- policy es lo que dejó /curso-bachatango en 404 durante semanas: `anon` no
-- puede leer esa columna y PostgreSQL no cortocircuita `OR`.
-- ---------------------------------------------------------------------------
alter table public.landing_stats        enable row level security;
alter table public.landing_testimonials enable row level security;
alter table public.landing_faq          enable row level security;

drop policy if exists landing_stats_read on public.landing_stats;
create policy landing_stats_read on public.landing_stats for select using (true);

drop policy if exists landing_stats_write on public.landing_stats;
create policy landing_stats_write on public.landing_stats for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists landing_testimonials_read on public.landing_testimonials;
create policy landing_testimonials_read on public.landing_testimonials
  for select using (is_published or public.is_admin());

drop policy if exists landing_testimonials_write on public.landing_testimonials;
create policy landing_testimonials_write on public.landing_testimonials for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists landing_faq_read on public.landing_faq;
create policy landing_faq_read on public.landing_faq
  for select using (is_published or public.is_admin());

drop policy if exists landing_faq_write on public.landing_faq;
create policy landing_faq_write on public.landing_faq for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SEED — generado por scripts/generate-landing-seed.ts
-- ============================================================================
-- Seed generado por scripts/generate-landing-seed.ts. No editar a mano:
-- volver a generarlo si cambian los diccionarios.

insert into public.landing_stats (key, value, position) values
  ('years', '25', 1),
  ('students', '500', 2),
  ('countries', '30', 3),
  ('titles', '100', 4)
on conflict (key) do nothing;

insert into public.landing_testimonials (name, quote, stars, position) values
  ('Elena M.', '{"es":"Nunca creí que pudiera aprender a conectar así con mi pareja a través de una pantalla. La metodología de Luis y Sara es impecable.","en":"I never thought I could learn to connect like this with my partner through a screen. Luis and Sara''s methodology is impeccable.","fr":"Je n''aurais jamais cru pouvoir apprendre à connecter ainsi avec mon partenaire via un écran. La méthodologie de Luis et Sara est impeccable.","de":"Ich hätte nie gedacht, dass ich über einen Bildschirm so eine Verbindung lernen könnte.","it":"La metodologia di Luis e Sara è impeccabile.","ja":"画面越しにこんな風につながることを学べるとは思いませんでした。"}'::jsonb, 5, 1),
  ('Carlos R.', '{"es":"Llevo años bailando bachata, pero el bachatango ha sido un descubrimiento. La elegancia que transmiten en cada clase es inspiradora.","en":"I''ve been dancing bachata for years, but bachatango has been a discovery. The elegance they transmit in every class is inspiring.","fr":"Je danse la bachata depuis des années, mais le bachatango a été une découverte. L''élégance qu''ils transmettent dans chaque cours est inspirante.","de":"Ich tanze seit Jahren Bachata, aber Bachatango war eine Entdeckung.","it":"Il bachatango è stata una scoperta.","ja":"バチャタンゴは発見でした。"}'::jsonb, 5, 2),
  ('Sofía y Marc', '{"es":"Perfecto para practicar en casa. Los detalles técnicos marcan la diferencia. 100% recomendado.","en":"Perfect for home practice. Technical details make the difference. 100% recommended.","fr":"Parfait pour pratiquer à la maison. Les détails techniques font la différence. 100% recommandé.","de":"Perfekt für das Üben zu Hause. Die technischen Details machen den Unterschied.","it":"Perfetto per praticare a casa.","ja":"自宅練習に最適。"}'::jsonb, 5, 3);

insert into public.landing_faq (question, answer, position) values
  ('{"es":"¿Necesito tener experiencia previa en baile?","en":"Do I need previous dance experience?","fr":"Ai-je besoin d''expérience en danse ?","de":"Brauche ich Vorkenntnisse?","it":"Ho bisogno di esperienza?","ja":"経験は必要ですか？"}'::jsonb, '{"es":"No hace falta. El curso empieza desde cero y avanza paso a paso. Si ya bailas bachata o tango partirás con ventaja, pero no es un requisito: lo único que damos por hecho es que quieres aprender.","en":"No. The course starts from scratch and builds up step by step. If you already dance bachata or tango you will have a head start, but it is not a requirement — all we assume is that you want to learn.","fr":"Non. Le cours part de zéro et progresse pas à pas. Si vous dansez déjà la bachata ou le tango, vous aurez une longueur d''avance, mais ce n''est pas obligatoire : la seule chose que nous supposons, c''est votre envie d''apprendre.","de":"Nein. Der Kurs beginnt bei null und baut Schritt für Schritt auf. Wenn du schon Bachata oder Tango tanzt, hast du einen Vorsprung, aber Voraussetzung ist es nicht — wir setzen nur voraus, dass du lernen willst.","it":"No. Il corso parte da zero e procede passo dopo passo. Se balli già bachata o tango partirai avvantaggiato, ma non è un requisito: l''unica cosa che diamo per scontata è la voglia di imparare.","ja":"必要ありません。コースはゼロから始まり、一歩ずつ進みます。バチャータやタンゴの経験があれば有利ですが、必須ではありません。前提となるのは、学びたいという気持ちだけです。"}'::jsonb, 1),
  ('{"es":"¿Cómo accedo a los cursos?","en":"How do I access the courses?","fr":"Comment accéder aux cours ?","de":"Wie greife ich auf die Kurse zu?","it":"Come accedo ai corsi?","ja":"コースへのアクセス方法は？"}'::jsonb, '{"es":"Una vez compras un curso, tienes acceso inmediato a todo el contenido del curso a través de la plataforma. Puedes ver las clases tantas veces como quieras.","en":"Once you buy a course, you have immediate access to all the course content through the platform. You can watch the classes as many times as you want.","fr":"Une fois que vous achetez un cours, vous avez un accès immédiat à tout le contenu du cours sur la plateforme. Vous pouvez voir les cours autant de fois que vous le souhaitez.","de":"Sobald du einen Kurs kaufst, hast du sofortigen Zugriff auf den gesamten Kursinhalt über die Plattform. Du kannst die Klassen so oft ansehen, wie du möchtest.","it":"Una volta acquistato un corso, hai accesso immediato a tutto il contenuto del corso attraverso la piattaforma. Puoi vedere le lezioni tutte le volte che vuoi.","ja":"コースを購入すると、プラットフォームを通じてコースのすべてのコンテンツにすぐにアクセスできます。レッスンは何度でも視聴できます。"}'::jsonb, 2),
  ('{"es":"¿Sirve si no tengo pareja de baile?","en":"Does it work if I don''t have a dance partner?","fr":"Est-ce utile si je n''ai pas de partenaire ?","de":"Geht das auch ohne Tanzpartner?","it":"Serve il partner?","ja":"パートナーがいなくても大丈夫？"}'::jsonb, '{"es":"Absolutamente. Aunque el Bachatango es un baile de pareja, muchas lecciones se enfocan en técnica individual, musicalidad y estilo que puedes practicar solo/a.","en":"Absolutely. Although Bachatango is a partner dance, many lessons focus on individual technique, musicality, and style that you can practice solo.","fr":"Absolument. Bien que le Bachatango soit une danse de couple, de nombreuses leçons se concentrent sur la technique individuelle, la musicalité et le style.","de":"Absolut. Viele Lektionen konzentrieren sich auf individuelle Technik.","it":"No, molte lezioni sono individuali.","ja":"もちろんです。"}'::jsonb, 3);
