/**
 * Marketing layout for public pages (landing page, pricing, etc.).
 * These pages are visible to unauthenticated users and have their own
 * header/footer structure separate from the authenticated app shell.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
