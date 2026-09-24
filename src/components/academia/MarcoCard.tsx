import { useState } from "react";
import { PenLine, CheckCircle2 } from "lucide-react";
import type { AMilestone } from "@/lib/academia";
import { useAcademiaRpc } from "@/hooks/useAcademia";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const DECLARACAO_90 =
  "Declaramos que o colaborador concluiu a Trilha de Integração de 90 dias da MCF Capital: domina o próprio produto, conhece as cinco frentes do ecossistema, respeita os valores e as regras de comunicação e de dados da casa, e está apto a conduzir atendimentos de forma autônoma, escalando o que for necessário.";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : null);

export function MarcoCard({ marco, papel, nome }: { marco: AMilestone; papel: "gestor" | "padrinho" | "colaborador" | "admin"; nome?: string }) {
  const assinar = useAcademiaRpc("academia_assinar_marco", "Assinatura registrada.");
  const [obs, setObs] = useState("");
  const is90 = marco.codigo === "conclusao_90";
  const linhas: { rotulo: string; em: string | null; papel: "gestor" | "padrinho" | "colaborador" }[] = [
    { rotulo: "Gestor", em: marco.assinatura_gestor_em, papel: "gestor" },
    { rotulo: "Padrinho", em: marco.assinatura_padrinho_em, papel: "padrinho" },
    ...(is90 ? [{ rotulo: "Colaborador", em: marco.assinatura_colaborador_em, papel: "colaborador" as const }] : []),
  ];
  const podeAssinar = (p: string) => papel === p || (papel === "admin" && p !== "colaborador");

  return (
    <div className="ac-card p-5 border-primary/40">
      <div className="ac-eyebrow">{is90 ? "Conclusão · 90 dias" : "Marco · 30 dias"}{nome ? ` · ${nome}` : ""}</div>
      <h3 className="text-lg mt-1">{is90 ? "Declaração de conclusão da trilha" : "Fases 0 e 1 concluídas — assinatura do marco"}</h3>
      <p className="text-sm text-muted-foreground mt-2">
        {is90 ? DECLARACAO_90 : "Explica o produto sem material, roda simulações sozinho, primeiro atendimento assistido feito, CRM em dia."}
      </p>
      <div className="mt-4 grid sm:grid-cols-3 gap-2">
        {linhas.map((l) => (
          <div key={l.rotulo} className="rounded-xl border p-3">
            <div className="text-xs text-muted-foreground">{l.rotulo}</div>
            {l.em ? <div className="flex items-center gap-1 text-primary font-semibold"><CheckCircle2 className="h-4 w-4" />{fmt(l.em)}</div>
              : podeAssinar(l.papel) ? (
                <Button size="sm" className="mt-1" disabled={assinar.isPending}
                  onClick={() => assinar.mutate({ _milestone_id: marco.id, _papel: papel === "admin" ? l.papel : papel, _observacoes: obs || null })}>
                  <PenLine className="h-4 w-4 mr-1" />Assinar
                </Button>) : <div className="text-sm ac-warn">Pendente</div>}
          </div>
        ))}
      </div>
      {(papel === "gestor" || papel === "padrinho" || papel === "admin") && (
        <Textarea className="mt-3" placeholder="Observações (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
      )}
    </div>
  );
}
