import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/auth/AuthContext";
import { safeNextPath } from "@/lib/safeRedirect";

const LoginPage = () => {
  useDocumentTitle("Sign in");
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Captured once so the target does not change after we navigate away.
  const [next] = useState(() => safeNextPath(params.get("next"), "/"));

  useEffect(() => {
    if (status === "authenticated") navigate(next, { replace: true });
  }, [status, next, navigate]);

  return <AuthForm mode="login" onSubmit={login} />;
};

export default LoginPage;
