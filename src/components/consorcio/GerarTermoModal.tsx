import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, FileSignature, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { TermoMarkdown } from './TermoMarkdown';
import { useTermoModelos, useCreateTermo, termoPublicUrl, type ConsorcioTermo } from '@/hooks/useConsorcioTermos';
import { montarDadosTermo, renderTermo, validarDadosTermo } from '@/lib/consorcioTermo';

interface GerarTermoModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  registrationId: string;
  /** Fecha este modal e abre o cadastro pendente em modo edição, no bloco "Dados da Cota". */
  onCompletarCadastro?: () => void;
}

export function GerarTermoModal({ open, onOpenChange, registrationId, onCompletarCadastro }: GerarTermoModalProps) {
  const { data: modelos = [], isLoading: loadingModelos } = useTermoModelos(true);
  const createTermo = useCreateTermo();
  const [gerado, setGerado] = useState<ConsorcioTermo | null>(null);

  const { data: reg, isLoading } = useQuery({
    queryKey: ['consorcio-pending-registration-termo', registrationId],
    enabled: open && !!registrationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!open) setGerado(null);
  }, [open]);

  const modelo = modelos[0];
  const faltando = useMemo(() => (reg ? validarDadosTermo(reg) : []), [reg]);
  const dados = useMemo(() => (reg ? montarDadosTermo(reg) : null), [reg]);
  const preview = useMemo(
    () => (modelo && dados ? renderTermo(modelo.conteudo, dados) : ''),
    [modelo, dados],
  );

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(termoPublicUrl(token));
    toast.success('Link copiado');
  };

  const handleGerar = async () => {
    if (!reg || !modelo || !dados) return;
    const termo = await createTermo.mutateAsync({
      pendingRegistrationId: reg.id,
      proposalId: reg.proposal_id,
      dealId: reg.deal_id,
      modeloId: modelo.id,
      modeloVersao: modelo.versao,
      dados,
      conteudoRenderizado: preview,
    });
    setGerado(termo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> Gerar Termo de Adesão
          </DialogTitle>
          <DialogDescription>
            O termo documenta o crédito contratado e o compromisso da MCF Capital de pagar as parcelas listadas.
            Depois de gerado, copie o link e envie ao cliente para assinatura eletrônica.
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
              Cadastre o texto do termo em Configurações do CRM → Termo de Adesão.
            </AlertDescription>
          </Alert>
        ) : gerado ? (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Termo gerado</AlertTitle>
              <AlertDescription>
                Envie este link ao cliente por WhatsApp, e-mail ou qualquer outro canal. Ele vale por 30 dias.
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
                  <p className="mt-2">
                    Abra o cadastro em Cotas a Fazer → ⋮ → Ver detalhes → Editar, ou use o botão abaixo.
                  </p>
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
          {!gerado && faltando.length > 0 && onCompletarCadastro && (
            <Button variant="outline" onClick={onCompletarCadastro}>
              Completar cadastro
            </Button>
          )}
          {!gerado && modelo && (
            <Button onClick={handleGerar} disabled={faltando.length > 0 || createTermo.isPending}>
              {createTermo.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Gerar termo e link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
