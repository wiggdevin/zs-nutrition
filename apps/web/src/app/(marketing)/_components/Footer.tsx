import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <span className="text-[10px] font-bold text-white">ZS</span>
            </div>
            <span className="text-sm font-bold uppercase tracking-wide text-foreground">
              ZS-<span className="text-primary">MAC</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Zero Sum Nutrition
          </p>
        </div>
      </div>
    </footer>
  );
}
