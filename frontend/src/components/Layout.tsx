import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** Authenticated page frame: skip link, navbar, <main> landmark, per-route document title. */
const Layout = ({ title, children }: { title?: string | null; children: ReactNode }) => {
  useDocumentTitle(title);
  return (
    <div className="flex-1 bg-background">
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-full focus:bg-primary focus:text-primary-foreground focus:text-sm">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="pt-16 outline-none">{children}</main>
    </div>
  );
};

export default Layout;
