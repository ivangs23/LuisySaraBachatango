'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  makeConsent,
  parseConsent,
  serializeConsent,
  type ConsentState,
} from '@/utils/consent/categories';

type ConsentContextType = {
  state: ConsentState | null;
  /** false durante el render en servidor y en el primer render de hidratación. */
  hydrated: boolean;
  isOpen: boolean;
  save: (analytics: boolean, marketing: boolean) => void;
  reopen: () => void;
};

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Store externo sobre document.cookie.
//
// La cookie es estado que vive fuera de React, así que se lee con
// `useSyncExternalStore` en lugar de con un `useEffect` que haga setState. Esa
// segunda forma dispara la regla `react-hooks` de renders en cascada y, sobre
// todo, obliga a un render extra con el banner en el estado equivocado.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

/**
 * Devuelve el valor crudo de la cookie. Es seguro leer `document.cookie` en
 * cada llamada: React compara los snapshots con Object.is y dos cadenas
 * iguales no provocan re-render.
 */
function getSnapshot(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match ? match[1] : '';
}

/** En servidor no hay cookie visible; se asume "sin decidir". */
function getServerSnapshot(): string {
  return '';
}

/** true solo tras la hidratación, sin setState en efecto. */
const subscribeNever = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeNever, alwaysTrue, alwaysFalse);

  // Reapertura manual desde el footer. Es estado de interacción, no derivado
  // de la cookie, así que aquí sí corresponde un useState normal: se cambia
  // desde un manejador de evento, nunca desde un efecto.
  const [manuallyOpened, setManuallyOpened] = useState(false);

  const state = useMemo(() => parseConsent(raw || null), [raw]);

  const save = useCallback((analytics: boolean, marketing: boolean) => {
    const next = makeConsent(analytics, marketing, new Date());
    const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie =
      `${CONSENT_COOKIE}=${serializeConsent(next)}; path=/; max-age=${maxAge}${secure}; samesite=lax`;
    setManuallyOpened(false);
    emit();
  }, []);

  const reopen = useCallback(() => setManuallyOpened(true), []);

  // Se abre solo cuando no hay decisión guardada, o cuando se reabre a mano.
  // Antes de hidratar nunca: el servidor no sabe si ya se decidió, y pintarlo
  // provocaría un parpadeo en cada carga para quien ya eligió.
  const isOpen = hydrated && (state === null || manuallyOpened);

  const value = useMemo(
    () => ({ state, hydrated, isOpen, save, reopen }),
    [state, hydrated, isOpen, save, reopen],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextType {
  const ctx = useContext(ConsentContext);
  if (ctx === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return ctx;
}
