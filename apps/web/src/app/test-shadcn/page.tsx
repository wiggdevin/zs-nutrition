'use client'

import { notFound } from 'next/navigation'
import { Button } from "@/components/ui/button"

export default function TestShadcnPage() {
  if (process.env.NODE_ENV === 'production') { notFound() }
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Tailwind CSS + shadcn/ui Test
          </h1>
          <p className="text-muted-foreground">
            Verifying Tailwind CSS v4 and shadcn/ui component setup.
          </p>
        </div>

        {/* Tailwind CSS classes test */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Tailwind CSS Classes</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-lg border border-border">
              <p className="text-card-foreground font-medium">Card Component</p>
              <p className="text-muted-foreground text-sm">Uses bg-card, border-border</p>
            </div>
            <div className="bg-primary p-4 rounded-lg">
              <p className="text-primary-foreground font-medium">Primary Color</p>
              <p className="text-primary-foreground/70 text-sm">Uses bg-primary</p>
            </div>
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-secondary-foreground font-medium">Secondary</p>
              <p className="text-secondary-foreground/70 text-sm">Uses bg-secondary</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-muted-foreground font-medium">Muted</p>
              <p className="text-muted-foreground/70 text-sm">Uses bg-muted</p>
            </div>
          </div>
        </section>

        {/* shadcn/ui Button test */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">shadcn/ui Button Variants</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>
        </section>

        {/* Theme variables test */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Theme Variables</h2>
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded bg-primary" title="primary" />
            <div className="w-8 h-8 rounded bg-secondary" title="secondary" />
            <div className="w-8 h-8 rounded bg-destructive" title="destructive" />
            <div className="w-8 h-8 rounded bg-muted" title="muted" />
            <div className="w-8 h-8 rounded bg-accent" title="accent" />
            <div className="w-8 h-8 rounded bg-success" title="success" />
            <div className="w-8 h-8 rounded bg-warning" title="warning" />
            <div className="w-8 h-8 rounded bg-error" title="error" />
          </div>
        </section>

        <p className="text-xs text-muted-foreground font-mono">
          STATUS: ALL SYSTEMS OPERATIONAL
        </p>
      </div>
    </div>
  )
}
