/**
 * Completion certificate: `/courses/<uuid>/certificado`. It is a printable
 * document, not a page of the site — the nav would end up in the PDF.
 */
const CERTIFICATE_ROUTE = /^\/courses\/[^/]+\/certificado\/?$/;

/**
 * Routes rendered WITHOUT the global header/footer — the standalone sales
 * funnel: landing (`/curso-bachatango`), checkout form (`/curso-bachatango/comprar`)
 * and thank-you (`/gracias`). Keeps the buyer focused on completing payment +
 * signup with no site nav to wander off through. Plus the printable certificate,
 * for the reason above, and `/clase-gratis/mas`, the private page with the two
 * classes sent by email: its only next step is the course.
 */
export function isChromelessRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/curso-bachatango' ||
    pathname.startsWith('/curso-bachatango/') ||
    pathname === '/gracias' ||
    pathname === '/clase-gratis/mas' ||
    CERTIFICATE_ROUTE.test(pathname)
  );
}
