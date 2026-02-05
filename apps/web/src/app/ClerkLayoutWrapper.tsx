// Isolated Clerk layout wrapper — only imported when real Clerk keys are configured
// This prevents webpack from bundling @clerk/nextjs in dev mode
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export function ClerkLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: 'var(--primary)',
              colorBackground: 'var(--card)',
              colorText: 'var(--foreground)',
              colorTextSecondary: 'var(--muted-foreground)',
              colorInputBackground: 'var(--card)',
              colorInputText: 'var(--foreground)',
              borderRadius: '0.5rem',
            },
            elements: {
              formButtonPrimary:
                'bg-primary hover:bg-primary/90 text-background font-bold uppercase tracking-wide transition-colors',
              card: 'bg-card border border-border shadow-xl rounded-xl',
              headerTitle: 'text-foreground font-bold',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton:
                'bg-background border border-border text-foreground hover:bg-card transition-colors',
              formFieldInput:
                'bg-background border border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary',
              footerActionLink: 'text-primary hover:text-primary/90',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
