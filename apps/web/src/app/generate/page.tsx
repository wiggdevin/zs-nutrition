import { GeneratePlanPage } from "@/components/generate/GeneratePlanPage";
import { isDevMode } from "@/lib/dev-mode";

export default async function GeneratePage() {
  if (!isDevMode) {
    const { auth } = await import("@clerk/nextjs/server");
    const { redirect } = await import("next/navigation");
    const { userId } = await auth();
    if (!userId) {
      redirect("/sign-in");
    }
  }

  return <GeneratePlanPage />;
}
