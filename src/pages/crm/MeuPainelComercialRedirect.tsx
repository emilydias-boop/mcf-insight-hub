import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function MeuPainelComercialRedirect() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["meu-painel-redirect", user?.id, role],
    enabled: !!user?.email,
    queryFn: async () => {
      const email = user!.email!.toLowerCase();
      if (role === "closer") {
        const { data: c } = await supabase
          .from("closers")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        return { kind: "closer" as const, id: c?.id ?? null };
      }
      return { kind: "sdr" as const, email };
    },
  });

  useEffect(() => {
    if (!data) return;
    const qs = "?preset=month";
    if (data.kind === "closer" && data.id) {
      navigate(`/crm/reunioes-equipe/closer/${data.id}${qs}`, { replace: true });
    } else if (data.kind === "sdr") {
      navigate(`/crm/reunioes-equipe/${encodeURIComponent(data.email)}${qs}`, { replace: true });
    } else {
      navigate("/crm/reunioes-equipe", { replace: true });
    }
  }, [data, navigate]);

  return (
    <div className="p-8 text-sm text-muted-foreground">
      {isLoading ? "Carregando seu painel..." : "Redirecionando..."}
    </div>
  );
}