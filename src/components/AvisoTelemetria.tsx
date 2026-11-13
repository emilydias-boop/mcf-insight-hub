import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Aviso de transparência (LGPD), mostrado uma única vez por usuário. */
export function AvisoTelemetria() {
  const [userId, setUserId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setAberto(false); return; }
    if (localStorage.getItem(`mcf_aviso_telemetria_${userId}`)) return;
    (supabase as any).from("telemetria_aceite").select("user_id").eq("user_id", userId).maybeSingle()
      .then(({ data, error }: any) => {
        if (error) return; // não bloqueia o uso se a leitura falhar
        if (data) localStorage.setItem(`mcf_aviso_telemetria_${userId}`, "1");
        else setAberto(true);
      });
  }, [userId]);

  const entendi = async () => {
    setAberto(false);
    if (!userId) return;
    localStorage.setItem(`mcf_aviso_telemetria_${userId}`, "1");
    await (supabase as any).from("telemetria_aceite").insert({ user_id: userId });
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) entendi(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aviso de transparência</DialogTitle>
          <DialogDescription>
            Para melhorar a operação, este sistema registra quais telas você usa e por quanto tempo fica ativo ou sem interação. Não registramos o que você digita nem fazemos capturas de tela.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter><Button onClick={entendi}>Entendi</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
