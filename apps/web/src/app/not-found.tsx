import NavBar from '@/components/navigation/NavBar'
import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <NavBar />
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h1 className="text-6xl font-heading text-[#f97316]">404</h1>
          <p className="mt-4 text-lg text-[#a1a1aa]">Page not found</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0a0a0a] transition-colors hover:bg-[#ea580c]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </>
  )
}
