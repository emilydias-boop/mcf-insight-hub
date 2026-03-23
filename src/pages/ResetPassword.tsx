import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";

type PageState = "loading" | "ready" | "expired" | "error";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Check URL for error params (Supabase adds these when token is invalid/expired)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const errorCode = params.get("error_code");
    const errorDesc = params.get("error_description");

    if (errorCode === "otp_expired" || errorDesc?.includes("expired")) {
      setPageState("expired");
      setErrorMessage("Este link já foi utilizado ou expirou. Solicite um novo link ao administrador.");
      return;
    }

    if (params.get("error")) {
      setPageState("error");
      setErrorMessage(errorDesc || "Erro ao verificar o link. Solicite um novo link.");
      return;
    }

    // Listen for auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] auth event:', event);
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
      if (event === "SIGNED_IN" && session) {
        setPageState("ready");
      }
    });

    // Check if we already have a session (e.g. from recovery redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState("ready");
      }
    });

    // Check URL hash for recovery type (fallback)
    if (hash && (hash.includes("type=recovery") || hash.includes("type=magiclink"))) {
      // If no error was detected above, the token might still be valid
      // Wait for the auth state change to confirm
      setTimeout(() => {
        setPageState((prev) => {
          if (prev === "loading") {
            // After timeout, if still loading, token likely failed silently
            return "expired";
          }
          return prev;
        });
      }, 5000);
    } else {
      // No recovery params at all — check if there's already a session
      setTimeout(() => {
        setPageState((prev) => prev === "loading" ? "expired" : prev);
      }, 5000);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Senha definida com sucesso!");
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Erro ao definir senha");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case "ready":
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Definir senha"}
            </Button>
          </form>
        );

      case "expired":
      case "error":
        return (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">
              {errorMessage || "Este link já foi utilizado ou expirou."}
            </p>
            <p className="text-xs text-muted-foreground">
              Cada link de recuperação funciona apenas uma vez. Peça ao administrador para gerar um novo link.
            </p>
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
              Voltar para o login
            </Button>
          </div>
        );

      case "loading":
      default:
        return (
          <div className="text-center text-sm text-muted-foreground">
            Verificando link de recuperação...
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Definir nova senha</h1>
          {pageState === "ready" && (
            <p className="text-muted-foreground text-sm">
              Digite sua nova senha abaixo.
            </p>
          )}
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default ResetPassword;
