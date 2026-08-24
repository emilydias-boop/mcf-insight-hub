import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, FileBadge, Loader2, Search, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/consorcioCalculos';
import { FilaDuasListas } from './FilaDuasListas';
import { SeloDiasParados } from './SeloDiasParados';
import { GerarComprovanteModal } from './GerarComprovanteModal';
import {
  useCotasCadastradas,
  useMarcarParcelaInicial,
  prazoExpirado,
  PRAZO_PARCELA_INICIAL_DIAS,
  type CotaCadastrada,
} from '@/hooks/useCotasCadastradas';
import {
  useReversaoStatus,
  useReverterEtapa5Para4,
  useDesfazerParcelaInicial,
  motivoBloqueio,
  MOTIVO_MIN,
} from '@/hooks/useConsorcioReversaoEtapa';

type Reversao = { cota: CotaCadastrada; modo: '5-4' | '6-5' };


const fmtData = (d?: string | null) =>
  d ? format(new Date(d.length <= 10 ? `${d}T00:00:00` : d), 'dd/MM/yyyy') : '—';

const hojeYmd = () => format(new Date(), 'yyyy-MM-dd');

/**
 * Etapa 5 — "Cotas Cadastradas".
 *
 * Cotas com grupo/cota preenchidos, separadas em duas listas: aguardando o
 * pagamento da parcela inicial × pagas. O marcador é CONTROLE INTERNO da equipe
 * de cadastro/cobranças: não gera lançamento financeiro, cobrança, título nem
 * saída para o FinanceHub, e não toca `parcelas_pagas_empresa` do card.
 *
 * "Não paga" não é ação: é estado derivado (passou o prazo sem pagamento).
 * O Comprovante de Adesão emitido aqui é a verdade oficial sobre quais parcelas
 * a MCF paga — ele já vem pré-preenchido com a intenção marcada no lançamento.
 */
export function CotasCadastradasTab({ range }: { range: { startDate?: Date; endDate?: Date } }) {
  const { data: cotas = [], isLoading } = useCotasCadastradas(range);
  const marcar = useMarcarParcelaInicial();
  const reverter54 = useReverterEtapa5Para4();
  const desfazer65 = useDesfazerParcelaInicial();

  const [alvo, setAlvo] = useState<CotaCadastrada | null>(null);
  const [dataPagamento, setDataPagamento] = useState(hojeYmd());
  const [comprovanteCardId, setComprovanteCardId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [reversao, setReversao] = useState<Reversao | null>(null);
  const [motivo, setMotivo] = useState('');

  const { data: statusPorRegistro = {} } = useReversaoStatus(cotas.map((c) => c.id));


  // Busca por nome, CPF/CNPJ, grupo e cota — casa em QUALQUER um dos campos.
  // Regra dos dígitos: só busca por documento/grupo/cota por dígitos quando o
  // termo é numérico (aceitando . - / e espaço) e tem 3+ dígitos. Antes, um termo
  // como "QA2" virava dígito "2" e casava com quase toda a base pelo CPF, sem
  // que o operador percebesse. Só filtra exibição: não altera nenhum cálculo.
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return cotas;
    const digitos = termo.replace(/\D/g, '');
    const termoNumerico = /^[\d.\-/\s]+$/.test(termo) && digitos.length >= 3;
    return cotas.filter((c) => {
      const doc = String(c.documento || '').replace(/\D/g, '');
      return (
        String(c.nome || '').toLowerCase().includes(termo) ||
        String(c.grupo || '').toLowerCase().includes(termo) ||
        String(c.cota || '').toLowerCase().includes(termo) ||
        (termoNumerico && (doc.includes(digitos) ||
          String(c.grupo || '').includes(digitos) ||
          String(c.cota || '').includes(digitos)))
      );
    });
  }, [cotas, busca]);

  const aguardando = useMemo(
    () =>
      filtradas
        .filter((c) => !c.parcela_inicial_paga_em)
        .sort((a, b) => (a.cadastrada_em || '').localeCompare(b.cadastrada_em || '')),
    [filtradas],
  );
  const pagas = useMemo(
    () =>
      filtradas
        .filter((c) => !!c.parcela_inicial_paga_em)
        .sort((a, b) => (b.parcela_inicial_paga_em || '').localeCompare(a.parcela_inicial_paga_em || '')),
    [filtradas],
  );
  const expiradas = useMemo(() => aguardando.filter(prazoExpirado).length, [aguardando]);

  const abrirConfirm = (c: CotaCadastrada) => {
    setDataPagamento(hojeYmd());
    setAlvo(c);
  };

  const confirmar = async () => {
    if (!alvo) return;
    await marcar.mutateAsync({ id: alvo.id, data: dataPagamento });
    setAlvo(null);
  };

  const abrirReversao = (cota: CotaCadastrada, modo: '5-4' | '6-5') => {
    setMotivo('');
    setReversao({ cota, modo });
  };

  const confirmarReversao = async () => {
    if (!reversao) return;
    const args = { registroId: reversao.cota.id, motivo: motivo.trim() };
    if (reversao.modo === '5-4') await reverter54.mutateAsync(args);
    else await desfazer65.mutateAsync(args);
    setReversao(null);
    setMotivo('');
  };

  const revertendo = reverter54.isPending || desfazer65.isPending;

  const renderTabela = (linhas: CotaCadastrada[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead className="text-center">Grupo / Cota</TableHead>
          <TableHead className="text-right">Valor do Crédito</TableHead>
          <TableHead>Cadastrada em</TableHead>
          <TableHead className="text-center">Parcela inicial</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((c) => {
          const paga = !!c.parcela_inicial_paga_em;
          const st = statusPorRegistro[c.id];
          const bloqueio = motivoBloqueio(st, paga ? '6-5' : '5-4');

          return (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{c.nome}</span>
                  {!paga && <SeloDiasParados desde={c.cadastrada_em} motivo="Contado desde o cadastro da cota na Embracon." />}
                  {!paga && prazoExpirado(c) && (
                    <Badge variant="outline" className="border-destructive/60 bg-destructive/10 text-[10px] text-destructive">
                      não paga — prazo expirado
                    </Badge>
                  )}
                  {/* Aviso só quando o evento consorcio.venda.criada está `sent`.
                      Evento `failed` ou inexistente não gera alarme. */}
                  {st?.dash_anunciado && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/60 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                      title="Se esta venda voltar de etapa, o Dash continuará com ela — reconcilie manualmente."
                    >
                      já anunciada ao Dash — reconciliar
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center whitespace-nowrap">
                {c.grupo || '—'} / {c.cota || '—'}
              </TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(c.valor_credito || 0)}</TableCell>
              <TableCell className="whitespace-nowrap">{fmtData(c.cadastrada_em)}</TableCell>
              <TableCell className="text-center whitespace-nowrap">
                {paga ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {fmtData(c.parcela_inicial_paga_em)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">aguardando</span>
                )}
              </TableCell>
              <TableCell>{c.vendedor_name || '—'}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {c.consortium_card_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setComprovanteCardId(c.consortium_card_id!)}
                      title="Comprovante de Adesão — confirma oficialmente quais parcelas a MCF paga"
                    >
                      <FileBadge className="mr-1 h-3.5 w-3.5" /> Comprovante
                    </Button>
                  )}
                  {/* Botão que some sem explicar não passa: quando há bloqueio, o
                      motivo aparece escrito no lugar do botão. */}
                  {bloqueio ? (
                    <span className="max-w-[15rem] text-right text-[11px] leading-tight text-muted-foreground">
                      {bloqueio}
                    </span>
                  ) : paga ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => abrirReversao(c, '6-5')}
                      disabled={revertendo}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Desfazer parcela inicial
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => abrirConfirm(c)}>
                        Parcela inicial paga
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => abrirReversao(c, '5-4')}
                        disabled={revertendo}
                        title="Devolve o cadastro para Cotas a Fazer. A cota não é apagada."
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Voltar p/ Cotas a Fazer
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );


  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Cotas Cadastradas ({busca.trim() ? `${filtradas.length} de ${cotas.length}` : cotas.length})
          </CardTitle>
          {expiradas > 0 && (
            <Badge variant="outline" className="border-destructive/60 bg-destructive/10 text-destructive">
              {expiradas} com prazo expirado
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Cotas com grupo e cota já cadastrados na Embracon. O registro da parcela inicial é{' '}
          <strong>controle interno</strong> da equipe de cadastro — não gera cobrança, título nem lançamento
          financeiro. O prazo é de {PRAZO_PARCELA_INICIAL_DIAS} dia após o cadastro; passando dele sem pagamento, o
          selo <em>não paga</em> aparece sozinho.
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, CPF/CNPJ, grupo ou cota…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <FilaDuasListas
            pendentes={aguardando}
            tratadas={pagas}
            renderTabela={renderTabela}
            tituloPendentes="Aguardando pagamento da parcela inicial"
            tituloTratadas="Parcela inicial paga"
            descricaoPendentes="mais paradas primeiro"
            vazioPendentes="Nenhuma cota aguardando o pagamento da parcela inicial."
            vazioTratadas="Nenhum pagamento registrado no período."
          />
        )}
      </CardContent>

      <Dialog open={!!alvo} onOpenChange={(v) => !v && setAlvo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Parcela inicial paga</DialogTitle>
            <DialogDescription>
              {alvo?.nome} — grupo {alvo?.grupo} / cota {alvo?.cota}. Ao confirmar, a cota é convertida em{' '}
              <strong>contratação</strong> com esta data e passa a aparecer na etapa <strong>Cotas</strong>. Nada é
              cobrado nem lançado no financeiro.
            </DialogDescription>

          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="pi-data">Data do pagamento</Label>
            <Input
              id="pi-data"
              type="date"
              value={dataPagamento}
              max={hojeYmd()}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAlvo(null)}>Cancelar</Button>
            <Button disabled={!dataPagamento || marcar.isPending} onClick={confirmar}>
              {marcar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reversao} onOpenChange={(v) => !v && (setReversao(null), setMotivo(''))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reversao?.modo === '5-4' ? 'Voltar para Cotas a Fazer' : 'Desfazer parcela inicial'}
            </DialogTitle>
            <DialogDescription>
              {reversao?.cota.nome} — grupo {reversao?.cota.grupo || '—'} / cota {reversao?.cota.cota || '—'}.
              {reversao?.modo === '5-4' ? (
                <>
                  {' '}O cadastro volta para <strong>Cotas a Fazer</strong>. A cota <strong>não é apagada</strong>: fica
                  viva, marcada como revertida e fora do funil. Nenhuma cobrança, comissão ou webhook é enviado ou
                  cancelado.
                </>
              ) : (
                <>
                  {' '}A cota volta para <strong>reserva</strong> e sai da etapa <strong>Cotas</strong>. Nada é cobrado,
                  cancelado ou enviado para fora.
                </>
              )}
              {statusPorRegistro[reversao?.cota.id || '']?.dash_anunciado && (
                <>
                  {' '}Atenção: esta venda <strong>já foi anunciada ao Dash</strong> — depois de voltar, reconcilie por
                  lá manualmente.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="rev-motivo">Motivo (obrigatório, mínimo {MOTIVO_MIN} caracteres)</Label>
            <Textarea
              id="rev-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cota lançada no grupo errado, será cadastrada novamente"
            />
            <p className="text-xs text-muted-foreground">
              Fica registrado quem voltou, quando e de qual etapa para qual. {motivo.trim().length}/{MOTIVO_MIN}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReversao(null); setMotivo(''); }}>Cancelar</Button>
            <Button disabled={motivo.trim().length < MOTIVO_MIN || revertendo} onClick={confirmarReversao}>
              {revertendo && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {comprovanteCardId && (
        <GerarComprovanteModal
          open={!!comprovanteCardId}
          onOpenChange={(v) => !v && setComprovanteCardId(null)}
          cardId={comprovanteCardId}
        />
      )}
    </Card>
  );
}
