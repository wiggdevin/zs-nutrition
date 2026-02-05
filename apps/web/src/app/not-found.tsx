import NavBar from '@/components/navigation/NavBar';
import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <NavBar />
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-6xl font-heading text-primary">404</h1>
          <p className="mt-4 text-lg text-muted-foreground">Page not found</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-background transition-colors hover:bg-primary/90"
          >
            Go Home
          </Link>
        </div>
      </div>
    </>
  );
}
