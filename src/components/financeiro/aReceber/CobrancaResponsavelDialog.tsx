import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserRoundCheck, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { useAllProfiles } from '@/hooks/useArGestores';
import { useRegistrarCobrancaResponsavel } from '@/hooks/useAReceber';
import type { ArTitulo } from '@/types/aReceber';

/** Nome do responsável pela cobrança (resolve pelo cadastro de perfis) */
export function useCobrancaResponsavelName(id?: string | null) {
  const { data: profiles } = useAllProfiles();
  if (!id) return null;
  return profiles?.find(p => p.id === id)?.full_name ?? null;
}

/** Exibição compacta: responsável + data/nota da última cobrança */
export function CobrancaResponsavelInfo({
  titulo,
  compact = false,
}: {
  titulo: Pick<ArTitulo, 'cobranca_responsavel_id' | 'cobranca_ultima_data' | 'cobranca_ultima_nota'>;
  compact?: boolean;
}) {
  const name = useCobrancaResponsavelName(titulo.cobranca_responsavel_id);
  const dataFmt = titulo.cobranca_ultima_data
    ? format(new Date(titulo.cobranca_ultima_data + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
    : null;

  if (!name && !dataFmt && !titulo.cobranca_ultima_nota) {
    return <span className="text-xs text-muted-foreground">Sem responsável</span>;
  }

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {name && (
        <Badge variant="outline" className="bg-sky-500/10 text-sky-700 border-sky-500/30 text-[10px] max-w-full">
          <UserRoundCheck className="w-3 h-3 mr-1 shrink-0" />
          <span className="truncate">{name}</span>
        </Badge>
      )}
      {dataFmt && (
        <div className="text-[11px] text-muted-foreground">Cobrado em {dataFmt}</div>
      )}
      {titulo.cobranca_ultima_nota && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-start gap-1 text-[11px] text-muted-foreground max-w-[200px]">
                <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{titulo.cobranca_ultima_nota}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs whitespace-pre-wrap">
              {titulo.cobranca_ultima_nota}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/** Dialog controlado para definir responsável + data e nota da cobrança */
export function CobrancaResponsavelDialog({
  titulo,
  open,
  onOpenChange,
}: {
  titulo: ArTitulo;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: profiles } = useAllProfiles();
  const registrar = useRegistrarCobrancaResponsavel();
  const [responsavel, setResponsavel] = useState<string>(titulo.cobranca_responsavel_id ?? 'none');
  const [dataCobranca, setDataCobranca] = useState<string>(
    titulo.cobranca_ultima_data ?? new Date().toISOString().slice(0, 10),
  );
  const [nota, setNota] = useState<string>('');

  useEffect(() => {
    if (open) {
      setResponsavel(titulo.cobranca_responsavel_id ?? 'none');
      setDataCobranca(titulo.cobranca_ultima_data ?? new Date().toISOString().slice(0, 10));
      setNota('');
    }
  }, [open, titulo.cobranca_responsavel_id, titulo.cobranca_ultima_data]);

  const submit = async () => {
    try {
      await registrar.mutateAsync({
        tituloId: titulo.id,
        responsavel_id: responsavel === 'none' ? null : responsavel,
        data_cobranca: nota.trim() ? dataCobranca : (dataCobranca || null),
        nota,
      });
      toast.success('Cobrança registrada');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao registrar cobrança');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsável pela cobrança</DialogTitle>
          <DialogDescription>
            {titulo.customer_name} · {titulo.product_code || titulo.product_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Responsável</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem responsável —</SelectItem>
                {(profiles ?? []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data da cobrança realizada</Label>
            <Input type="date" className="mt-1" value={dataCobranca} onChange={(e) => setDataCobranca(e.target.value)} />
          </div>
          <div>
            <Label>Nota da cobrança</Label>
            <Textarea
              className="mt-1"
              rows={4}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex.: Ligação realizada, cliente confirmou pagamento até 10/08…"
            />
            {titulo.cobranca_ultima_nota && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Última nota: {titulo.cobranca_ultima_nota}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={registrar.isPending}>
            {registrar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Filtro por responsável de cobrança (reutilizado em listagem e esteira) */
export function CobrancaResponsavelFilter({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { data: profiles } = useAllProfiles();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Resp. cobrança" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os responsáveis</SelectItem>
        <SelectItem value="none">Sem responsável</SelectItem>
        {(profiles ?? []).map(p => (
          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}