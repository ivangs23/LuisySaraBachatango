/**
 * Routes rendered WITHOUT the global header/footer — the standalone sales
 * funnel: landing (`/curso-bachatango`), checkout form (`/curso-bachatango/comprar`)
 * and thank-you (`/gracias`). Keeps the buyer focused on completing payment +
 * signup with no site nav to wander off through.
 */
export function isChromelessRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/curso-bachatango' ||
    pathname.startsWith('/curso-bachatango/') ||
    pathname === '/gracias'
  );
}
