import { Link } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const NotFound = () => {
  useDocumentTitle("Page not found");
  return (
  <main className="flex flex-1 min-h-[60vh] items-center justify-center bg-muted">
    <div className="text-center">
      <h1 className="mb-4 text-4xl font-bold">404</h1>
      <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
      <Link to="/" className="text-primary underline hover:text-primary/90">Return to Home</Link>
    </div>
  </main>
  );
};

export default NotFound;
