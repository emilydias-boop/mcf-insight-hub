import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Link2, Loader2, Lock, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMonthLock } from "@/hooks/useMonthLock";
import {
  useCorrigirVinculoCota,
  useCotaTitular,
  useCotasArrastadas,
  useLeadsParaVinculo,
  useR1ConsorcioPorDeal,
  type LeadVinculoMatch,
} from "@/hooks/useCorrigirVinculoCota";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface Props {
  item: CotaResiduoItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrigido?: () => void;
}

/**
 * Corrige o vínculo cota → lead direto do modal de resíduos.
 *  - cadastro pendente existe sem lead: grava `deal_id` no cadastro
 *  - cota sem cadastro nenhum: cria o cadastro já vinculado à cota e ao lead
 * Tudo pela RPC `consorcio_corrigir_vinculo_cota`, que valida papel, mês fechado
 * e duplicidade, e deixa trilha de auditoria no banco.
 */
export function CorrigirVinculoCotaModal({ item, open, onOpenChange, onCorrigido }: Props) {
  const [selected, setSelected] = useState<LeadVinculoMatch | null>(null);
  const [buscaAmpla, setBuscaAmpla] = useState(false);
  const [termo, setTermo] = useState("");
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);
  const [outrasCotas, setOutrasCotas] = useState<number | null>(null);

  const { data: titular, isLoading: loadingTitular } = useCotaTitular(open ? item?.cardId ?? null : null);
  const { data: arrastadas } = useCotasArrastadas(open ? item?.cardId ?? null : null);
  const { data: leads = [], isFetching } = useLeadsParaVinculo(titular, termo, buscaAmpla, open);
  const { data: r1PorDeal } = useR1ConsorcioPorDeal(leads.map((l) => l.dealId), open);
  const corrigir = useCorrigirVinculoCota();

  const fmtDia = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return null;
    }
  };
  const r1Selecionado = selected ? r1PorDeal?.get(selected.dealId) : undefined;

  const anoMes = (item?.dataContratacao || "").slice(0, 7) || null;
  const { data: lock } = useMonthLock(anoMes);
  const mesFechado = !!lock?.is_active;

  const reset = () => {
    setSelected(null);
    setBuscaAmpla(false);
    setTermo("");
    setConfirmarDuplicado(false);
    setOutrasCotas(null);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSalvar = async () => {
    if (!item || !selected) return;
    const res = await corrigir.mutateAsync({
      cardId: item.cardId,
      dealId: selected.dealId,
      registrationId: item.pendingRegId,
      confirmarDuplicado,
    });
    if (res.status === "confirmacao_necessaria") {
      setOutrasCotas(res.outras_cotas ?? 1);
      return;
    }
    onCorrigido?.();
    handleClose(false);
  };

  const criaCadastro = !item?.pendingRegId;
  /** O vínculo já existe e aponta para o lead errado: é troca, não criação. */
  const trocandoLead = !!item?.dealId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {trocandoLead ? "Trocar o lead desta cota" : "Corrigir vínculo da cota com o lead"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {trocandoLead
              ? "Esta cota já aponta para um lead, mas não é o lead que passou pela reunião. Escolha abaixo o lead com o selo \"tem R1 de consórcio\" — é ele que credita a venda."
              : criaCadastro
                ? "Esta cota não tem cadastro no fluxo de venda. Ao escolher o lead, o cadastro é criado já vinculado à cota, copiando os dados do titular."
                : "O cadastro desta cota existe, mas está sem lead. Escolha o lead do CRM a que a cota pertence."}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div className="font-medium text-sm">{item.cliente}</div>
            <div className="text-muted-foreground">
              {[item.grupo, item.cota].filter(Boolean).join("/") || "sem grupo/cota"}
              {item.vendedorName ? ` · Vendedor: ${item.vendedorName}` : " · sem vendedor"}
              {titular?.telefone ? ` · ${titular.telefone}` : ""}
              {titular?.email ? ` · ${titular.email}` : ""}
            </div>
            {trocandoLead && (
              <div className="pt-1 border-t mt-1 flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground">Lead vinculado hoje:</span>
                <span className="font-medium">{leadAtual?.nome || "carregando..."}</span>
                <a
                  href={`/consorcio/crm/negocios?deal=${item.dealId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="Abrir o lead vinculado hoje"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        )}


        {!!arrastadas?.cotas && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Este cliente tem mais {arrastadas.cotas} cota{arrastadas.cotas === 1 ? "" : "s"} (
            {arrastadas.credito.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            })}
            ) que passarão a ser creditadas ao SDR deste lead. A atribuição é por cliente: um
            vínculo errado move todas.
          </div>
        )}

        {mesFechado && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            O mês {anoMes} está fechado. O vínculo desta cota não pode mais ser alterado.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">
              {buscaAmpla ? "Busca ampla no CRM" : "Leads compatíveis com o titular da cota"}
            </Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={buscaAmpla}
                onCheckedChange={(v) => {
                  setBuscaAmpla(!!v);
                  setSelected(null);
                }}
              />
              Buscar qualquer lead
            </label>
          </div>

          {buscaAmpla && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Nome, e-mail ou telefone (mín. 3 caracteres)"
                />
              </div>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                A busca ampla ignora o CPF/CNPJ, telefone e e-mail do titular. Confirme que o lead é
                mesmo desta cota — a correção fica registrada no seu nome.
              </div>
            </>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-[160px] max-h-[300px] border rounded-md">
          {loadingTitular || isFetching ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {buscaAmpla
                ? "Nenhum lead encontrado para a busca."
                : "Nenhum lead compatível com o titular desta cota. Use a busca ampla se souber qual é o lead."}
            </div>
          ) : (
            <div className="p-1">
              {leads.map((l) => (
                <button
                  type="button"
                  key={l.dealId}
                  onClick={() => {
                    setSelected(l);
                    setOutrasCotas(null);
                    setConfirmarDuplicado(false);
                  }}
                  className={cn(
                    "w-full text-left rounded px-2 py-2 flex items-start gap-2 hover:bg-muted/60",
                    selected?.dealId === l.dealId && "bg-primary/10",
                  )}
                >
                  {selected?.dealId === l.dealId ? (
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{l.contactName || "(sem nome)"}</span>
                      {l.casaTitular && (
                        <Badge variant="secondary" className="text-[10px]">bate com o titular</Badge>
                      )}
                      {r1PorDeal?.get(l.dealId) ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        >
                          tem R1 de consórcio
                          {fmtDia(r1PorDeal.get(l.dealId)!.dia) ? ` · ${fmtDia(r1PorDeal.get(l.dealId)!.dia)}` : ""}
                          {r1PorDeal.get(l.dealId)!.closerName ? ` · ${r1PorDeal.get(l.dealId)!.closerName}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          sem R1 de consórcio
                        </Badge>
                      )}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {[l.telefone, l.email, l.originName, l.stageName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <a
                    href={`/consorcio/crm/negocios?deal=${l.dealId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground mt-0.5"
                    title="Abrir o lead no CRM"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {selected && !r1Selecionado && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            O lead escolhido não tem reunião de consórcio elegível. Vincular a cota a ele não credita
            a venda a nenhum SDR — e desfaz a atribuição atual, se houver. Escolha o lead com o selo
            "tem R1 de consórcio" quando existir.
          </div>
        )}

        {selected && r1Selecionado && !r1Selecionado.temAgendador && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Este lead tem R1 de consórcio, mas a reunião está sem agendador registrado. Depois de
            vincular, use "Informar agendador" para a venda ser creditada.
          </div>
        )}

        {outrasCotas != null && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs space-y-2">
            <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Este lead já está vinculado a {outrasCotas} outra{outrasCotas === 1 ? "" : "s"} cota
              {outrasCotas === 1 ? "" : "s"}. Isso é normal quando o cliente comprou mais de uma cota —
              e é erro quando o lead não é o dono desta.
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={confirmarDuplicado}
                onCheckedChange={(v) => setConfirmarDuplicado(!!v)}
              />
              Confirmo que esta cota também pertence a este lead
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            disabled={
              !selected ||
              mesFechado ||
              corrigir.isPending ||
              (outrasCotas != null && !confirmarDuplicado)
            }
          >
            {corrigir.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {criaCadastro ? "Criar cadastro e vincular" : "Vincular ao lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}