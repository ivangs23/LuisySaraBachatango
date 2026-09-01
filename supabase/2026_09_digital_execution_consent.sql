-- Evidencia del consentimiento del art. 103.m RDL 1/2007.
--
-- Para que la compra quede excluida del derecho de desistimiento no basta con
-- que las condiciones lo digan: hay que poder DEMOSTRAR que el consumidor,
-- antes de que empezara la ejecución, consintió expresamente el acceso
-- inmediato y reconoció que con ello perdía el derecho. Sin esa prueba, el
-- alumno conserva los 14 días aunque ya haya entrado al curso.
--
-- Se sella la fecha igual que ya se hace con `terms_accepted_at`: primero en
-- la fila pendiente (antes de pagar) y después copiada al perfil al
-- aprovisionar, para que la evidencia sobreviva a la purga de pendientes.
--
-- Idempotente: se puede reaplicar sin efecto.

alter table public.pending_registrations
  add column if not exists digital_execution_consent_at timestamptz;

alter table public.profiles
  add column if not exists digital_execution_consent_at timestamptz;

comment on column public.pending_registrations.digital_execution_consent_at is
  'Momento en que el usuario solicitó el acceso inmediato y reconoció perder el derecho de desistimiento (art. 103.m RDL 1/2007). Null = no consta; en ese caso conserva los 14 días.';

comment on column public.profiles.digital_execution_consent_at is
  'Copia definitiva de la evidencia del art. 103.m, trasladada desde pending_registrations al aprovisionar la cuenta.';
