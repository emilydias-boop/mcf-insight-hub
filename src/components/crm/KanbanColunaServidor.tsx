import { useEffect, useMemo, useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Inbox,
  ChevronDown,
  ClipboardCopy,
  Phone,
  Mail,
  Table2,
  Settings2,
  Loader2,
  Square,
  CheckSquare,
  MinusSquare,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DealKanbanCard } from './DealKanbanCard';
import { StageSortDropdown, SortOption } from './StageSortDropdown';
import { buildCopyLeadData, CopyLeadData } from './CopyLeadsFormatDialog';
import { useKanbanColuna, buscarKanbanLista, resumoDoDeal } from '@/hooks/useKanbanServidor';
import { useTotaisPorCliente, normalizarEmail } from '@/hooks/useTotaisPorCliente';

/**
 * Uma coluna do kanban no modo servidor: o número vem do banco (kanban_contagem),
 * os cards chegam de 50 em 50 (kanban_pagina) e as ações de coluna inteira
 * (selecionar, copiar) buscam a coluna completa só quando o usuário pede (kanban_lista).
 */
interface KanbanColunaServidorProps {
  stage: any;
  originIds: string[];
  filtros: Record<string, unknown>;
  colunasIds: string[];
  total: number | undefined;
  ordem: SortOption;
  onOrdemChange: (ordem: SortOption) => void;
  selectionEnabled: boolean;
  selectedDealIds: Set<string>;
  onSelectionChange?: (dealId: string, selected: boolean) => void;
  onSelectAllInStage?: (dealIds: string[]) => void;
  onClearStageSelection?: (dealIds: string[]) => void;
  onSelectByCountInStage?: (dealIds: string[], count: number) => void;
  onDealClick: (dealId: string) => void;
  onDealsCarregados: (deals: any[]) => void;
  onAbrirCopiaPersonalizada: (leads: CopyLeadData[]) => void;
}

export const KanbanColunaServidor = ({
  stage,
  originIds,
  filtros,
  colunasIds,
  total,
  ordem,
  onOrdemChange,
  selectionEnabled,
  selectedDealIds,
  onSelectionChange,
  onSelectAllInStage,
  onClearStageSelection,
  onSelectByCountInStage,
  onDealClick,
  onDealsCarregados,
  onAbrirCopiaPersonalizada,
}: KanbanColunaServidorProps) => {
  const queryClient = useQueryClient();
  const [carregandoColuna, setCarregandoColuna] = useState(false);
  const [qtdSelecao, setQtdSelecao] = useState('');

  const coluna = useKanbanColuna({
    originIds,
    filtros,
    stageId: stage.id,
    stageName: stage.stage_name,
    colunasIds,
    ordem,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deals = useMemo(() => coluna.deals, [coluna.data]);

  useEffect(() => {
    if (deals.length > 0) onDealsCarregados(deals);
  }, [deals, onDealsCarregados]);

  const emails = useMemo(
    () => deals.map((d: any) => d.crm_contacts?.email as string | undefined),
    [deals],
  );
  const { data: totaisPorCliente } = useTotaisPorCliente(emails);

  const chaveColunaInteira = ['kanban', 'lista-coluna', originIds, filtros, stage.id, ordem];

  // Busca a coluna inteira (versão leve) só quando uma ação precisa dela.
  const buscarColunaInteira = async (): Promise<any[]> => {
    setCarregandoColuna(true);
    try {
      return await queryClient.fetchQuery({
        queryKey: chaveColunaInteira,
        queryFn: () =>
          buscarKanbanLista({
            originIds,
            filtros,
            stageId: stage.id,
            stageName: stage.stage_name,
            colunasIds,
            ordem,
          }),
        staleTime: 30_000,
      });
    } catch (err) {
      toast.error('Não foi possível carregar a coluna inteira. Tente de novo.');
      throw err;
    } finally {
      setCarregandoColuna(false);
    }
  };

  // ---- seleção ----
  const colunaEmCache = queryClient.getQueryData<any[]>(chaveColunaInteira);
  const idsConhecidos = (colunaEmCache ?? deals).map((d: any) => d.id as string);
  const selecionadosNaColuna = idsConhecidos.filter((id) => selectedDealIds.has(id)).length;
  const totalColuna = total ?? deals.length;
  const estadoSelecao =
    selecionadosNaColuna === 0 ? 'none' : selecionadosNaColuna >= totalColuna ? 'all' : 'some';

  const selecionarTodos = async () => {
    const lista = await buscarColunaInteira();
    onSelectAllInStage?.(lista.map((d) => d.id));
  };
  const limparSelecao = async () => {
    const lista = await buscarColunaInteira();
    onClearStageSelection?.(lista.map((d) => d.id));
  };
  const selecionarQuantidade = async () => {
    const n = parseInt(qtdSelecao, 10);
    if (isNaN(n) || n <= 0) return;
    const lista = await buscarColunaInteira();
    onSelectByCountInStage?.(lista.map((d) => d.id), n);
    setQtdSelecao('');
  };

  // ---- copiar ----
  const copiar = async (montar: (lista: any[]) => string, rotulo: string) => {
    const lista = await buscarColunaInteira();
    if (lista.length === 0) {
      toast.info('Nenhum lead neste estágio');
      return;
    }
    await navigator.clipboard.writeText(montar(lista));
    toast.success(`${lista.length} ${rotulo}`);
  };

  const copiarPersonalizado = async () => {
    const lista = await buscarColunaInteira();
    if (lista.length === 0) {
      toast.info('Nenhum lead neste estágio');
      return;
    }
    const activityMap = new Map<string, any>(
      lista.map((d: any) => [String(d.id).toLowerCase().trim(), d.kanban_resumo]),
    );
    const channelMap = new Map<string, any>(lista.map((d: any) => [d.id, d.kanban_canal]));
    onAbrirCopiaPersonalizada(buildCopyLeadData(lista, stage.stage_name, activityMap, channelMap));
  };

  const restantes = Math.max((total ?? 0) - deals.length, 0);

  return (
    <div className="flex-shrink-0 w-[280px] h-full">
      <Card className="h-full flex flex-col">
        <CardHeader className={`flex-shrink-0 py-3 ${stage.color || 'bg-muted'}`}>
          <CardTitle className="text-sm font-medium">
            <div className="flex items-center justify-between">
              <span>{stage.stage_name}</span>
              <div className="flex items-center gap-1">
                <StageSortDropdown currentSort={ordem} onSortChange={onOrdemChange} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Copiar leads" disabled={carregandoColuna}>
                      {carregandoColuna ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() =>
                        copiar(
                          (l) => l.map((d: any) => d.crm_contacts?.phone || '(sem telefone)').join('\n'),
                          'telefone(s) copiado(s)',
                        )
                      }
                    >
                      <Phone className="h-4 w-4 mr-2" /> Só telefone
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        copiar(
                          (l) =>
                            l
                              .map((d: any) => {
                                const name = d.crm_contacts?.name || d.name || 'Sem nome';
                                const phone = d.crm_contacts?.phone || '(sem telefone)';
                                return `${name} - ${phone}`;
                              })
                              .join('\n'),
                          'lead(s) copiado(s)',
                        )
                      }
                    >
                      <ClipboardCopy className="h-4 w-4 mr-2" /> Nome + Telefone
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        copiar(
                          (l) =>
                            l
                              .map((d: any) => {
                                const name = d.crm_contacts?.name || d.name || 'Sem nome';
                                const phone = d.crm_contacts?.phone || '(sem telefone)';
                                const email = d.crm_contacts?.email || '(sem email)';
                                return `${name} - ${phone} - ${email}`;
                              })
                              .join('\n'),
                          'lead(s) copiado(s)',
                        )
                      }
                    >
                      <Mail className="h-4 w-4 mr-2" /> Nome + Telefone + Email
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        copiar((l) => {
                          const header = 'Nome\tTelefone\tEmail\tEstágio\tData entrada\tLigações';
                          const rows = l
                            .map((d: any) => {
                              const name = d.crm_contacts?.name || d.name || 'Sem nome';
                              const phone = d.crm_contacts?.phone || '';
                              const email = d.crm_contacts?.email || '';
                              const date = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '-';
                              const calls = d.kanban_resumo?.totalCalls ?? 0;
                              return `${name}\t${phone}\t${email}\t${stage.stage_name}\t${date}\t${calls}`;
                            })
                            .join('\n');
                          return `${header}\n${rows}`;
                        }, 'lead(s) copiado(s) (tabulado)')
                      }
                    >
                      <Table2 className="h-4 w-4 mr-2" /> Completo (planilha)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copiarPersonalizado}>
                      <Settings2 className="h-4 w-4 mr-2" /> Personalizado...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge variant="secondary" title="Total de negócios nesta etapa com os filtros atuais">
                  {total === undefined ? '…' : total.toLocaleString('pt-BR')}
                </Badge>
              </div>
            </div>

            {selectionEnabled && totalColuna > 0 && (
              <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (estadoSelecao === 'none' ? selecionarTodos() : limparSelecao())}
                  className="h-6 w-6 p-0 hover:bg-background/50"
                  disabled={carregandoColuna}
                  title={estadoSelecao === 'none' ? 'Selecionar todos' : 'Desmarcar todos'}
                >
                  {estadoSelecao === 'all' ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : estadoSelecao === 'some' ? (
                    <MinusSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={totalColuna}
                  placeholder="Qtd"
                  value={qtdSelecao}
                  onChange={(e) => setQtdSelecao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      selecionarQuantidade();
                    }
                  }}
                  className="w-14 h-6 text-xs px-1.5"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selecionarTodos}
                  className="h-6 px-1.5 text-xs hover:bg-background/50"
                  disabled={carregandoColuna}
                  title={`Selecionar todos (${totalColuna})`}
                >
                  <ListChecks className="h-3.5 w-3.5 mr-0.5" />
                  Todos
                </Button>
                {selecionadosNaColuna > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">{selecionadosNaColuna}</span>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>

        <Droppable droppableId={stage.id}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto p-3 space-y-2">
              {coluna.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : coluna.isError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <p className="text-sm text-muted-foreground">Erro ao carregar esta etapa</p>
                  <Button size="sm" variant="outline" onClick={() => coluna.refetch()}>
                    Tentar de novo
                  </Button>
                </div>
              ) : deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum negócio neste estágio</p>
                </div>
              ) : (
                <>
                  {deals.map((deal: any, index: number) => {
                    const email = deal.crm_contacts?.email as string | undefined;
                    return (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <DealKanbanCard
                            deal={deal}
                            isDragging={snapshot.isDragging}
                            provided={dragProvided}
                            onClick={() => onDealClick(deal.id)}
                            activitySummary={resumoDoDeal(deal)}
                            selectionMode={selectionEnabled}
                            isSelected={selectedDealIds.has(deal.id)}
                            onSelect={onSelectionChange}
                            salesChannel={deal.kanban_canal || 'live'}
                            outsideInfo={deal.kanban_outside}
                            totaisCliente={email ? totaisPorCliente?.get(normalizarEmail(email)) : undefined}
                          />
                        )}
                      </Draggable>
                    );
                  })}
                  {coluna.hasNextPage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      disabled={coluna.isFetchingNextPage}
                      onClick={() => coluna.fetchNextPage()}
                    >
                      {coluna.isFetchingNextPage ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-1" />
                      )}
                      Carregar mais{restantes > 0 ? ` (${restantes.toLocaleString('pt-BR')})` : ''}
                    </Button>
                  )}
                </>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </Card>
    </div>
  );
};
