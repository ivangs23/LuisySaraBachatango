-- Certificado privado de aprovechamiento: una fila por (alumno, curso) emitida
-- cuando el alumno ha marcado como completadas TODAS las lecciones del curso.
--
-- Por qué una tabla y no calcularlo al vuelo:
--   · la fecha de expedición queda congelada (si no, el documento cambiaría de
--     fecha cada vez que se abre);
--   · el nombre impreso queda congelado tal y como el alumno lo escribió, sin
--     depender de ediciones posteriores de `profiles.full_name`;
--   · el código de validación es único y consultable.
--
-- SEGURIDAD — el modelo de escritura es deliberadamente asimétrico:
-- hay policies de SELECT (cada uno ve la suya, el admin ve todas) y NINGUNA de
-- INSERT/UPDATE/DELETE. Con RLS activada eso significa que ni el cliente ni la
-- sesión del usuario pueden crear ni tocar una fila: la única vía es el service
-- role desde `app/courses/completion-actions.ts`, que recuenta las lecciones en
-- el servidor antes de insertar. Si alguien añade aquí una policy de INSERT, el
-- alumno podrá emitirse el certificado sin completar el curso.
--
-- Aditivo y re-aplicable: `IF NOT EXISTS` en tabla, índices y policies.

CREATE TABLE IF NOT EXISTS public.course_completions (
  user_id          uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  course_id        uuid        NOT NULL REFERENCES public.courses(id)  ON DELETE CASCADE,
  -- Código impreso en el documento: LSB-2026-A7K2 (prefijo, año, 4 chars base32).
  certificate_code text        NOT NULL,
  -- Nombre tal y como lo escribió el alumno al emitirlo. NO se sincroniza con
  -- profiles.full_name: el documento ya emitido no debe cambiar de nombre.
  recipient_name   text        NOT NULL,
  -- Lecciones que tenía el curso en el momento de emitir, contadas en servidor.
  lessons_total    integer     NOT NULL,
  completed_at     timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, course_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS course_completions_code_uniq
  ON public.course_completions (certificate_code);

-- El admin lista por curso ("quién ha terminado el curso X").
CREATE INDEX IF NOT EXISTS course_completions_course_id_idx
  ON public.course_completions (course_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_completions_code_format'
  ) THEN
    ALTER TABLE public.course_completions
      ADD CONSTRAINT course_completions_code_format
      CHECK (certificate_code ~ '^LSB-[0-9]{4}-[A-Z2-7]{4}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_completions_recipient_name_len'
  ) THEN
    ALTER TABLE public.course_completions
      ADD CONSTRAINT course_completions_recipient_name_len
      CHECK (char_length(recipient_name) BETWEEN 2 AND 80);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_completions_lessons_total_positive'
  ) THEN
    ALTER TABLE public.course_completions
      ADD CONSTRAINT course_completions_lessons_total_positive
      CHECK (lessons_total > 0);
  END IF;
END $$;

ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'course_completions'
       AND policyname = 'Users read own completions'
  ) THEN
    CREATE POLICY "Users read own completions" ON public.course_completions
      FOR SELECT USING ((select auth.uid()) = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'course_completions'
       AND policyname = 'Admins read all completions'
  ) THEN
    CREATE POLICY "Admins read all completions" ON public.course_completions
      FOR SELECT USING (public.is_admin());
  END IF;
END $$;

COMMENT ON TABLE public.course_completions IS
  'Certificados privados de aprovechamiento ya emitidos. Sólo lectura vía RLS; las filas las crea el service role tras recontar lecciones en servidor.';
COMMENT ON COLUMN public.course_completions.certificate_code IS
  'Código de validación impreso (LSB-AAAA-XXXX). Único.';
COMMENT ON COLUMN public.course_completions.recipient_name IS
  'Nombre congelado en el momento de la emisión. No se sincroniza con profiles.full_name.';
COMMENT ON COLUMN public.course_completions.lessons_total IS
  'Lecciones del curso contadas en servidor al emitir. Es el número que se imprime.';

-- Validación tras aplicarlo:
--   select count(*) from pg_policies
--    where tablename = 'course_completions';               -- espera 2 (sólo SELECT)
--   select policyname, cmd from pg_policies
--    where tablename = 'course_completions';               -- ninguna debe ser INSERT/UPDATE/DELETE
--   insert into public.course_completions values (auth.uid(), '<curso>', 'LSB-2026-AAAA', 'X Y', 1, now());
--                                                          -- debe fallar como usuario normal
