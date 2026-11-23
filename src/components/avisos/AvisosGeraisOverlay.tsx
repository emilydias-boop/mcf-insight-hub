import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/documentosInternos";

export interface AvisoGeral {
  id: string;
  titulo: string;
  mensagem: string;
  nivel: string;
  ativo: boolean;
  created_at: string;
}

export const TEXTO_CIENCIA = "Li a mensagem e estou ciente deste aviso.";

/** Mostra, em fila, avisos ativos ainda sem ciência do usuário; chegam em tempo real. */
export function AvisosGeraisOverlay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const key = ["avisos-gerais-pendentes", user?.id];

  const { data: pendentes = [] } = useQuery({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const [{ data: avisos, error }, { data: cien }] = await Promise.all([
        db.from("avisos_gerais").select("id,titulo,mensagem,nivel,ativo,created_at").eq("ativo", true).order("created_at"),
        db.from("avisos_gerais_ciencias").select("aviso_id").eq("user_id", user!.id),
      ]);
      if (error) throw error;
      const lidos = new Set((cien ?? []).map((c: any) => c.aviso_id));
      return ((avisos ?? []) as AvisoGeral[]).filter((a) => !lidos.has(a.id));
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`avisos-gerais-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "avisos_gerais" }, () => {
        qc.invalidateQueries({ queryKey: ["avisos-gerais-pendentes"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const aviso = pendentes[0];
  if (!aviso) return null;

  const confirmar = async () => {
    setSalvando(true);
    const { error } = await db.from("avisos_gerais_ciencias").insert({
      aviso_id: aviso.id,
      user_id: user!.id,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    setSalvando(false);
    if (error && error.code !== "23505") return toast.error("Não foi possível registrar a ciência.");
    setMarcado(false);
    qc.invalidateQueries({ queryKey: ["avisos-gerais-pendentes"] });
  };

  const variante = aviso.nivel === "urgente" ? "destructive" : aviso.nivel === "importante" ? "default" : "secondary";

  return (
    <Dialog open>
      <DialogContent
        className="max-w-lg z-[100] [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <Badge variant={variante as any} className="capitalize">{aviso.nivel}</Badge>
            {pendentes.length > 1 && <span className="text-xs text-muted-foreground">+{pendentes.length - 1} na fila</span>}
          </div>
          <DialogTitle>{aviso.titulo}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-foreground">{aviso.mensagem}</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
          <Checkbox checked={marcado} onCheckedChange={(v) => setMarcado(v === true)} className="mt-0.5" />
          <span className="text-sm font-medium">{TEXTO_CIENCIA}</span>
        </label>
        <div>
          <Button disabled={!marcado || salvando} onClick={confirmar} className="w-full">Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
