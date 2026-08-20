import { useState } from "react";
import { UserCog, Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import {
  useAgendadoresDisponiveis, useAjusteAgendador, useCorrigirAgendador,
} from "@/hooks/useCorrigirAgendador";

interface Props {
  attendeeId: string;
  /** Nome atual do agendador, quando existe. */
  nomeAtual?: string | null;
  bookedById?: string | null;
}

/**
 * Corrige o agendador (`booked_by`) de um participante da reunião.
 * Toda gravação passa por RPC auditada — quem corrigiu fica visível aqui mesmo.
 */
export function AgendadorEditor({ attendeeId, nomeAtual, bookedById }: Props) {
  const [editando, setEditando] = useState(false);
  const [escolhido, setEscolhido] = useState<string>(bookedById || "");
  const { data: opcoes = [], isLoading } = useAgendadoresDisponiveis(editando);
  const { data: ajuste } = useAjusteAgendador(attendeeId);
  const corrigir = useCorrigirAgendador();

  const salvar = async () => {
    if (!escolhido) return;
    await corrigir.mutateAsync({ attendeeId, bookedBy: escolhido });
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="space-y-2">
        <Select value={escolhido} onValueChange={setEscolhido}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={isLoading ? "Carregando..." : "Escolher quem agendou"} />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => (
              <SelectItem key={o.id} value={o.id} className="text-xs">
                {o.nome}
                {o.email ? ` · ${o.email}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={salvar} disabled={!escolhido || corrigir.isPending}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => { setEditando(false); setEscolhido(bookedById || ""); }}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A correção fica registrada com seu nome e aparece na revisão da gestão.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm">
        {nomeAtual || <span className="italic text-muted-foreground">sem agendador registrado</span>}
      </span>
      {ajuste && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-[10px] gap-1">
              <ShieldCheck className="h-3 w-3" />
              ajustado
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            Agendador ajustado por {ajuste.por_nome}
            {ajuste.em ? ` em ${format(new Date(ajuste.em), "dd/MM/yyyy HH:mm")}` : ""}
            {ajuste.anterior_nome ? ` (antes: ${ajuste.anterior_nome})` : " (antes: em branco)"}
          </TooltipContent>
        </Tooltip>
      )}
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditando(true)}>
        <UserCog className="h-3.5 w-3.5 mr-1" />
        Corrigir
      </Button>
    </div>
  );
}
