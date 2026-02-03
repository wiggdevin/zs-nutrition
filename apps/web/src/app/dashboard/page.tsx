import DashboardClient from '@/components/dashboard/DashboardClient'
import NavBar from '@/components/navigation/NavBar'

export default function DashboardPage() {
  return (
    <>
      <NavBar />
      <div className="md:pt-14 pb-20 md:pb-0">
        <DashboardClient />
      </div>
    </>
  )
}
