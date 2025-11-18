import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function MainLayout() {
  return (
    <div className="min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="ml-60 p-8">
        <Outlet />
      </main>
    </div>
  );
}
