/**
 * Authenticated app layout for all protected routes.
 * Dashboard, meal plans, tracking, settings, etc. are nested under this layout.
 * AccountStatusGate redirects deactivated users to /account-deactivated.
 */
import { AccountStatusGate } from '@/components/auth/AccountStatusGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AccountStatusGate>{children}</AccountStatusGate>;
}
