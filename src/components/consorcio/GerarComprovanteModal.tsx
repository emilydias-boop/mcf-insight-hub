import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
import { gerarCronogramaSeFaltando } from '@/lib/consorcioCronograma';


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
      toast.success(qtd > 0 ? `Cronograma gerado: ${qtd} primeiras parcelas` : 'A cota já tinha parcelas geradas');
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
      {/* Altura limitada à viewport, corpo rolando por dentro e rodapé fixo: com o
          cronograma de 12 linhas aberto o botão de emitir precisa continuar visível. */}
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">
        <div className="shrink-0 px-6 pt-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBadge className="h-5 w-5" /> Gerar Comprovante de Cadastro
          </DialogTitle>
          <DialogDescription>
            Comprova o cadastro da cota na Embracon (grupo, cota e contrato) e mostra o cronograma das primeiras parcelas, indicando quais a MCF paga. É só leitura — o cliente não assina este documento.
          </DialogDescription>
        </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">


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
            {faltamCamposCota && (
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Completar dados da cota</Label>
                  <p className="text-xs text-muted-foreground">
                    A cota já existe na Embracon: é agora que o contrato, o dia de vencimento e os valores do plano são
                    conhecidos. O que você preencher aqui é gravado na cota.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Nº do contrato Embracon{' '}
                      {!String(contrato || '').trim() && <span className="text-amber-600">* obrigatório para emitir</span>}
                    </Label>
                    <Input className="h-9" value={contrato} onChange={(e) => setContrato(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Dia de vencimento (1–31){' '}
                      {!Number(diaVenc) && <span className="text-amber-600">* obrigatório para emitir</span>}
                    </Label>
                    <Input
                      className="h-9"
                      inputMode="numeric"
                      value={diaVenc}
                      onChange={(e) => setDiaVenc(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Parcela 1ª à 12ª{' '}
                      {!parseBRLInput(p1a12) && <span className="text-amber-600">* obrigatório para emitir</span>}
                    </Label>
                    <Input
                      className="h-9"
                      inputMode="numeric"
                      value={p1a12}
                      onChange={(e) => setP1a12(formatBRLInput(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Demais parcelas</Label>
                    <Input
                      className="h-9"
                      inputMode="numeric"
                      value={pDemais}
                      onChange={(e) => setPDemais(formatBRLInput(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleSalvarCota} disabled={salvando}>
                    {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Salvar dados da cota
                  </Button>
                  {semParcelas && (
                    <Button size="sm" onClick={handleGerarParcelas} disabled={salvando || !Number(diaVenc)}>
                      {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Gerar as 12 primeiras parcelas
                    </Button>
                  )}
                </div>
                {semParcelas && !Number(diaVenc) && (
                  <p className="text-xs text-muted-foreground">
                    Informe o dia de vencimento para liberar a geração das parcelas.
                  </p>
                )}
              </div>
            )}

            {linhas && linhas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cronograma da cota</Label>
                <p className="text-xs text-muted-foreground">
                  O que você editar aqui altera a cota: vencimento e quem paga são gravados na parcela. Parcelas já
                  pagas ficam bloqueadas.
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
                      {linhas.map((p) => {
                        const travada = parcelaTravada(p);
                        const semValor = !travada && !Number(p.valor);
                        const semVenc = !travada && !p.data_vencimento;
                        return (
                        <tr key={p.numero_parcela} className="border-t">
                          <td className="p-2 text-muted-foreground">
                            {p.numero_parcela}ª
                            {travada && <span className="block text-[10px] text-amber-600">paga — bloqueada</span>}
                          </td>
                          <td className="p-2">
                            <Input
                              type="date"
                              className="h-8"
                              disabled={travada}
                              value={p.data_vencimento ?? ''}
                              onChange={(e) =>
                                atualizarLinha(p.numero_parcela, { data_vencimento: e.target.value || null })
                              }
                            />
                            {semVenc && <span className="block text-[10px] text-amber-600 mt-0.5">obrigatório</span>}
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-8"
                              inputMode="numeric"
                              disabled={travada}
                              value={valoresTexto[p.numero_parcela] ?? ''}
                              onChange={(e) => {
                                const masked = formatBRLInput(e.target.value);
                                setValoresTexto((v) => ({ ...v, [p.numero_parcela]: masked }));
                                atualizarLinha(p.numero_parcela, { valor: parseBRLInput(masked) });
                              }}
                            />
                            {semValor && <span className="block text-[10px] text-amber-600 mt-0.5">obrigatório</span>}
                          </td>
                          <td className="p-2">
                            <Select
                              value={p.tipo}
                              disabled={travada}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleSalvarCronograma} disabled={salvando}>
                    {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Salvar cronograma na cota
                  </Button>
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
            <Button variant="ghost" onClick={onCompletarCota}>
              Abrir cota completa
            </Button>
          )}

          {!gerado && modelo && (
            <span
              title={
                faltando.length > 0
                  ? 'Falta: ' + faltando.map((f) => f.label).join('; ')
                  : 'Gerar comprovante e link público'
              }
            >
              <Button onClick={handleGerar} disabled={faltando.length > 0 || createTermo.isPending}>
                {createTermo.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Gerar comprovante e link
              </Button>
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
