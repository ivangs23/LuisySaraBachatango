-- Oferta comercial por curso: precio "antes" tachado y plazas restantes.
--
-- Aditivo y re-aplicable: sólo añade dos columnas nullables a `courses`. No
-- toca policies ni funciones, así que es seguro replayarlo sobre producción.
--
-- Semántica de las columnas (la impone `utils/courses/offer.ts`, no la BD):
--   compare_at_price_eur  Precio anterior que se enseña tachado. Sólo se
--                         renderiza si es ESTRICTAMENTE mayor que price_eur;
--                         NULL o menor/igual => no se tacha nada.
--   spots_left            Plazas anunciadas como disponibles. Sólo se renderiza
--                         si es > 0. Es un número editado a mano por el admin,
--                         NO un contador de course_purchases.
--
-- AVISO LEGAL: el art. 20 del RDLeg 1/2007 (Directiva Ómnibus 2019/2161) exige
-- que el precio tachado sea el más bajo aplicado en los 30 días anteriores, y
-- los arts. 5 y 7 de la Directiva 2005/29/CE prohíben anunciar una escasez que
-- no es real. Rellena estas columnas sólo con datos veraces.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS compare_at_price_eur integer,
  ADD COLUMN IF NOT EXISTS spots_left integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_compare_at_price_eur_range'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_compare_at_price_eur_range
      CHECK (compare_at_price_eur IS NULL OR (compare_at_price_eur >= 0 AND compare_at_price_eur <= 9999));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_spots_left_range'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_spots_left_range
      CHECK (spots_left IS NULL OR (spots_left >= 0 AND spots_left <= 9999));
  END IF;
END $$;

COMMENT ON COLUMN public.courses.compare_at_price_eur IS
  'Precio anterior mostrado tachado. Debe ser el precio más bajo realmente aplicado en los 30 días previos (art. 20 RDLeg 1/2007).';
COMMENT ON COLUMN public.courses.spots_left IS
  'Plazas anunciadas como disponibles. Valor manual, no un contador de ventas.';

-- Valores de la oferta actual del curso de la landing (150 € tachado, 119 €
-- reales, 5 plazas). Descomenta para aplicarlos, o edítalos desde el
-- formulario de curso en /courses/<id>/edit.
--
-- UPDATE public.courses
--    SET compare_at_price_eur = 150,
--        spots_left = 5
--  WHERE id = 'f89a576f-4a77-40f7-93e9-23e6c820ee92';
