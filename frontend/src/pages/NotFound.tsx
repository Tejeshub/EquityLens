import { Link } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const NotFound = () => {
  useDocumentTitle("Page not found");
  return (
  <main className="flex flex-1 min-h-[60vh] items-center justify-center bg-background">
    <div className="text-center">
      <h1 className="mb-4 display-serif text-7xl">404</h1>
      <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
      <Link to="/" className="text-foreground underline underline-offset-4 hover:no-underline">Return to Home</Link>
    </div>
  </main>
  );
};

export default NotFound;
