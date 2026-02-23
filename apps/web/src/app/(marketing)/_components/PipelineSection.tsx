import { PipelineVisualizer } from './PipelineVisualizer';

export function PipelineSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
      <div className="mb-12 text-center">
        <p className="section-label text-primary">{'/// THE ENGINE'}</p>
        <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          6 AI AGENTS<span className="text-primary">.</span> ONE PIPELINE
          <span className="text-primary">.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Each agent in our pipeline has a specialized role. Together, they build a nutrition plan
          that&apos;s accurate, personalized, and verified.
        </p>
      </div>
      <PipelineVisualizer />
    </section>
  );
}
