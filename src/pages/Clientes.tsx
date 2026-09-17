import { useState } from 'react';
import { Search, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useClientesLista,
  useClienteProdutos,
  type ClienteConsolidado,
  type ClienteOrdem,
} from '@/hooks/useClientes';
import { brl, gatewayLegado, inteiro } from '@/lib/clientesFormat';
import { ClienteFicha } from '@/components/clientes/ClienteFicha';

const Clientes = () => {
  const [busca, setBusca] = useState('');
  const [multiGateway, setMultiGateway] = useState(false);
  const [semCpf, setSemCpf] = useState(false);
  const [ordem, setOrdem] = useState<ClienteOrdem>('ultima_compra');
  const [selecionado, setSelecionado] = useState<ClienteConsolidado | null>(null);
  const buscaDebounced = useDebounce(busca, 300);
  const isMobile = useIsMobile();

  const lista = useClientesLista({ busca: buscaDebounced, multiGateway, semCpf, ordem });
  const clientes = lista.data?.pages.flatMap((p) => p.rows) ?? [];
  const produtos = useClienteProdutos(selecionado?.cliente_email);

  const painelLista = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou CPF"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle
            size="sm"
            variant="outline"
            pressed={multiGateway}
            onPressedChange={setMultiGateway}
          >
            Mais de um gateway
          </Toggle>
          <Toggle size="sm" variant="outline" pressed={semCpf} onPressedChange={setSemCpf}>
            Sem CPF
          </Toggle>
          <Toggle
            size="sm"
            variant="outline"
            pressed={ordem === 'total_liquido_pago'}
            onPressedChange={(v) => setOrdem(v ? 'total_liquido_pago' : 'ultima_compra')}
          >
            Ordenar por líquido
          </Toggle>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-md border border-border">
        <div className="divide-y divide-border">
          {lista.isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}

          {lista.isError && (
            <p className="p-4 text-sm text-destructive">
              Não foi possível carregar os clientes. Tente novamente em instantes.
            </p>
          )}

          {!lista.isLoading && !lista.isError && clientes.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Nenhum cliente encontrado com esses filtros.</p>
            </div>
          )}

          {clientes.map((c) => (
            <button
              key={c.cliente_email}
              type="button"
              onClick={() => setSelecionado(c)}
              className={`flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/60 ${
                selecionado?.cliente_email === c.cliente_email ? 'bg-muted' : ''
              }`}
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{c.cliente_nome || c.cliente_email}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {inteiro(c.qtd_produtos)} produtos · {inteiro(c.total_pagamentos)} pagamentos
                </p>
                <div className="flex flex-wrap gap-1">
                  {(c.gateways ?? []).map((g) => (
                    <Badge
                      key={g}
                      variant="outline"
                      className={`text-[0.65rem] font-normal ${
                        gatewayLegado(g)
                          ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                          : ''
                      }`}
                    >
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className="text-xs text-muted-foreground">{brl(c.total_bruto_produtos)}</p>
                <p className="font-semibold">{brl(c.total_liquido_pago)}</p>
              </div>
            </button>
          ))}

          {lista.hasNextPage && (
            <div className="p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => lista.fetchNextPage()}
                disabled={lista.isFetchingNextPage}
              >
                {lista.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const ficha = selecionado ? (
    <ClienteFicha
      cliente={selecionado}
      produtos={produtos.data ?? []}
      carregandoProdutos={produtos.isLoading}
    />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Users className="h-10 w-10" />
      <p className="text-sm">Selecione um cliente para ver a ficha completa.</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada por cliente — somente leitura.
        </p>
      </div>

      {isMobile ? (
        <div className="relative min-h-0 flex-1">
          {painelLista}
          {selecionado && (
            <div className="absolute inset-0 z-20 overflow-auto rounded-md border border-border bg-background p-4">
              <div className="mb-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setSelecionado(null)}>
                  <X className="mr-1 h-4 w-4" /> Fechar
                </Button>
              </div>
              {ficha}
            </div>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {painelLista}
          <Card className="min-h-0 overflow-hidden">
            <CardContent className="h-full overflow-auto p-4">{ficha}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Clientes;
