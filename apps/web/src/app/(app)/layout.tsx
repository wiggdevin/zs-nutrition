/**
 * Authenticated app layout for all protected routes.
 * Dashboard, meal plans, tracking, settings, etc. are nested under this layout.
 * Individual pages include their own NavBar component for now.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
