import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, FileBadge, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { TermoMarkdown } from './TermoMarkdown';
import { useTermoModelos, useCreateTermo, termoPublicUrl, type ConsorcioTermo } from '@/hooks/useConsorcioTermos';
import { renderTermo } from '@/lib/consorcioTermo';
import {
  montarDadosComprovante,
  validarDadosComprovante,
  type ComprovanteParcela,
} from '@/lib/consorcioComprovante';

interface GerarComprovanteModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string;
  /** Fecha este modal e abre a cota em edição (para completar dados faltantes). */
  onCompletarCota?: () => void;
}

/** Link do comprovante não expira na prática — 10 anos. */
function expiraEm10Anos() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString();
}

export function GerarComprovanteModal({ open, onOpenChange, cardId, onCompletarCota }: GerarComprovanteModalProps) {
  const { data: modelos = [], isLoading: loadingModelos } = useTermoModelos(true, 'comprovante_cadastro');
  const createTermo = useCreateTermo();
  const [gerado, setGerado] = useState<ConsorcioTermo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['consorcio-card-comprovante', cardId],
    enabled: open && !!cardId,
    queryFn: async () => {
      const [{ data: card, error: e1 }, { data: parcelas, error: e2 }] = await Promise.all([
        supabase.from('consortium_cards').select('*').eq('id', cardId).single(),
        supabase
          .from('consortium_installments')
          .select('numero_parcela, data_vencimento, tipo')
          .eq('card_id', cardId)
          .lte('numero_parcela', 12)
          .order('numero_parcela'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { card: card as any, parcelas: (parcelas || []) as unknown as ComprovanteParcela[] };
    },
  });

  useEffect(() => {
    if (!open) setGerado(null);
  }, [open]);

  const modelo = modelos[0];
  const card = data?.card;
  const parcelas = data?.parcelas || [];

  const faltando = useMemo(() => (card ? validarDadosComprovante(card, parcelas) : []), [card, parcelas]);
  const dados = useMemo(() => (card ? montarDadosComprovante(card, parcelas) : null), [card, parcelas]);
  const preview = useMemo(() => (modelo && dados ? renderTermo(modelo.conteudo, dados) : ''), [modelo, dados]);

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(termoPublicUrl(token));
    toast.success('Link copiado');
  };

  const handleGerar = async () => {
    if (!card || !modelo || !dados) return;
    const termo = await createTermo.mutateAsync({
      tipo: 'comprovante_cadastro',
      cardId: card.id,
      dealId: card.deal_id ?? null,
      modeloId: modelo.id,
      modeloVersao: modelo.versao,
      dados,
      conteudoRenderizado: preview,
      expiresAt: expiraEm10Anos(),
    });
    setGerado(termo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBadge className="h-5 w-5" /> Gerar Comprovante de Cadastro
          </DialogTitle>
          <DialogDescription>
            Comprova o cadastro da cota na Embracon (grupo, cota e contrato) e mostra o cronograma das 12 primeiras
            parcelas, indicando quais a MCF paga. É só leitura — o cliente não assina este documento.
          </DialogDescription>
        </DialogHeader>

        {isLoading || loadingModelos ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !modelo ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Nenhum modelo ativo</AlertTitle>
            <AlertDescription>
              Cadastre o texto em Configurações do CRM → Documentos → Comprovante de Cadastro.
            </AlertDescription>
          </Alert>
        ) : gerado ? (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Comprovante gerado</AlertTitle>
              <AlertDescription>
                Envie este link ao cliente por WhatsApp, e-mail ou qualquer outro canal. O sistema registra quando ele
                abrir o documento.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input readOnly value={termoPublicUrl(gerado.access_token)} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copyLink(gerado.access_token)}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {faltando.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Dados obrigatórios faltando</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {faltando.map((f) => (
                      <li key={f.campo}>{f.label}</li>
                    ))}
                  </ul>
                  <p className="mt-2">Complete os dados da cota (inclusive o número do contrato Embracon) e volte aqui.</p>
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-lg border bg-card p-5 text-sm max-h-[45vh] overflow-y-auto">
              <TermoMarkdown content={preview} />
            </div>
            <p className="text-xs text-muted-foreground">
              Modelo: {modelo.nome} — versão {modelo.versao}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {gerado ? 'Fechar' : 'Cancelar'}
          </Button>
          {!gerado && faltando.length > 0 && onCompletarCota && (
            <Button variant="outline" onClick={onCompletarCota}>
              Completar dados da cota
            </Button>
          )}
          {!gerado && modelo && (
            <Button onClick={handleGerar} disabled={faltando.length > 0 || createTermo.isPending}>
              {createTermo.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Gerar comprovante e link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
