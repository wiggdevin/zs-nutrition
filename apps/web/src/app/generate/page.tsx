import { GeneratePlanPage } from '@/components/generate/GeneratePlanPage';

const isDevMode =
  !process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET_KEY === 'sk_test_placeholder' ||
  process.env.CLERK_SECRET_KEY === '';

export default async function GeneratePage() {
  if (!isDevMode) {
    const { auth } = await import('@clerk/nextjs/server');
    const { redirect } = await import('next/navigation');
    const { userId } = await auth();
    if (!userId) {
      redirect('/sign-in');
    }
  }

  return <GeneratePlanPage />;
}
