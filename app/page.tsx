import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import OverviewContent from "./_overview";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background w-full">
      <main className="p-4 lg:p-6 w-full">
        <OverviewContent />
      </main>
    </div>
  );
}
