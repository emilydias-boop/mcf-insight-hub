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
import { Link2, Loader2, ListChecks } from "lucide-react";
import { UnassignedContractItem } from "@/hooks/useUnassignedContracts";
import { useSugestoesVinculoContrato, SugestaoVinculo } from "@/hooks/useSugestoesVinculoContrato";
import { useAtribuirVinculoContrato } from "@/hooks/useAtribuirVinculoContrato";

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

const formatValue = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const forcaBadge = (forca: SugestaoVinculo['forca']) => {
  const label = forca === 'forte' ? 'forte' : forca === 'media' ? 'média' : 'fraca';
  const variant = forca === 'forte' ? 'default' : forca === 'media' ? 'secondary' : 'outline';
  return <Badge variant={variant as any} className="text-[10px] px-1.5 py-0">{label}</Badge>;
};

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
              à reunião que já existe — nada é gravado sem o seu clique.
            </DialogDescription>
          </DialogHeader>

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

      {/* Confirmação da gravação */}
      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atribuir este contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O pagamento passa a ficar ligado à R1 de {formatDate(confirmar?.scheduled_at)} com{' '}
              {confirmar?.closer_name || 'o closer da reunião'} (casamento por {confirmar?.criterio},
              confiança {confirmar?.forca === 'media' ? 'média' : confirmar?.forca}). Valor, data e status
              do pagamento não são alterados, e a ação fica registrada com o seu nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={atribuir.isPending}
              onClick={() => {
                if (confirmar) atribuir.mutate({ sugestao: confirmar });
                setConfirmar(null);
              }}
            >
              {atribuir.isPending ? 'Atribuindo...' : 'Atribuir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
