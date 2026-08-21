import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCreatePendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DadosPlanoFields, useDadosPlano } from './DadosPlanoFields';
import { CloserR1NoteBlock } from './CloserR1NoteBlock';
import { DadosClienteFields, TipoPessoaSelect, useDadosCliente } from './DadosClienteBloco';
import { parseBRLInput, numberToBRLInput } from '@/lib/brlMask';
import { derivarParcelasEmpresa } from '@/types/consorcioCartas';
import { formatCurrency } from '@/lib/consorcioCalculos';

// A validação desta tela é feita pelo `checklistOk`/`docsOk` do bloco cadastral
// compartilhado (`DadosClienteBloco`) — aqui o bloco é obrigatório.

/** Valores do plano de UMA carta, reportados pelo bloco ao formulário-pai. */
interface PlanoPorCarta {
  credito_id?: string;
  condicao_pagamento?: string;
  parcela_1a_12a?: number;
  parcela_demais?: number;
  objetivo?: string;
  produto_codigo?: string;
  inclui_seguro: boolean;
}

interface CartaPlanoBlocoProps {
  carta: any;
  index: number;
  total: number;
  onChange: (cartaId: string, valores: PlanoPorCarta) => void;
  /** Sinal do 1º bloco: copie condição e objetivo (nunca valor de parcela). */
  copia?: { seq: number; condicao?: string; objetivo?: string } | null;
  onRepetir?: (dados: { condicao?: string; objetivo?: string }) => void;
}

/**
 * Um bloco "Dados do plano" POR CARTA. Cada carta tem parcela própria — uma de
 * 150k e uma de 200k não têm o mesmo valor. Crédito, prazo e produto vêm da
 * carta e são somente leitura aqui (quem edita é o lançamento da venda).
 */
function CartaPlanoBloco({ carta, index, total, onChange, copia, onRepetir }: CartaPlanoBlocoProps) {
  const plano = useDadosPlano();
  const hidratado = useRef(false);

  useEffect(() => {
    if (hidratado.current) return;
    hidratado.current = true;
    // O bloco já vem preenchido com o plano digitado no lançamento da venda.
    plano.hidratar({
      valorCredito: Number(carta.valor_credito) || null,
      prazo: Number(carta.prazo_meses) || null,
      condicao: carta.condicao_pagamento ?? null,
      parcela1a12: carta.parcela_1a_12a != null ? Number(carta.parcela_1a_12a) : null,
      parcelaDemais: carta.parcela_demais != null ? Number(carta.parcela_demais) : null,
      objetivo: carta.objetivo ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carta.id]);


  // Conveniência do 1º bloco: replica condição e objetivo nas demais cartas.
  const ultimaCopia = useRef(0);
  useEffect(() => {
    if (!copia || copia.seq === ultimaCopia.current) return;
    ultimaCopia.current = copia.seq;
    if (copia.condicao) plano.setCondicao(copia.condicao);
    if (copia.objetivo) plano.setObjetivo(copia.objetivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copia?.seq]);

  const v = plano.valores;
  useEffect(() => {
    onChange(carta.id, {
      credito_id: v.credito_id,
      condicao_pagamento: v.condicao_pagamento,
      parcela_1a_12a: v.parcela_1a_12a,
      parcela_demais: v.parcela_demais,
      objetivo: v.objetivo,
      produto_codigo: v.produto_codigo,
      inclui_seguro: plano.incluiSeguro,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    v.credito_id, v.condicao_pagamento, v.parcela_1a_12a, v.parcela_demais,
    v.objetivo, v.produto_codigo, plano.incluiSeguro,
  ]);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">
          Carta {index + 1} de {total}
          <span className="text-muted-foreground font-normal">
            {' · '}{formatCurrency(Number(carta.valor_credito) || 0)}
            {' · '}{carta.prazo_meses}x
            {carta.tipo_produto ? ` · ${carta.tipo_produto}` : ''}
          </span>
        </h3>
        {index === 0 && total > 1 && onRepetir && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRepetir({ condicao: plano.condicao, objetivo: plano.objetivo })}
            title="Copia condição de pagamento e objetivo para as demais cartas (o valor da parcela continua individual)"
          >
            Repetir para as demais cartas
          </Button>
        )}
      </div>
      <DadosPlanoFields
        plano={plano}
        hide={['valorCredito', 'prazo', 'diaVencimento', 'inicioSegundaParcela']}
      />
    </div>
  );
}

interface AcceptProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  dealId: string;
  contactName: string;
  vendedorName: string;
}


export function AcceptProposalModal({
  open,
  onOpenChange,
  proposalId,
  dealId,
  contactName,
  vendedorName,
}: AcceptProposalModalProps) {
  // ===== Dados do plano (comerciais do Termo de Adesão) — bloco compartilhado =====
  // Dia de vencimento e início da 2ª parcela saíram do lançamento da venda:
  // quem define é a Embracon, depois. Aqui também ficam escondidos.
  const plano = useDadosPlano();
  const { valorCreditoStr, prazo, incluiSeguro, produtoDoPlano } = plano;

  // Bloco cadastral do cliente (mesmo componente do lançamento da venda).
  const cliente = useDadosCliente({ nomeInicial: contactName });
  const { form, tipoPessoa } = cliente;

  // Carrega proposta para pegar valor_credito/prazo
  const { data: proposal } = useQuery({
    queryKey: ['consorcio-proposal-snapshot', proposalId],
    enabled: open && !!proposalId,
    queryFn: async () => {
      const { data } = await supabase
        .from('consorcio_proposals')
        .select('valor_credito, prazo_meses, proposal_details, tipo_produto, origem_lead, crm_deals (crm_contacts (phone, email))')
        .eq('id', proposalId)
        .maybeSingle();
      // Cartas da proposta: cada carta ainda sem cadastro gera 1 cadastro pendente.
      const { data: cartas } = await supabase
        .from('consorcio_proposal_cartas')
        .select('id, ordem, valor_credito, prazo_meses, tipo_produto, parcelas_mcf, parcela_1a_12a, parcela_demais, condicao_pagamento, objetivo, pending_registration_id')
        .eq('proposal_id', proposalId)
        .order('ordem', { ascending: true });

      return { ...(data as any), cartas: cartas || [] };
    },
  });

  const createRegistration = useCreatePendingRegistration();

  const canSubmit = cliente.checklistOk && cliente.docsOk;

  useEffect(() => {
    if (!proposal) return;
    if (!valorCreditoStr && proposal.valor_credito) {
      plano.setValorCreditoStr(numberToBRLInput(Number(proposal.valor_credito)));
    }
    if (!prazo && proposal.prazo_meses) plano.setPrazo(String(proposal.prazo_meses));
    // Carta única: o plano digitado no lançamento já vem preenchido aqui.
    const cartasProp = ((proposal as any)?.cartas || []).filter((c: any) => !c.pending_registration_id);
    if (cartasProp.length === 1) {
      const c0 = cartasProp[0];
      plano.hidratar({
        condicao: c0.condicao_pagamento ?? null,
        parcela1a12: c0.parcela_1a_12a != null ? Number(c0.parcela_1a_12a) : null,
        parcelaDemais: c0.parcela_demais != null ? Number(c0.parcela_demais) : null,
        objetivo: c0.objetivo ?? null,
      });
    }

    // Aproveita telefone/e-mail do contato do negócio, sem sobrescrever o que o operador já digitou
    const contato = (proposal as any)?.crm_deals?.crm_contacts;
    const phone = contato?.phone || '';
    const email = contato?.email || '';
    if (phone) {
      if (!form.getValues('telefone')) form.setValue('telefone', phone);
      if (!form.getValues('telefone_comercial')) form.setValue('telefone_comercial', phone);
    }
    if (email) {
      if (!form.getValues('email')) form.setValue('email', email);
      if (!form.getValues('email_comercial')) form.setValue('email_comercial', email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);

  const cartasPendentes = ((proposal as any)?.cartas || []).filter((c: any) => !c.pending_registration_id);
  const multiCartas = cartasPendentes.length > 1;

  // Plano por carta: cada carta tem parcela própria.
  const [planosPorCarta, setPlanosPorCarta] = useState<Record<string, PlanoPorCarta>>({});
  const [copia, setCopia] = useState<{ seq: number; condicao?: string; objetivo?: string } | null>(null);
  const handlePlanoCarta = useCallback((cartaId: string, valores: PlanoPorCarta) => {
    setPlanosPorCarta(prev => ({ ...prev, [cartaId]: valores }));
  }, []);

  const onSubmit = async () => {
    const data = form.getValues();
    const documents = cliente.documentos();
    const cleanData = cliente.dadosLimpos(data);

    // Uma carta -> um cadastro pendente. Sem cartas (proposta legada), 1 cadastro.
    const alvos: Array<any> = cartasPendentes.length > 0 ? cartasPendentes : [null];

    for (let i = 0; i < alvos.length; i++) {
      const carta = alvos[i];
      // Parcelas que a MCF paga vêm da marcação feita no lançamento da venda.
      const parcelas = derivarParcelasEmpresa(carta?.parcelas_mcf);
      const pc = multiCartas && carta ? planosPorCarta[carta.id] : undefined;
      await createRegistration.mutateAsync({
        carta_id: carta?.id,
        proposal_id: proposalId,
        deal_id: dealId,
        tipo_pessoa: tipoPessoa,
        vendedor_name: vendedorName,
        // Documentos são do cliente: sobem uma única vez, no primeiro cadastro.
        documents: i === 0 ? documents : [],
        empresa_paga_parcelas: parcelas.empresa_paga_parcelas,
        tipo_contrato: parcelas.tipo_contrato,
        parcelas_pagas_empresa: parcelas.parcelas_pagas_empresa,
        // Valor/prazo/produto vêm da CARTA quando existe; senão do bloco do plano.
        valor_credito: carta
          ? Number(carta.valor_credito)
          : (parseBRLInput(valorCreditoStr) || (proposal?.valor_credito ? Number(proposal.valor_credito) : undefined)),
        prazo_meses: carta
          ? Number(carta.prazo_meses)
          : (prazo ? Number(prazo) : (proposal?.prazo_meses ? Number(proposal.prazo_meses) : undefined)),
        // Com várias cartas, o plano é POR CARTA (parcela de 150k ≠ de 200k).
        credito_id: pc?.credito_id ?? plano.valores.credito_id,
        produto_codigo: pc?.produto_codigo ?? produtoDoPlano?.codigo ?? undefined,
        condicao_pagamento: pc?.condicao_pagamento ?? plano.valores.condicao_pagamento,
        parcela_1a_12a: pc?.parcela_1a_12a ?? plano.valores.parcela_1a_12a,
        parcela_demais: pc?.parcela_demais ?? plano.valores.parcela_demais,
        objetivo: pc?.objetivo ?? plano.valores.objetivo,
        inclui_seguro: pc ? pc.inclui_seguro : incluiSeguro,
        // `tipo_produto` decide o produto e a comissão de TODAS as parcelas no
        // "Abrir cota"; `origem` é o crédito da origem do lead.
        tipo_produto: carta?.tipo_produto || (proposal as any)?.tipo_produto || undefined,
        origem: (proposal as any)?.origem_lead || undefined,
        observacoes: proposal?.proposal_details?.trim() || undefined,
        ...cleanData,
      } as any);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Cadastrar Dados da Cota</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados completos do cliente para enviar às Cotas a Fazer.
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* Aviso de unidade: 1 carta = 1 cadastro pendente. */}
            {cartasPendentes.length > 1 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Esta proposta tem {cartasPendentes.length} cartas</p>
                <p className="text-muted-foreground">
                  Serão criados os cadastros pendentes correspondentes, um por carta, com estes dados do cliente:
                </p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {cartasPendentes.map((c: any) => (
                    <li key={c.id}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.valor_credito) || 0)}
                      {' · '}{c.prazo_meses}x{' · '}{c.tipo_produto}
                      {Array.isArray(c.parcelas_mcf) && c.parcelas_mcf.length > 0 && (
                        <> {' · '}MCF paga {c.parcelas_mcf.length} parcela(s)</>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ===== Dados do plano — um bloco POR CARTA quando há mais de uma ===== */}
            {multiCartas ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cada carta tem plano e parcela próprios. Preencha os {cartasPendentes.length} blocos abaixo.
                </p>
                {cartasPendentes.map((c: any, i: number) => (
                  <CartaPlanoBloco
                    key={c.id}
                    carta={c}
                    index={i}
                    total={cartasPendentes.length}
                    onChange={handlePlanoCarta}
                    copia={i > 0 ? copia : null}
                    onRepetir={i === 0 ? d => setCopia({ seq: Date.now(), ...d }) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <h3 className="font-semibold text-sm">Dados do plano</h3>
                <DadosPlanoFields plano={plano} hide={['diaVencimento', 'inicioSegundaParcela']} />
              </div>
            )}

            <TipoPessoaSelect bloco={cliente} />

            <Separator />

            <CloserR1NoteBlock dealId={dealId} />

            <DadosClienteFields bloco={cliente}>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={createRegistration.isPending || !canSubmit}
                  title={
                    !cliente.checklistOk
                      ? 'Preencha todos os campos do checklist antes de enviar'
                      : !cliente.docsOk
                        ? (tipoPessoa === 'pf'
                            ? 'Anexe ao menos 1 documento (CNH/RG) antes de enviar'
                            : 'Anexe Contrato Social, RG dos sócios e Cartão CNPJ antes de enviar')
                        : undefined
                  }
                >
                  {createRegistration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar e Enviar para Cotas a Fazer
                </Button>
              </div>
              {!canSubmit && (
                <p className="text-xs text-destructive text-right">
                  {!cliente.checklistOk
                    ? 'Preencha todos os campos do checklist para habilitar o envio.'
                    : (tipoPessoa === 'pf'
                        ? 'Anexe ao menos 1 documento (CNH/RG) para habilitar o envio.'
                        : 'Anexe Contrato Social, RG dos sócios e Cartão CNPJ para habilitar o envio.')}
                </p>
              )}
            </DadosClienteFields>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
