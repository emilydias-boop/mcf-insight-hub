import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileSignature, Lock, Pencil, ShieldAlert } from 'lucide-react';
import { PRAZO_OPTIONS } from '@/types/consorcioProdutos';
import { useEditarProposta } from '@/hooks/useConsorcioPostMeeting';
import { useConsorcioTipoOptions } from '@/hooks/useConsorcioConfigOptions';
import { numberToBRLInput } from '@/lib/brlMask';
import { CartasProposalEditor } from './CartasProposalEditor';
import { OpenCotaModal } from './OpenCotaModal';
import { GerarTermoModal } from './GerarTermoModal';
import { useAuth } from '@/contexts/AuthContext';
import { useCadastrosDaVenda } from '@/hooks/useConsorcioCadastrosDaVenda';
import { useCancelTermo, type ConsorcioTermo } from '@/hooks/useConsorcioTermos';
import { usePropagarDadosCliente } from '@/hooks/useConsorcioCadastrosDaVenda';
import { agruparPorPessoa, filtrarCamposCliente } from '@/lib/consorcioCamposCliente';
import { toast } from 'sonner';
import {
  PropostaCarta, PropostaCartaDraft, cartaDraftValida, draftsParaInput, novaCartaDraft,
  normalizarParcelasMcf,
} from '@/types/consorcioCartas';


interface EditProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  contactName: string;
  dealName: string;
  /** Cartas atuais da proposta. Propostas legadas têm a carta espelho do backfill. */
  initialCartas?: PropostaCarta[];
  /** Fallback quando a proposta ainda não tem cartas. */
  initialValorCredito: number;
  initialPrazoMeses: number;
  initialTipoProduto: string;
  initialDetails: string;
  initialOrigemLead?: string;
  /** Termos de adesão da venda (mais recente primeiro). Define a trava desta tela. */
  termos?: ConsorcioTermo[];
}

function cartasParaDrafts(
  cartas: PropostaCarta[] | undefined,
  fallback: { valor: number; prazo: number; tipo: string },
): PropostaCartaDraft[] {
  const base = (cartas && cartas.length > 0)
    ? cartas
    : [{
        id: undefined as any, proposal_id: '', ordem: 1,
        valor_credito: fallback.valor, prazo_meses: fallback.prazo, tipo_produto: fallback.tipo,
        parcelas_mcf: null, categoria: null,
        pending_registration_id: null, consortium_card_id: null,
      } as PropostaCarta];

  return base.map((c, i) => ({
    key: c.id || `fallback-${i}`,
    id: c.id || undefined,
    valorStr: c.valor_credito ? numberToBRLInput(c.valor_credito) : '',
    prazoMeses: c.prazo_meses ? String(c.prazo_meses) : '',
    prazoOutro: !!c.prazo_meses && !PRAZO_OPTIONS.some(o => o.value === Number(c.prazo_meses)),
    tipoProduto: c.tipo_produto || '',
    parcelasMcf: normalizarParcelasMcf(c.parcelas_mcf),
    parcela1a12Str: c.parcela_1a_12a ? numberToBRLInput(Number(c.parcela_1a_12a)) : '',
    parcelaDemaisStr: c.parcela_demais ? numberToBRLInput(Number(c.parcela_demais)) : '',
    condicaoPagamento: c.condicao_pagamento || '',
    objetivo: c.objetivo || '',
    categoria: c.categoria || '',
    travada: !!(c.pending_registration_id || c.consortium_card_id),
  }));
}

const fmtData = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export function EditProposalModal({
  open, onOpenChange, proposalId, contactName, dealName,
  initialCartas, initialValorCredito, initialPrazoMeses, initialTipoProduto,
  initialDetails, initialOrigemLead, termos = [],
}: EditProposalModalProps) {
  const [cartas, setCartas] = useState<PropostaCartaDraft[]>([novaCartaDraft()]);
  const [details, setDetails] = useState('');
  const [origemLead, setOrigemLead] = useState('');
  const [mostrarErros, setMostrarErros] = useState(false);
  const editar = useEditarProposta();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { hasAnyRole } = useAuth();
  const { data: cadastros = [] } = useCadastrosDaVenda(open ? proposalId : null);
  const cancelarTermo = useCancelTermo();

  // Estado do termo — decide tudo nesta tela.
  const termoAssinado = useMemo(() => termos.find(t => t.status === 'assinado') || null, [termos]);
  const termoPendente = useMemo(
    () => (termoAssinado ? null : termos.find(t => t.status === 'pendente') || null),
    [termos, termoAssinado],
  );

  // A RLS de `consorcio_pending_registrations` só permite UPDATE para
  // admin/manager/coordenador. Sem o papel, o bloco fica em LEITURA — nunca um
  // botão que promete e falha no banco.
  // Espelha exatamente a policy de UPDATE de consorcio_pending_registrations.
  const podeEditarCliente =
    hasAnyRole('admin', 'manager', 'coordenador', 'closer', 'cobranca_consorcio') && !termoAssinado;

  /** Uma linha por PESSOA (documento), não por carta. */
  const grupos = useMemo(() => agruparPorPessoa(cadastros as any[]), [cadastros]);
  const [editandoGrupo, setEditandoGrupo] = useState<string | null>(null);
  const grupoEmEdicao = useMemo(
    () => grupos.find(g => g.chave === editandoGrupo) || null,
    [grupos, editandoGrupo],
  );
  const propagar = usePropagarDadosCliente();
  const [clienteAlterado, setClienteAlterado] = useState(false);
  const [gerarNovoTermo, setGerarNovoTermo] = useState(false);

  useEffect(() => {
    if (open) {
      setCartas(cartasParaDrafts(initialCartas, {
        valor: initialValorCredito, prazo: initialPrazoMeses, tipo: initialTipoProduto,
      }));
      setDetails(initialDetails || '');
      setOrigemLead(initialOrigemLead || '');
      setMostrarErros(false);
      setClienteAlterado(false);
      setEditandoGrupo(null);
      setGerarNovoTermo(false);
    }
  }, [open, initialCartas, initialValorCredito, initialPrazoMeses, initialTipoProduto, initialDetails, initialOrigemLead]);

  const tudoValido = cartas.length > 0 && cartas.every(cartaDraftValida);

  const handleSubmit = () => {
    if (termoAssinado) return; // trava dura: nada muda com termo assinado
    if (!tudoValido) { setMostrarErros(true); return; }
    editar.mutate({
      proposal_id: proposalId,
      cartas: draftsParaInput(cartas),
      proposal_details: details,
      origem_lead: origemLead.trim() || undefined,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  /** Cancela o termo pendente e abre a geração do novo — sempre por clique. */
  const handleCancelarEGerar = async () => {
    if (!termoPendente) return;
    await cancelarTermo.mutateAsync({
      termoId: termoPendente.id,
      motivo: 'Dados do cliente corrigidos antes da assinatura',
    });
    setGerarNovoTermo(true);
  };

  const nomeCadastro = (r: any) =>
    (r.tipo_pessoa === 'pj' ? r.razao_social : r.nome_completo) || 'sem nome';
  const docCadastro = (r: any) => (r.tipo_pessoa === 'pj' ? r.cnpj : r.cpf) || 'sem documento';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{termoAssinado ? 'Proposta (somente leitura)' : 'Editar Proposta'}</DialogTitle>
            <DialogDescription>
              {contactName} — {dealName}
            </DialogDescription>
          </DialogHeader>

          {termoAssinado && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>
                Termo assinado em {fmtData(termoAssinado.assinado_em)} — dados travados
              </AlertTitle>
              <AlertDescription>
                O documento assinado pelo cliente é a verdade da venda. Cartas e dados do cliente
                ficam em leitura para não divergirem do que foi assinado.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {termoAssinado ? (
              <div className="rounded-lg border divide-y">
                {cartas.map((c, i) => (
                  <div key={c.key} className="p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                    <span className="font-medium">Carta {i + 1}</span>
                    <span>{c.valorStr ? `R$ ${c.valorStr}` : '—'}</span>
                    <span className="text-muted-foreground">{c.prazoMeses || '—'} meses</span>
                    <span className="text-muted-foreground">{c.tipoProduto || '—'}</span>
                    {c.condicaoPagamento && (
                      <span className="text-muted-foreground">{c.condicaoPagamento}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <CartasProposalEditor
                cartas={cartas}
                onChange={setCartas}
                tipoOptions={tipoOptions.map(o => ({ name: o.name, label: o.label }))}
                mostrarErros={mostrarErros}
              />
            )}

            {/* ── Bloco Dados do cliente ─────────────────────────────── */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Dados do cliente</h4>
                {grupos.length > 1 && (
                  <Badge variant="outline">{grupos.length} clientes nesta venda</Badge>
                )}
              </div>

              {termoPendente && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>O termo já enviado tem os dados antigos</AlertTitle>
                  <AlertDescription>
                    O documento que o cliente recebeu é uma cópia congelada dos dados. Corrigir
                    aqui NÃO muda o termo, e a assinatura confere nome e CPF contra a cópia antiga.
                    Depois de corrigir, cancele o termo pendente e gere um novo — o envio ao cliente
                    continua manual.
                  </AlertDescription>
                </Alert>
              )}

              {!podeEditarCliente && !termoAssinado && (
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Somente leitura</AlertTitle>
                  <AlertDescription>
                    Editar dados de cliente é permitido a admin, gestor e coordenador. Peça a
                    correção a quem tem esse papel.
                  </AlertDescription>
                </Alert>
              )}

              {grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta venda ainda não tem cadastro de cliente.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {grupos.map((g) => {
                    const primeiro: any = g.cadastros[0];
                    return (
                      <div key={g.chave} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{nomeCadastro(primeiro)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {primeiro.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'} {docCadastro(primeiro)}
                            {' · '}
                            {g.cadastros.length === 1 ? '1 carta' : `${g.cadastros.length} cartas`}
                          </p>
                        </div>
                        {podeEditarCliente && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditandoGrupo(g.chave)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar dados
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {clienteAlterado && termoPendente && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3">
                  <p className="text-sm flex-1">
                    Dados alterados. O termo pendente continua com os dados antigos.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleCancelarEGerar}
                    disabled={cancelarTermo.isPending}
                  >
                    <FileSignature className="h-3.5 w-3.5 mr-1" /> Cancelar termo e gerar novo
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label>Detalhes da Proposta</Label>
              <Textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={3}
                disabled={!!termoAssinado}
              />
            </div>
            <div>
              <Label>Origem do Lead</Label>
              <Input
                type="text"
                value={origemLead}
                onChange={e => setOrigemLead(e.target.value)}
                placeholder="Ex: Indicação, Instagram, Parceiro João..."
                disabled={!!termoAssinado}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {termoAssinado ? 'Fechar' : 'Cancelar'}
            </Button>
            {!termoAssinado && (
              <Button onClick={handleSubmit} disabled={editar.isPending}>
                {editar.isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reuso do formulário completo (etapa 4): nenhum campo novo. */}
      {grupoEmEdicao && (
        <OpenCotaModal
          open={!!grupoEmEdicao}
          onOpenChange={o => !o && setEditandoGrupo(null)}
          registrationId={grupoEmEdicao.cadastros[0].id}
          mode="edit"
          startEditing
          onSaved={async (patch) => {
            const grupo = grupoEmEdicao;
            setEditandoGrupo(null);
            const campos = filtrarCamposCliente(patch);
            if (Object.keys(campos).length === 0) return;
            setClienteAlterado(true);
            const irmaos = grupo.cadastros.slice(1).map((r) => r.id);
            if (irmaos.length === 0) return;
            // Propaga SÓ campos da pessoa; nada da carta (crédito, plano, grupo, cota...).
            await propagar.mutateAsync({ ids: irmaos, patch: campos });
            toast.success(`Dados atualizados nas ${grupo.cadastros.length} cartas deste cliente.`);
          }}
        />
      )}

      {/* Geração do novo termo: sempre por clique, nunca disparo automático. */}
      {gerarNovoTermo && (
        <GerarTermoModal
          open={gerarNovoTermo}
          onOpenChange={o => !o && setGerarNovoTermo(false)}
          proposalId={proposalId}
        />
      )}
    </>
  );
}
