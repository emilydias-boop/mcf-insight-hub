import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, FileBadge, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRLInput, numberToBRLInput, parseBRLInput } from '@/lib/brlMask';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { TermoMarkdown } from './TermoMarkdown';
import { useTermoModelos, useCreateTermo, termoPublicUrl, type ConsorcioTermo } from '@/hooks/useConsorcioTermos';
import { renderTermo } from '@/lib/consorcioTermo';
import {
  montarDadosComprovante,
  qtdParcelasCronograma,
  validarDadosComprovante,
  valorParcelaDoCard,
  type ComprovanteParcela,
} from '@/lib/consorcioComprovante';

interface GerarComprovanteModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string;
  /** Fecha este modal e abre a cota em edição (para completar dados faltantes). */
  onCompletarCota?: () => void;
}

/** Validade do link do comprovante: 2 anos. Depois é só reemitir pelo painel. */
function expiraEm2Anos() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString();
}

/** Linha do cronograma no modal — carrega id/status para poder gravar na parcela. */
type LinhaCronograma = ComprovanteParcela & { id?: string; status?: string | null };

/** Parcela paga não é sobrescrita: bloqueia edição e avisa na linha. */
const parcelaTravada = (l: LinhaCronograma) => l.status === 'pago';

export function GerarComprovanteModal({ open, onOpenChange, cardId, onCompletarCota }: GerarComprovanteModalProps) {
  const { data: modelos = [], isLoading: loadingModelos } = useTermoModelos(true, 'comprovante_cadastro');
  const createTermo = useCreateTermo();
  const queryClient = useQueryClient();
  const [gerado, setGerado] = useState<ConsorcioTermo | null>(null);
  /**
   * Cronograma editado pelo operador. É neste momento (cota já criada na Embracon)
   * que existem as datas reais e a definição de quem paga cada parcela — então o
   * que for editado aqui é gravado em `consortium_installments`.
   */
  const [linhas, setLinhas] = useState<LinhaCronograma[] | null>(null);
  const [valoresTexto, setValoresTexto] = useState<Record<number, string>>({});
  /** Bloco de completude da cota (contrato, dia de vencimento e valores do plano). */
  const [contrato, setContrato] = useState('');
  const [diaVenc, setDiaVenc] = useState('');
  const [p1a12, setP1a12] = useState('');
  const [pDemais, setPDemais] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['consorcio-card-comprovante', cardId],
    enabled: open && !!cardId,
    queryFn: async () => {
      const [{ data: card, error: e1 }, { data: parcelas, error: e2 }] = await Promise.all([
        supabase.from('consortium_cards').select('*').eq('id', cardId).single(),
        supabase
          .from('consortium_installments')
          .select('id, numero_parcela, data_vencimento, tipo, status')
          .eq('card_id', cardId)
          .lte('numero_parcela', 12)
          .order('numero_parcela'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      // `consortium_cards` não tem coluna deal_id: o vínculo com o negócio vive no
      // cadastro pendente que originou a cota.
      const { data: pend } = await supabase
        .from('consorcio_pending_registrations')
        .select('deal_id')
        .eq('consortium_card_id', cardId)
        .not('deal_id', 'is', null)
        .limit(1)
        .maybeSingle();
      return {
        card: card as any,
        parcelas: (parcelas || []) as unknown as LinhaCronograma[],
        dealId: (pend as any)?.deal_id ?? null,
      };
    },
  });

  useEffect(() => {
    if (!open) {
      setGerado(null);
      setLinhas(null);
      setValoresTexto({});
    }
  }, [open]);

  const modelo = modelos[0];
  const card = data?.card;
  const parcelasBanco = data?.parcelas || [];

  // Semeia os campos do bloco de completude a partir da cota.
  useEffect(() => {
    if (!open || !card) return;
    setContrato(String(card.contrato_embracon || ''));
    setDiaVenc(card.dia_vencimento ? String(card.dia_vencimento) : '');
    setP1a12(card.parcela_1a_12a ? numberToBRLInput(Number(card.parcela_1a_12a)) : '');
    setPDemais(card.parcela_demais ? numberToBRLInput(Number(card.parcela_demais)) : '');
  }, [open, card?.id, card?.contrato_embracon, card?.dia_vencimento, card?.parcela_1a_12a, card?.parcela_demais]);

  // Semeia a tabela editável a partir do banco (vencimento + tipo) e do card (valor).
  // `open` entra nas deps porque o modal fica montado no drawer: sem isso, a segunda
  // abertura não semeava nada (card.id e parcelasBanco.length não mudam) e a tabela sumia.
  useEffect(() => {
    if (!open || !card) return;
    const limite = qtdParcelasCronograma(card);
    const base = [...parcelasBanco]
      .filter((p) => p.numero_parcela <= limite)
      .sort((a, b) => a.numero_parcela - b.numero_parcela)
      .map((p) => ({
        id: p.id,
        status: p.status,
        numero_parcela: p.numero_parcela,
        data_vencimento: p.data_vencimento,
        tipo: p.tipo,
        valor: valorParcelaDoCard(card, p.numero_parcela),
      }));
    setLinhas(base);
    setValoresTexto(Object.fromEntries(base.map((p) => [p.numero_parcela, numberToBRLInput(p.valor)])));
  }, [open, card?.id, parcelasBanco.length]);

  const parcelas = linhas ?? parcelasBanco;

  const atualizarLinha = (numero: number, patch: Partial<LinhaCronograma>) =>
    setLinhas((prev) => (prev || []).map((p) => (p.numero_parcela === numero ? { ...p, ...patch } : p)));

  const faltandoCard = useMemo(() => (card ? validarDadosComprovante(card, parcelas) : []), [card, parcelas]);

  /** Linha sem valor (vazio ou zero) ou sem vencimento não pode virar boleto no documento. */
  const faltandoLinhas = useMemo(() => {
    if (!linhas) return [] as { campo: string; label: string }[];
    const semValor = linhas.filter((p) => !Number(p.valor)).map((p) => `${p.numero_parcela}ª`);
    const semVenc = linhas.filter((p) => !p.data_vencimento).map((p) => `${p.numero_parcela}ª`);
    const out: { campo: string; label: string }[] = [];
    if (semValor.length)
      out.push({ campo: 'linhas_valor', label: `Valor da parcela: ${semValor.join(', ')}` });
    if (semVenc.length)
      out.push({ campo: 'linhas_venc', label: `Vencimento da parcela: ${semVenc.join(', ')}` });
    return out;
  }, [linhas]);

  const faltando = useMemo(() => [...faltandoCard, ...faltandoLinhas], [faltandoCard, faltandoLinhas]);
  const dados = useMemo(() => (card ? montarDadosComprovante(card, parcelas) : null), [card, parcelas]);
  const preview = useMemo(() => (modelo && dados ? renderTermo(modelo.conteudo, dados) : ''), [modelo, dados]);

  const semParcelas = parcelasBanco.length === 0;
  const faltamCamposCota =
    !String(contrato || '').trim() || !Number(diaVenc) || !parseBRLInput(p1a12) || semParcelas;

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['consorcio-card-comprovante', cardId] });
    await queryClient.invalidateQueries({ queryKey: ['consorcio-card-detail', cardId] });
    await queryClient.invalidateQueries({ queryKey: ['consorcio-cards'] });
  };

  /**
   * Grava contrato, dia de vencimento e valores do plano na cota.
   * Nenhum desses campos é observado pelo trigger de webhook de saída do consórcio,
   * então nada é enviado para FinanceHub / MCF Pay / Asaas.
   */
  const salvarDadosCota = async () => {
    const dia = Number(diaVenc);
    if (dia && (dia < 1 || dia > 31)) {
      toast.error('Dia de vencimento deve estar entre 1 e 31');
      return false;
    }
    const { error } = await supabase
      .from('consortium_cards')
      .update({
        contrato_embracon: String(contrato || '').trim() || null,
        dia_vencimento: dia || null,
        parcela_1a_12a: parseBRLInput(p1a12) || null,
        parcela_demais: parseBRLInput(pDemais) || null,
      })
      .eq('id', cardId);
    if (error) {
      toast.error('Erro ao salvar dados da cota: ' + error.message);
      return false;
    }
    return true;
  };

  const handleSalvarCota = async () => {
    setSalvando(true);
    try {
      if (await salvarDadosCota()) {
        await invalidar();
        toast.success('Dados da cota salvos');
      }
    } finally {
      setSalvando(false);
    }
  };

  /** Reaproveita o gerador oficial da cota (`gerarCronogramaSeFaltando`) — não duplica. */
  const handleGerarParcelas = async () => {
    setSalvando(true);
    try {
      if (!(await salvarDadosCota())) return;
      const qtd = await gerarCronogramaSeFaltando(cardId);
      await invalidar();
      toast.success(qtd > 0 ? `${qtd} parcelas geradas` : 'A cota já tinha parcelas geradas');
    } catch (e: any) {
      toast.error('Erro ao gerar parcelas: ' + (e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  /** Grava vencimento e quem paga de cada parcela editável (paga nunca é sobrescrita). */
  const persistirCronograma = async () => {
    const editaveis = (linhas || []).filter((l) => l.id && !parcelaTravada(l));
    for (const l of editaveis) {
      const original = parcelasBanco.find((p) => p.id === l.id);
      if (original && original.data_vencimento === l.data_vencimento && original.tipo === l.tipo) continue;
      const { error } = await supabase
        .from('consortium_installments')
        .update({ data_vencimento: l.data_vencimento, tipo: l.tipo })
        .eq('id', l.id!);
      if (error) throw error;
    }
  };

  const handleSalvarCronograma = async () => {
    setSalvando(true);
    try {
      await persistirCronograma();
      await invalidar();
      toast.success('Cronograma salvo na cota');
    } catch (e: any) {
      toast.error('Erro ao salvar cronograma: ' + (e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(termoPublicUrl(token));
    toast.success('Link copiado');
  };

  const handleGerar = async () => {
    if (!card || !modelo || !dados || faltando.length > 0) return;
    try {
      await persistirCronograma();
    } catch (e: any) {
      toast.error('Erro ao salvar cronograma na cota: ' + (e?.message || e));
      return;
    }
    const termo = await createTermo.mutateAsync({
      tipo: 'comprovante_cadastro',
      cardId: card.id,
      dealId: data?.dealId ?? null,
      modeloId: modelo.id,
      modeloVersao: modelo.versao,
      dados,
      conteudoRenderizado: preview,
      expiresAt: expiraEm2Anos(),
    });
    await invalidar();
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
            Comprova o cadastro da cota na Embracon (grupo, cota e contrato) e mostra o cronograma das primeiras parcelas, indicando quais a MCF paga. É só leitura — o cliente não assina este documento.
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
                  <p className="mt-2">
                    {faltandoCard.length > 0
                      ? 'Complete os dados da cota (inclusive o número do contrato Embracon) e volte aqui.'
                      : 'Preencha as parcelas destacadas no cronograma abaixo para liberar a emissão.'}
                  </p>
                </AlertDescription>
              </Alert>
            )}
            {linhas && linhas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cronograma — confira antes de emitir</Label>
                <p className="text-xs text-muted-foreground">
                  Ajustes aqui valem só para este comprovante. Para mudar a parcela de verdade, use a aba Parcelas da
                  cota.
                </p>
                <div className="rounded-lg border overflow-x-auto max-h-[38vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-medium w-16">#</th>
                        <th className="p-2 text-left font-medium">Vencimento</th>
                        <th className="p-2 text-left font-medium">Valor</th>
                        <th className="p-2 text-left font-medium">Quem paga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((p) => (
                        <tr key={p.numero_parcela} className="border-t">
                          <td className="p-2 text-muted-foreground">{p.numero_parcela}ª</td>
                          <td className="p-2">
                            <Input
                              type="date"
                              className="h-8"
                              value={p.data_vencimento ?? ''}
                              onChange={(e) =>
                                atualizarLinha(p.numero_parcela, { data_vencimento: e.target.value || null })
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-8"
                              inputMode="numeric"
                              value={valoresTexto[p.numero_parcela] ?? ''}
                              onChange={(e) => {
                                const masked = formatBRLInput(e.target.value);
                                setValoresTexto((v) => ({ ...v, [p.numero_parcela]: masked }));
                                atualizarLinha(p.numero_parcela, { valor: parseBRLInput(masked) });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Select
                              value={p.tipo}
                              onValueChange={(v) =>
                                atualizarLinha(p.numero_parcela, { tipo: v as ComprovanteParcela['tipo'] })
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="empresa">MCF Capital</SelectItem>
                                <SelectItem value="cliente">Cliente</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
          {!gerado && faltandoCard.length > 0 && onCompletarCota && (
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
