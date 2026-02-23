import Link from 'next/link';

export function CTASection() {
  return (
    <section className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <div className="relative mx-auto max-w-3xl px-6 py-12 text-center sm:px-8 sm:py-20 lg:py-28">
        <h2 className="font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          YOUR FIRST PLAN IS FREE<span className="text-primary">.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
          Set your goals, answer a few questions, and watch 6 AI agents build your personalized
          nutrition plan in real-time.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-xl bg-primary px-10 py-4 text-base font-semibold text-background shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40"
        >
          Get Started — It&apos;s Free
        </Link>
        <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {'/// Zero setup fees. Zero selling your data.'}
        </p>
      </div>
    </section>
  );
}
