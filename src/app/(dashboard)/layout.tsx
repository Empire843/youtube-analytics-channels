import MainNav from "@/components/layout/MainNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell">
      <div className="app-layout">
        <MainNav />
        <div className="app-main">
          {children}
        </div>
      </div>
    </div>
  );
}
