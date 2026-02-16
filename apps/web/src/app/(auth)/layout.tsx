/**
 * Auth layout for sign-in and sign-up pages.
 * Centers content vertically and horizontally with a clean background.
 * Individual auth pages handle their own card styling.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">{children}</div>
  );
}
