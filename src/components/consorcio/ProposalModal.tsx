import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEnviarProposta } from '@/hooks/useConsorcioPostMeeting';
import { useCreatePendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';
import { replicarDocumentosDaVenda } from '@/lib/consorcioDocumentReplication';

import { useConsorcioTipoOptions, useConsorcioOrigemOptions } from '@/hooks/useConsorcioConfigOptions';
import { CartasProposalEditor } from './CartasProposalEditor';
import { DadosClienteFields, TipoPessoaSelect, useDadosCliente } from './DadosClienteBloco';
import {
  PropostaCartaDraft, cartaDraftValida, draftsParaInput, novaCartaDraft,
  derivarParcelasEmpresa,
} from '@/types/consorcioCartas';
import { CONSORCIO_LABELS } from '@/lib/consorcioLabels';

interface ProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  contactName: string;
  originId: string;
  /** Nome de quem vendeu — usado quando o bloco cadastral é preenchido aqui. */
  vendedorName?: string;
}

/**
 * Lançamento da venda em UM formulário (decisão do dono):
 *  - Bloco 1 (obrigatório): cartas, marcação das parcelas MCF, detalhes, origem.
 *  - Bloco 2 (opcional): dados cadastrais do cliente + documentos. Se ficar
 *    incompleto, a venda vai para Termos de Adesão Pendentes (etapa 3) — só
 *    chega em Cotas a Fazer (etapa 4) depois do termo assinado; o que ficou em
 *    branco aqui aparece lá como pendência de cadastro, com selo de dias parados.
 */
export function ProposalModal({
  open, onOpenChange, dealId, dealName, contactName, originId, vendedorName,
}: ProposalModalProps) {
  const [details, setDetails] = useState('');
  const [origemLead, setOrigemLead] = useState('');
  const [cartas, setCartas] = useState<PropostaCartaDraft[]>([novaCartaDraft()]);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const enviarProposta = useEnviarProposta();
  const createRegistration = useCreatePendingRegistration();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();
  const cliente = useDadosCliente({ nomeInicial: contactName });

  const origemList = origemLead && !origemOptions.some(o => o.name === origemLead)
    ? [...origemOptions.map(o => ({ name: o.name, label: o.label })), { name: origemLead, label: `${origemLead} (legado)` }]
    : origemOptions.map(o => ({ name: o.name, label: o.label }));

  const tudoValido = cartas.length > 0 && cartas.every(cartaDraftValida);

  const resetar = () => {
    setDetails(''); setOrigemLead(''); setCartas([novaCartaDraft()]);
    setMostrarErros(false); setCadastroAberto(false);
  };

  const handleSubmit = async () => {
    if (!tudoValido) { setMostrarErros(true); return; }
    setSalvando(true);
    try {
      const resultado = await enviarProposta.mutateAsync({
        deal_id: dealId,
        origin_id: originId,
        proposal_details: details,
        cartas: draftsParaInput(cartas),
        origem_lead: origemLead || undefined,
      });

      // Bloco 2: só cria cadastro pendente se a pessoa preencheu alguma coisa.
      if (cliente.algumCampoPreenchido) {
        const dados = cliente.dadosLimpos(cliente.form.getValues());
        const docs = cliente.documentos();
        const alvos = resultado.cartas.length > 0 ? resultado.cartas : [null];
        for (let idx = 0; idx < alvos.length; idx++) {
          const carta = alvos[idx];
          const parcelas = derivarParcelasEmpresa(carta?.parcelas_mcf);
          await createRegistration.mutateAsync({
            carta_id: carta?.id,
            proposal_id: resultado.proposal_id,
            deal_id: dealId,
            tipo_pessoa: cliente.tipoPessoa,
            vendedor_name: vendedorName || '',
            // Documento é do cliente e vale para a venda inteira: sobe uma vez
            // (no primeiro cadastro) e depois é replicado para as cartas irmãs
            // sem reupload do binário.
            documents: idx === 0 ? docs : [],
            empresa_paga_parcelas: parcelas.empresa_paga_parcelas,
            tipo_contrato: parcelas.tipo_contrato,
            parcelas_pagas_empresa: parcelas.parcelas_pagas_empresa,
            valor_credito: carta ? Number(carta.valor_credito) : undefined,
            prazo_meses: carta ? Number(carta.prazo_meses) : undefined,
            tipo_produto: carta?.tipo_produto || undefined,
            // Dados do plano nascem na carta e descem para o cadastro.
            parcela_1a_12a: carta?.parcela_1a_12a ?? undefined,
            parcela_demais: carta?.parcela_demais ?? undefined,
            condicao_pagamento: carta?.condicao_pagamento || undefined,
            objetivo: carta?.objetivo || undefined,
            categoria: carta?.categoria || undefined,
            origem: origemLead || undefined,
            observacoes: details.trim() || undefined,
            ...dados,
          } as any);
        }
        // Replica a linha do documento para todos os cadastros da venda.
        await replicarDocumentosDaVenda(resultado.proposal_id);

        if (!cliente.checklistOk || !cliente.docsOk) {
          toast.warning(
            `Venda lançada e em ${CONSORCIO_LABELS.termosPendentes}, aguardando a assinatura do termo. O cadastro incompleto ficará marcado como pendência quando ela chegar em ${CONSORCIO_LABELS.cotasAFazer}.`,
          );
        }
      } else {
        toast.info(
          `Venda lançada sem os dados cadastrais — está em ${CONSORCIO_LABELS.termosPendentes}; complete os dados lá ou depois, em ${CONSORCIO_LABELS.cotasAFazer}.`,
        );
      }

      onOpenChange(false);
      resetar();
    } catch {
      // Os hooks já mostram o erro em toast; mantém o modal aberto para correção.
    } finally {
      setSalvando(false);
    }
  };

  const pendencias = cliente.algumCampoPreenchido && (!cliente.checklistOk || !cliente.docsOk);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{CONSORCIO_LABELS.lancarVenda}</DialogTitle>
          <DialogDescription>
            {contactName} — {dealName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ===== Bloco 1 — comercial (obrigatório) ===== */}
          <div className="space-y-4 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">1. Dados da venda</h3>
            <CartasProposalEditor
              cartas={cartas}
              onChange={setCartas}
              tipoOptions={tipoOptions.map(o => ({ name: o.name, label: o.label }))}
              mostrarErros={mostrarErros}
            />
            <div>
              <Label>Detalhes da Proposta</Label>
              <Textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Descrição da proposta..." rows={3} />
            </div>
            <div>
              <Label>Origem do Lead</Label>
              <Select value={origemLead} onValueChange={setOrigemLead}>
                <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                <SelectContent>
                  {origemList.map(o => (
                    <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ===== Bloco 2 — cadastral (opcional) ===== */}
          <Collapsible open={cadastroAberto} onOpenChange={setCadastroAberto}>
            <div className="rounded-lg border p-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-2 text-left">
                  <div>
                    <h3 className="text-sm font-semibold">
                      2. Dados cadastrais do cliente <span className="font-normal text-muted-foreground">(opcional)</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      A venda entra em {CONSORCIO_LABELS.termosPendentes}. Depois do termo assinado ela vai
                      para {CONSORCIO_LABELS.cotasAFazer}, e o que ficar em branco aqui aparece lá como
                      pendência de cadastro, com selo de dias parados.
                    </p>
                  </div>
                  {cadastroAberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4">
                <TipoPessoaSelect bloco={cliente} />
                <DadosClienteFields bloco={cliente} />
              </CollapsibleContent>
            </div>
          </Collapsible>

          {pendencias && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              O cadastro está incompleto. A venda será lançada e ficará em {CONSORCIO_LABELS.termosPendentes};
              após a assinatura do termo, entra em {CONSORCIO_LABELS.cotasAFazer} com a pendência de cadastro
              sinalizada.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {salvando ? 'Lançando...' : CONSORCIO_LABELS.lancarVenda}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
