import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/auth/AuthContext";

const RegisterPage = () => {
  useDocumentTitle("Create account");
  const { register, status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate("/", { replace: true });
  }, [status, navigate]);

  return <AuthForm mode="register" onSubmit={register} />;
};

export default RegisterPage;
