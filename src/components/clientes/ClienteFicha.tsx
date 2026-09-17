import { AlertTriangle, Mail, Phone, IdCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  brl,
  dataCurta,
  formatarDocumento,
  inteiro,
  selosDoItem,
  temLiquidoDuplicado,
} from '@/lib/clientesFormat';
import type { ClienteConsolidado, VendaPorProduto } from '@/hooks/useClientes';

interface Props {
  cliente: ClienteConsolidado;
  produtos: VendaPorProduto[];
  carregandoProdutos: boolean;
}

export function ClienteFicha({ cliente, produtos, carregandoProdutos }: Props) {
  const historico = cliente.historico_compras ?? [];
  const alertaDuplicado = temLiquidoDuplicado(historico.map((h) => h.liquido));

  // `parcelas_contratadas` só existe em vw_venda_por_produto — casa por produto+gateway.
  const chave = (p?: string | null, g?: string | null) =>
    `${(p ?? '').trim().toLowerCase()}||${(g ?? '').trim().toLowerCase()}`;
  const parcelasPorItem = new Map(
    produtos.map((p) => [chave(p.produto, p.gateway), p.parcelas_contratadas]),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-display text-2xl leading-tight">
          {cliente.cliente_nome || 'Sem nome'}
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> {cliente.cliente_email}
          </span>
          {cliente.cliente_telefone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {cliente.cliente_telefone}
            </span>
          )}
          {cliente.cliente_cpf ? (
            <span className="flex items-center gap-1.5 tabular-nums">
              <IdCard className="h-3.5 w-3.5" /> {formatarDocumento(cliente.cliente_cpf)}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> CPF ainda não capturado neste gateway
            </span>
          )}
        </div>
      </div>

      {alertaDuplicado && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Dois produtos com o líquido idêntico ao centavo — pode ser a mesma venda registrada
            duas vezes. Confira antes de considerar os dois brutos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Líquido pago</p>
            <p className="font-display text-3xl tabular-nums">{brl(cliente.total_liquido_pago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Bruto dos produtos
            </p>
            <p className="font-display text-3xl tabular-nums text-muted-foreground">
              {brl(cliente.total_bruto_produtos)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground tabular-nums">
        <span>1ª compra: {dataCurta(cliente.primeira_compra)}</span>
        <span>Última compra: {dataCurta(cliente.ultima_compra)}</span>
        <span>{inteiro(cliente.qtd_produtos)} produtos</span>
        <span>{inteiro(cliente.total_pagamentos)} pagamentos</span>
        {cliente.tem_reembolso && <Badge variant="outline">tem reembolso</Badge>}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de compras
        </h3>

        {carregandoProdutos && historico.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {historico.length === 0 && !carregandoProdutos && (
          <p className="text-sm text-muted-foreground">
            Nenhuma compra registrada para este cliente.
          </p>
        )}

        {historico.map((item, i) => {
          const selos = selosDoItem({
            pagamentos: item.pagamentos,
            parcelasContratadas: parcelasPorItem.get(chave(item.produto, item.gateway)),
            bruto: item.bruto,
            dias: item.dias,
            gateway: item.gateway,
          });
          const intervalo =
            item.primeiro && item.ultimo && dataCurta(item.primeiro) !== dataCurta(item.ultimo)
              ? `${dataCurta(item.primeiro)} → ${dataCurta(item.ultimo)}`
              : dataCurta(item.ultimo || item.primeiro);

          return (
            <Card key={`${item.produto}-${item.gateway}-${i}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{item.produto || 'Produto sem nome'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="font-normal">
                        {item.gateway || 'sem gateway'}
                      </Badge>
                      <span className="tabular-nums">{intervalo}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="text-xs text-muted-foreground">{brl(item.bruto)}</p>
                    <p className="font-semibold">{brl(item.liquido)}</p>
                  </div>
                </div>
                {selos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selos.map((s) => (
                      <Badge
                        key={s.texto}
                        variant="outline"
                        className={
                          s.tom === 'atencao'
                            ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                            : undefined
                        }
                      >
                        {s.texto}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
