import { useAuth } from "@/auth/AuthContext";
import RequireAuth from "@/auth/RequireAuth";
import Index from "./Index.tsx";
import Landing from "./Landing.tsx";

/**
 * "/" is the public landing page for visitors and the existing dashboard (Index) once signed in. The landing page is static, so it
 * renders immediately while the session check is still running (a cold backend must not leave a blank screen). If the check itself
 * fails, the existing "could not check your session" screen (with Try again) is kept, so nobody is mistaken for signed out.
 * Get Started / Sign in lead to the unchanged /register and /login, which send signed-in users on to "/".
 */
const Home = () => {
  const { status } = useAuth();
  if (status === "error") return <RequireAuth />;
  return status === "authenticated" ? <Index /> : <Landing />;
};

export default Home;
