import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { ResiduoDetalheModal } from "./ResiduoDetalheModal";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface Props {
  /** Cotas cujo cadastro não tem lead/agendador resolvível na própria linha. */
  cotas: number;
  credito: number;
  items: CotaResiduoItem[];
}

/**
 * Qualidade de cadastro — indicador SEPARADO da atribuição.
 * Não entra na soma das linhas: mede quantas cotas estão com o cadastro
 * incompleto, mesmo quando o resultado do cliente já foi creditado por outra
 * cota dele.
 */
export function CadastroSemLeadAlerta({ cotas, credito, items }: Props) {
  const [open, setOpen] = useState(false);
  if (!cotas) return null;

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2 hover:bg-amber-500/20 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <span className="flex-1 text-xs text-amber-600 dark:text-amber-400">
          <span className="font-semibold">
            {cotas} cota{cotas === 1 ? "" : "s"} com cadastro sem lead vinculado — corrigir
          </span>
          <span className="block text-[11px] opacity-90">
            {brl(credito)} em crédito. Isto mede qualidade de cadastro, não atribuição: parte
            dessas cotas já está creditada porque outra cota do mesmo cliente tem o vínculo.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      </button>

      <ResiduoDetalheModal
        open={open}
        onOpenChange={setOpen}
        kind="cota"
        titulo="Cotas com cadastro sem lead vinculado"
        descricao="Cotas contratadas no período cuja própria cadeia cota → cadastro pendente → negócio → reunião de consórcio → agendador está incompleta. A coluna Motivo diz exatamente qual dado falta; quando o cliente já teve o resultado creditado por outra cota, o selo mostra a quem."
        items={items}
        esperado={cotas}
        permitirCorrigirVinculo
      />
    </>
  );
}
