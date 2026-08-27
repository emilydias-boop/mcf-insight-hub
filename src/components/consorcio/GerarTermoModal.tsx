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
import {
  montarDadosTermoMulti,
  renderTermo,
  validarDadosTermoMulti,
  divergenciasIdentidade,
  rotuloFaltando,
} from '@/lib/consorcioTermo';
import { normalizarParcelasMcf, derivarParcelasEmpresa } from '@/types/consorcioCartas';


interface GerarTermoModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /**
   * Termo da VENDA: cobre TODAS as cartas da proposta (um termo por venda).
   * É o caminho da etapa 3 do funil.
   */
  proposalId?: string;
  /** Termo de um cadastro específico (etapa 4, linha por carta). */
  registrationId?: string;
  /** Fecha este modal e abre o cadastro pendente em modo edição, no bloco "Dados da Cota". */
  onCompletarCadastro?: () => void;
}

interface RegRow {
  id: string;
  proposal_id: string | null;
  deal_id: string | null;
  status: string | null;
  created_at: string;
  [k: string]: unknown;
}

export function GerarTermoModal({
  open,
  onOpenChange,
  proposalId,
  registrationId,
  onCompletarCadastro,
}: GerarTermoModalProps) {
  const { data: modelos = [], isLoading: loadingModelos } = useTermoModelos(true);
  const createTermo = useCreateTermo();
  const [gerado, setGerado] = useState<ConsorcioTermo | null>(null);

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ['consorcio-termo-fonte', proposalId ?? null, registrationId ?? null],
    enabled: open && (!!proposalId || !!registrationId),
    queryFn: async (): Promise<RegRow[]> => {
      // Cinto de segurança: a lista marcada na CARTA é a fonte de verdade.
      // Se o cadastro ainda não recebeu a lista (propagação antiga), o termo
      // usa a da carta em vez de cair no par legado tipo+quantidade.
      // Somente leitura — nada é gravado aqui.
      const comFallbackDaCarta = (r: RegRow, parcelasCarta: number[] | null | undefined): RegRow => {
        const doCadastro = normalizarParcelasMcf((r as any).parcelas_mcf_numeros);
        if (doCadastro.length > 0) return r;
        const daCarta = normalizarParcelasMcf(parcelasCarta);
        if (daCarta.length === 0) return r;
        return { ...r, parcelas_mcf_numeros: daCarta, ...derivarParcelasEmpresa(daCarta) } as RegRow;
      };

      // Caminho por cadastro (etapa 4): o termo cobre só aquela carta.
      if (!proposalId && registrationId) {
        const { data, error } = await supabase
          .from('consorcio_pending_registrations')
          .select('*')
          .eq('id', registrationId)
          .single();
        if (error) throw error;
        const { data: carta } = await supabase
          .from('consorcio_proposal_cartas')
          .select('parcelas_mcf')
          .eq('pending_registration_id', registrationId)
          .order('ordem', { ascending: true })
          .limit(1)
          .maybeSingle();
        return [comFallbackDaCarta(data as unknown as RegRow, (carta as any)?.parcelas_mcf ?? null)];
      }

      // Caminho por proposta (etapa 3): TODOS os cadastros vivos da venda,
      // na ordem das cartas; sem vínculo de carta, cai na ordem de criação.
      const { data, error } = await supabase
        .from('consorcio_pending_registrations')
        .select('*')
        .eq('proposal_id', proposalId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const vivos = ((data || []) as unknown as RegRow[]).filter(r => r.status !== 'excluida');

      const { data: cartas } = await supabase
        .from('consorcio_proposal_cartas')
        .select('id, ordem, pending_registration_id, parcelas_mcf')
        .eq('proposal_id', proposalId!)
        .order('ordem', { ascending: true });

      const ordemPorReg = new Map<string, number>();
      const parcelasPorReg = new Map<string, number[] | null>();
      for (const c of (cartas || []) as Array<{ id: string; ordem: number | null; pending_registration_id: string | null; parcelas_mcf: number[] | null }>) {
        if (c.pending_registration_id) {
          ordemPorReg.set(c.pending_registration_id, Number(c.ordem ?? 0));
          parcelasPorReg.set(c.pending_registration_id, c.parcelas_mcf ?? null);
        }
      }
      const chave = (r: RegRow, i: number) => {
        const porReg = ordemPorReg.get(r.id);
        if (porReg != null) return porReg;
        return 1000 + i; // sem vínculo: mantém a ordem de criação, sempre depois
      };
      return vivos
        .map((r, i) => ({ r, k: chave(r, i) }))
        .sort((a, b) => a.k - b.k)
        .map(x => comFallbackDaCarta(x.r, parcelasPorReg.get(x.r.id) ?? null));
    },

  });

  useEffect(() => {
    if (!open) setGerado(null);
  }, [open]);

  const modelo = modelos[0];
  const divergencias = useMemo(() => divergenciasIdentidade(regs as any[]), [regs]);
  const faltando = useMemo(() => (regs.length ? validarDadosTermoMulti(regs as any[]) : []), [regs]);
  const dados = useMemo(() => (regs.length ? montarDadosTermoMulti(regs as any[]) : null), [regs]);
  const preview = useMemo(
    () => (modelo && dados ? renderTermo(modelo.conteudo, dados) : ''),
    [modelo, dados],
  );

  const bloqueado = faltando.length > 0 || divergencias.length > 0 || regs.length === 0;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(termoPublicUrl(token));
    toast.success('Link copiado');
  };

  const handleGerar = async () => {
    if (!modelo || !dados || !regs.length) return;
    const primeiro = regs[0];
    const termo = await createTermo.mutateAsync({
      // `proposal_id` é o vínculo autoritativo do termo da venda; o
      // `pending_registration_id` da 1ª carta fica só por compatibilidade.
      pendingRegistrationId: primeiro.id,
      proposalId: proposalId ?? primeiro.proposal_id,
      dealId: primeiro.deal_id,
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
            {regs.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Esta venda tem {regs.length} cartas — o termo cobre todas, com o crédito total somado.
              </p>
            )}

            {divergencias.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cadastros da venda não são da mesma pessoa</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {divergencias.map(d => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    Corrija os cadastros antes de emitir o termo — um único documento não pode cobrir pessoas diferentes.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {faltando.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Dados obrigatórios faltando</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {faltando.map(f => (
                      <li key={f.campo}>{rotuloFaltando(f)}</li>
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
            <Button onClick={handleGerar} disabled={bloqueado || createTermo.isPending}>
              {createTermo.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Gerar termo e link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
