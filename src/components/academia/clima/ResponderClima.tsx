import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adb, erroAcademia } from "@/lib/academia";
import type { ClimaPergunta, ClimaPesquisa, ClimaRespostaItem } from "@/lib/clima";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ClimaCard({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [resp, setResp] = useState<Record<string, ClimaRespostaItem>>({});
  const [enviando, setEnviando] = useState(false);
  const { data } = useQuery({
    queryKey: ["clima", "ativa", userId], enabled: !!userId,
    queryFn: async () => {
      const { data: p } = await adb.from("clima_pesquisas").select("*").eq("ativa", true).maybeSingle();
      if (!p) return null;
      const { data: ja } = await adb.from("clima_respostas").select("id").eq("pesquisa_id", p.id).eq("user_id", userId).maybeSingle();
      if (ja) return null;
      const { data: perguntas } = await adb.from("clima_perguntas").select("*").eq("pesquisa_id", p.id).order("ordem");
      return { pesquisa: p as ClimaPesquisa, perguntas: (perguntas ?? []) as ClimaPergunta[] };
    },
  });
  if (!data) return null;
  const set = (id: string, v: ClimaRespostaItem) => setResp((r) => ({ ...r, [id]: { ...r[id], ...v } }));
  const enviar = async () => {
    const falta = data.perguntas.find((q) => q.obrigatoria && (q.tipo === "escala_0_10" ? typeof resp[q.id]?.nota !== "number" : !resp[q.id]?.texto?.trim()));
    if (falta) return toast.error(`Responda: ${falta.enunciado.slice(0, 60)}…`);
    setEnviando(true);
    const { error } = await adb.from("clima_respostas").insert({ pesquisa_id: data.pesquisa.id, user_id: userId, respostas: resp });
    setEnviando(false);
    if (error) return toast.error(erroAcademia(error));
    toast.success("Obrigado! Sua resposta foi enviada.");
    setAberto(false);
    qc.invalidateQueries({ queryKey: ["clima"] });
  };
  return (
    <>
      <section className="ac-card p-6 flex flex-wrap items-center justify-between gap-4 border-primary/40">
        <div><div className="ac-eyebrow">Pesquisa de Clima</div><h2 className="text-xl mt-1">{data.pesquisa.titulo}</h2>
          {data.pesquisa.descricao && <p className="text-muted-foreground text-sm mt-1">{data.pesquisa.descricao}</p>}</div>
        <Button onClick={() => setAberto(true)}>Responder</Button>
      </section>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{data.pesquisa.titulo}</DialogTitle></DialogHeader>
          <div className="space-y-6">
            {data.perguntas.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <p className="font-medium">{i + 1}. {q.enunciado}</p>
                {q.tipo === "escala_0_10" ? (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 11 }, (_, n) => (
                      <button key={n} type="button" onClick={() => set(q.id, { nota: n })}
                        className={cn("h-9 w-9 rounded-md border text-sm font-semibold", resp[q.id]?.nota === n ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted")}>{n}</button>
                    ))}
                  </div>
                ) : null}
                {(q.tipo === "texto" || q.permite_comentario) && (
                  <Textarea rows={q.tipo === "texto" ? 5 : 2} placeholder={q.tipo === "texto" ? "Escreva sua resposta" : "Qual área e por quê? (opcional)"}
                    value={resp[q.id]?.texto ?? ""} onChange={(e) => set(q.id, { texto: e.target.value })} />
                )}
              </div>
            ))}
            <div className="flex justify-end"><Button onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar respostas"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
