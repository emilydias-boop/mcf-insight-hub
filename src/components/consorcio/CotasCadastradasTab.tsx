import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, FileBadge, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const [alvo, setAlvo] = useState<CotaCadastrada | null>(null);
  const [dataPagamento, setDataPagamento] = useState(hojeYmd());
  const [comprovanteCardId, setComprovanteCardId] = useState<string | null>(null);

  const aguardando = useMemo(
    () =>
      cotas
        .filter((c) => !c.parcela_inicial_paga_em)
        .sort((a, b) => (a.cadastrada_em || '').localeCompare(b.cadastrada_em || '')),
    [cotas],
  );
  const pagas = useMemo(
    () =>
      cotas
        .filter((c) => !!c.parcela_inicial_paga_em)
        .sort((a, b) => (b.parcela_inicial_paga_em || '').localeCompare(a.parcela_inicial_paga_em || '')),
    [cotas],
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
                <div className="flex justify-end gap-2">
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
                  {paga ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => marcar.mutate({ id: c.id, data: null })}
                      disabled={marcar.isPending}
                    >
                      Desfazer
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => abrirConfirm(c)}>
                      Parcela inicial paga
                    </Button>
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
          <CardTitle className="text-base">Cotas Cadastradas ({cotas.length})</CardTitle>
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
              {alvo?.nome} — grupo {alvo?.grupo} / cota {alvo?.cota}. Registro interno de acompanhamento; nada é
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
