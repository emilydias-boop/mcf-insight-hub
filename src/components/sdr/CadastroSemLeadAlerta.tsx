import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, UserCog } from "lucide-react";
import { ResiduoDetalheModal } from "./ResiduoDetalheModal";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface Props {
  /** Cotas cujo cadastro não tem lead/agendador resolvível na própria linha. */
  cotas: number;
  credito: number;
  items: CotaResiduoItem[];
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Caixa({
  titulo,
  subtitulo,
  icone,
  children,
  onOpen,
}: {
  titulo: string;
  subtitulo: string;
  icone: React.ReactNode;
  children?: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2 hover:bg-amber-500/20 transition-colors"
    >
      <span className="text-amber-500 mt-0.5 shrink-0">{icone}</span>
      <span className="flex-1 text-xs text-amber-600 dark:text-amber-400">
        <span className="font-semibold">{titulo}</span>
        <span className="block text-[11px] opacity-90">{subtitulo}</span>
        {children}
      </span>
      <ChevronRight className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
    </button>
  );
}

/**
 * Duas caixas SEPARADAS, cada uma com sua ação:
 *  - qualidade de cadastro: falta o vínculo cota → lead (ação: vincular lead)
 *  - sem agendador a creditar: o vínculo existe, mas a reunião está sem
 *    `booked_by` ou o lead não passou por R1 de consórcio
 * Nenhuma das duas entra na soma das linhas da tabela.
 */
export function CadastroSemLeadAlerta({ items }: Props) {
  const [aberta, setAberta] = useState<"vinculo" | "agendador" | null>(null);

  const { semVinculo, semAgendador } = useMemo(() => {
    const linkFaltando = new Set(["sem_cadastro", "sem_lead", "deal_inexistente", undefined as any]);
    const a: CotaResiduoItem[] = [];
    const b: CotaResiduoItem[] = [];
    items.forEach((i) => (linkFaltando.has(i.problema as any) ? a : b).push(i));
    return { semVinculo: a, semAgendador: b };
  }, [items]);

  const soma = (rs: CotaResiduoItem[]) => rs.reduce((s, r) => s + (Number(r.valorCredito) || 0), 0);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {semVinculo.length > 0 && (
        <Caixa
          icone={<AlertTriangle className="h-4 w-4" />}
          titulo={`${semVinculo.length} cota${semVinculo.length === 1 ? "" : "s"} com cadastro sem lead vinculado — vincular lead`}
          subtitulo={`${brl(soma(semVinculo))} em crédito. Qualidade de cadastro, não atribuição: parte dessas cotas já está creditada porque outra cota do mesmo cliente tem o vínculo.`}
          onOpen={() => setAberta("vinculo")}
        />
      )}

      {semAgendador.length > 0 && (
        <Caixa
          icone={<UserCog className="h-4 w-4" />}
          titulo={`${semAgendador.length} cota${semAgendador.length === 1 ? "" : "s"} sem agendador a creditar`}
          subtitulo={`${brl(soma(semAgendador))} em crédito. O vínculo existe, mas a reunião de consórcio está sem agendador registrado — ou o lead não passou por R1 desta BU, caso em que não há correção por vínculo.`}
          onOpen={() => setAberta("agendador")}
        />
      )}

      <ResiduoDetalheModal
        open={aberta === "vinculo"}
        onOpenChange={(o) => setAberta(o ? "vinculo" : null)}
        kind="cota"
        titulo="Cotas com cadastro sem lead vinculado"
        descricao="Cotas contratadas no período cujo cadastro não aponta para nenhum negócio válido do CRM. A ação é vincular o lead; a coluna Motivo diz exatamente qual dado falta e o selo mostra quando o cliente já foi creditado por outra cota."
        items={semVinculo}
        esperado={semVinculo.length}
        permitirCorrigirVinculo
      />
      <ResiduoDetalheModal
        open={aberta === "agendador"}
        onOpenChange={(o) => setAberta(o ? "agendador" : null)}
        kind="cota"
        titulo="Cotas sem agendador a creditar"
        descricao="O vínculo cota → lead existe. Falta o agendador: quando há reunião de consórcio elegível sem booked_by, informe quem agendou. Quando o lead não tem reunião desta BU, não há correção por vínculo — a venda segue sem SDR a creditar."
        items={semAgendador}
        esperado={semAgendador.length}
        permitirCorrigirVinculo
      />
    </div>
  );
}
