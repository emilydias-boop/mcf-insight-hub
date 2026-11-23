import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { db, fmtSP } from "@/lib/documentosInternos";
import type { AvisoGeral } from "@/components/avisos/AvisosGeraisOverlay";

export default function EnviarAviso() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [nivel, setNivel] = useState("informativo");
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos-gerais-admin"],
    queryFn: async () => {
      const { data, error } = await db.from("avisos_gerais").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as AvisoGeral[];
    },
  });
  const { data: totalUsuarios = 0 } = useQuery({
    queryKey: ["avisos-total-usuarios"],
    queryFn: async () => {
      const { count } = await db.from("profiles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: ciencias = [] } = useQuery({
    queryKey: ["avisos-ciencias", aberto],
    enabled: !!aberto,
    queryFn: async () => {
      const { data } = await db.from("avisos_gerais_ciencias").select("user_id,ciente_em").eq("aviso_id", aberto);
      const ids = (data ?? []).map((c: any) => c.user_id);
      const { data: profs } = ids.length
        ? await db.from("profiles").select("id,full_name,email").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || p.email]));
      return (data ?? []).map((c: any) => ({ nome: map.get(c.user_id) ?? c.user_id, em: c.ciente_em }));
    },
  });

  const enviar = async () => {
    if (!titulo.trim() || !mensagem.trim()) return toast.error("Preencha título e mensagem.");
    const { error } = await db.from("avisos_gerais").insert({ titulo: titulo.trim(), mensagem: mensagem.trim(), nivel, enviado_por: user?.id });
    if (error) return toast.error("Não foi possível enviar.");
    toast.success("Aviso enviado a todos os usuários.");
    setTitulo(""); setMensagem("");
    qc.invalidateQueries({ queryKey: ["avisos-gerais-admin"] });
  };

  const encerrar = async (id: string) => {
    await db.from("avisos_gerais").update({ ativo: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["avisos-gerais-admin"] });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Enviar aviso</h1>
        <p className="text-muted-foreground">A mensagem aparece na hora para todos os usuários e fica na tela até cada um confirmar a ciência.</p>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
          <Textarea placeholder="Mensagem" rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={2000} />
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="informativo">Informativo</SelectItem>
              <SelectItem value="importante">Importante</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={enviar}><Send className="mr-2 h-4 w-4" />Enviar para todos</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Avisos enviados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {avisos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aviso enviado.</p>}
          {avisos.map((a) => (
            <div key={a.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium flex items-center gap-2">{a.titulo}
                    <Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativo" : "Encerrado"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtSP(a.created_at)} · {a.nivel}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAberto(aberto === a.id ? null : a.id)}>Quem leu</Button>
                  {a.ativo && <Button size="sm" variant="ghost" onClick={() => encerrar(a.id)}>Encerrar</Button>}
                </div>
              </div>
              {aberto === a.id && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">{ciencias.length} de {totalUsuarios} usuários confirmaram.</p>
                  <ul className="max-h-60 overflow-auto space-y-0.5">
                    {ciencias.map((c: any, i: number) => <li key={i}>{c.nome} — {fmtSP(c.em)}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
