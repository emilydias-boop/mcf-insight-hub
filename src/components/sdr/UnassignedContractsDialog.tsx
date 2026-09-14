import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link2, Loader2, ListChecks, AlertTriangle, Undo2 } from "lucide-react";
import { UnassignedContractItem } from "@/hooks/useUnassignedContracts";
import { useSugestoesVinculoContrato, SugestaoVinculo } from "@/hooks/useSugestoesVinculoContrato";
import { useAtribuirVinculoContrato } from "@/hooks/useAtribuirVinculoContrato";
import {
  useAtribuicoesManuaisPeriodo,
  useDesfazerAtribuicaoManual,
  AtribuicaoManual,
} from "@/hooks/useAtribuicoesManuaisPeriodo";

interface UnassignedContractsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: UnassignedContractItem[];
  /** Quando informado, filtra a lista por segmento. */
  segment?: 'A' | 'B' | null;
  context: 'closers' | 'sdrs';
  startDate: Date;
  endDate: Date;
}

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatDay = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatValue = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const forcaBadge = (forca: SugestaoVinculo['forca']) => {
  const label = forca === 'forte' ? 'forte' : forca === 'media' ? 'média' : 'fraca';
  const variant = forca === 'forte' ? 'default' : forca === 'media' ? 'secondary' : 'outline';
  return <Badge variant={variant as any} className="text-[10px] px-1.5 py-0">{label}</Badge>;
};

/**
 * Avisos dos casos delicados. Não bloqueiam nada — aparecem na linha e também
 * no diálogo de confirmação, para a decisão ser tomada vendo.
 */
const avisosDe = (s: SugestaoVinculo): string[] => {
  const avisos: string[] = [];
  if (String(s.status_attendee || '').toLowerCase() === 'no_show') {
    avisos.push('reunião marcada como falta');
  }
  if (s.scheduled_at && s.sale_date) {
    const dias = (new Date(s.sale_date).getTime() - new Date(s.scheduled_at).getTime()) / 86_400_000;
    if (dias > 30) {
      avisos.push(`reunião de ${formatDay(s.scheduled_at)}, bem anterior ao pagamento`);
    }
  }
  if (s.forca === 'fraca') {
    avisos.push('casamento apenas por nome — confiança fraca');
  }
  return avisos;
};

const Avisos = ({ avisos }: { avisos: string[] }) =>
  avisos.length === 0 ? null : (
    <div className="space-y-0.5">
      {avisos.map((a) => (
        <div key={a} className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{a}</span>
        </div>
      ))}
    </div>
  );

export function UnassignedContractsDialog({
  open,
  onOpenChange,
  items,
  segment,
  context,
  startDate,
  endDate,
}: UnassignedContractsDialogProps) {
  const list = segment ? items.filter((i) => i.segment === segment) : items;

  const { data: sugestoes, isLoading: loadingSugestoes } = useSugestoesVinculoContrato(
    startDate,
    endDate,
    'incorporador',
    open,
  );
  const atribuir = useAtribuirVinculoContrato();

  const { data: atribuicoes } = useAtribuicoesManuaisPeriodo(startDate, endDate, 'incorporador', open);
  const desfazer = useDesfazerAtribuicaoManual();
  const [mostrarAtribuidos, setMostrarAtribuidos] = useState(false);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState<AtribuicaoManual | null>(null);

  // Confirmação de atribuição direta (candidato único e forte).
  const [confirmar, setConfirmar] = useState<SugestaoVinculo | null>(null);
  // Escolha entre candidatos (ambíguo ou força fraca).
  const [escolher, setEscolher] = useState<{ nome: string; candidatos: SugestaoVinculo[] } | null>(null);

  const candidatosDe = (item: UnassignedContractItem): SugestaoVinculo[] =>
    (item.transaction_id && sugestoes?.get(item.transaction_id)) || [];

  const renderSugestao = (item: UnassignedContractItem) => {
    if (!item.transaction_id) {
      return item.suggested ? <span>{item.suggested}</span> : <span className="text-muted-foreground">—</span>;
    }
    if (loadingSugestoes) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    }
    const cands = candidatosDe(item);
    if (cands.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }

    const melhor = cands[0];
    const direto = cands.length === 1 && melhor.forca === 'forte';

    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{melhor.closer_name || 'closer sem nome'}</span>
          {forcaBadge(melhor.forca)}
          <span className="text-[11px] text-muted-foreground">{melhor.criterio}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          R1 {formatDate(melhor.scheduled_at)} · {melhor.status_attendee || 'sem status'}
          {!melhor.r1_antes_do_pagamento && ' · reunião depois do pagamento'}
          {cands.length > 1 && ` · ${cands.length} candidatos`}
        </div>
        <Avisos avisos={avisosDe(melhor)} />
        {direto ? (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmar(melhor)}>
            <Link2 className="h-3 w-3 mr-1" /> Atribuir
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setEscolher({ nome: item.reference, candidatos: cands })}
          >
            <ListChecks className="h-3 w-3 mr-1" /> Escolher
          </Button>
        )}
      </div>
    );
  };

  const avisosConfirmar = confirmar ? avisosDe(confirmar) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Contratos não atribuídos{segment ? ` — Lead ${segment}` : ''}
            </DialogTitle>
            <DialogDescription>
              {list.length} contrato(s)/caução(ões) pagos no período que a atribuição por{' '}
              {context === 'closers' ? 'Closer' : 'SDR'} não consegue vincular. Atribuir liga o pagamento
              à reunião que já existe e dá o crédito ao closer — nada é gravado sem o seu clique, e toda
              atribuição pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {(atribuicoes?.length ?? 0) > 0
                ? `${atribuicoes?.length} atribuição(ões) manual(is) já registrada(s) no período.`
                : 'Nenhuma atribuição manual registrada no período.'}
            </span>
            {(atribuicoes?.length ?? 0) > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMostrarAtribuidos(true)}>
                <Undo2 className="h-3 w-3 mr-1" /> Ver / desfazer
              </Button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Lead / Negócio</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-center">Segmento</TableHead>
                  <TableHead className="text-center">Valor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="min-w-[240px]">Sugestão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhum contrato não atribuído no período.
                    </TableCell>
                  </TableRow>
                )}
                {list.map((item, idx) => (
                  <TableRow key={`${item.transaction_id ?? item.deal_id ?? 'no-deal'}-${idx}`}>
                    <TableCell className="font-medium">{item.reference}</TableCell>
                    <TableCell className="text-center whitespace-nowrap">{formatDate(item.paid_at)}</TableCell>
                    <TableCell className="text-center">
                      {item.segment ? (
                        <Badge variant="outline">Lead {item.segment}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">sem segmento</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">{formatValue(item.value)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.reason || item.source}</TableCell>
                    <TableCell className="text-sm">{renderSugestao(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Escolha manual entre candidatos */}
      <Dialog open={!!escolher} onOpenChange={(o) => !o && setEscolher(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escolher reunião — {escolher?.nome}</DialogTitle>
            <DialogDescription>
              Nenhuma opção vem pré-selecionada. Confira data, closer e status antes de atribuir.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-md border border-border divide-y divide-border">
            {(escolher?.candidatos ?? []).map((c) => (
              <div key={`${c.deal_id}-${c.attendee_id}`} className="flex items-center justify-between gap-3 p-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {c.closer_name || 'closer sem nome'}
                    {forcaBadge(c.forca)}
                    <span className="text-[11px] font-normal text-muted-foreground">{c.criterio}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R1 {formatDate(c.scheduled_at)} · status {c.status_attendee || '—'}
                    {!c.r1_antes_do_pagamento && ' · reunião depois do pagamento'}
                  </div>
                  <Avisos avisos={avisosDe(c)} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEscolher(null);
                    setConfirmar(c);
                  }}
                >
                  <Link2 className="h-3 w-3 mr-1" /> Atribuir esta
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Atribuições já feitas no período — desfazer */}
      <Dialog open={mostrarAtribuidos} onOpenChange={setMostrarAtribuidos}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Atribuições manuais do período</DialogTitle>
            <DialogDescription>
              Desfazer apaga o crédito do closer e devolve o contrato para a lista de não atribuídos.
              Valor, data e status do pagamento não são alterados em nenhum dos dois sentidos.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-md border border-border divide-y divide-border">
            {(atribuicoes ?? []).length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nenhuma atribuição manual no período.
              </div>
            )}
            {(atribuicoes ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 p-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{a.contact_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.closer_name || 'closer sem nome'} · pagamento {formatDay(a.contract_paid_at)}
                    {a.deal_id ? '' : ' · sem negócio vinculado'}
                  </div>
                  {a.notes && <div className="text-[11px] text-muted-foreground">{a.notes}</div>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  disabled={desfazer.isPending}
                  onClick={() => setConfirmarDesfazer(a)}
                >
                  <Undo2 className="h-3 w-3 mr-1" /> Desfazer
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação da gravação */}
      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atribuir este contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O pagamento passa a ficar ligado à R1 de {formatDate(confirmar?.scheduled_at)} com{' '}
              {confirmar?.closer_name || 'o closer da reunião'} (casamento por {confirmar?.criterio},
              confiança {confirmar?.forca === 'media' ? 'média' : confirmar?.forca}), e o contrato passa a
              contar para esse closer. Valor, data e status do pagamento não são alterados, a reunião não é
              alterada, e a ação fica registrada com o seu nome — dá para desfazer depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {avisosConfirmar.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="text-xs font-medium mb-1">Atenção antes de confirmar:</div>
              <Avisos avisos={avisosConfirmar} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={atribuir.isPending}
              onClick={() => {
                if (confirmar) atribuir.mutate({ sugestao: confirmar, bu: 'incorporador' });
                setConfirmar(null);
              }}
            >
              {atribuir.isPending ? 'Atribuindo...' : 'Atribuir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação do desfazer */}
      <AlertDialog open={!!confirmarDesfazer} onOpenChange={(o) => !o && setConfirmarDesfazer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer esta atribuição?</AlertDialogTitle>
            <AlertDialogDescription>
              O crédito de {confirmarDesfazer?.contact_name} sai de{' '}
              {confirmarDesfazer?.closer_name || 'closer sem nome'} e o contrato volta para a lista de não
              atribuídos. Nada financeiro é alterado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmarDesfazer) desfazer.mutate(confirmarDesfazer);
                setConfirmarDesfazer(null);
              }}
            >
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
