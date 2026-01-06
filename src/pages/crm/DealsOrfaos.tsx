import { useState } from 'react';
import { 
  useOrphanDeals, 
  useAssignDealOwner, 
  useApplySuggestedOwners, 
  useDeleteZeroValueDeals,
  useMergeDuplicateContacts,
  type OrphanDealsFilters 
} from '@/hooks/useOrphanDeals';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { OrphanDealsFiltersComponent } from '@/components/crm/OrphanDealsFilters';
import { WebhookHistoryDrawer } from '@/components/crm/WebhookHistoryDrawer';
import { UserX, Wand2, Users, RefreshCw, AlertTriangle, Trash2, GitMerge, Webhook } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DealsOrfaos = () => {
  const [filters, setFilters] = useState<OrphanDealsFilters>({ page: 1, per_page: 50 });
  const { data, isLoading, refetch } = useOrphanDeals(filters);
  const { data: users } = useUsers();
  const assignOwner = useAssignDealOwner();
  const applySuggestions = useApplySuggestedOwners();
  const deleteZeroValue = useDeleteZeroValueDeals();
  const mergeDuplicates = useMergeDuplicateContacts();

  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [batchOwner, setBatchOwner] = useState<string>('');
  const [webhookDrawerEmail, setWebhookDrawerEmail] = useState<string | null>(null);

  const deals = data?.deals || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / (filters.per_page || 50));

  const toggleDealSelection = (dealId: string) => {
    setSelectedDeals(prev =>
      prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]
    );
  };

  const toggleAll = () => {
    if (selectedDeals.length === deals.length) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(deals.map(d => d.id));
    }
  };

  const handleAssignSelected = () => {
    if (!batchOwner || selectedDeals.length === 0) return;
    assignOwner.mutate({ dealIds: selectedDeals, ownerId: batchOwner }, {
      onSuccess: () => setSelectedDeals([]),
    });
  };

  const handleApplySuggestions = () => {
    applySuggestions.mutate();
  };

  const handleAssignSingle = (dealId: string, ownerId: string) => {
    assignOwner.mutate({ dealIds: [dealId], ownerId });
  };

  const handleDeleteZeroValue = () => {
    if (confirm('Excluir todos os deals órfãos com valor zero ou nulo? Esta ação não pode ser desfeita.')) {
      deleteZeroValue.mutate();
    }
  };

  const handleMergeDuplicates = async () => {
    // Primeiro dry run
    const result = await mergeDuplicates.mutateAsync(true);
    if (result?.would_merge > 0) {
      if (confirm(`${result.would_merge} contatos duplicados encontrados. Deseja unificá-los agora?`)) {
        mergeDuplicates.mutate(false);
      }
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const user = users?.find(u => u.user_id === userId);
    return user?.full_name || user?.email || userId.slice(0, 8);
  };

  const goToPage = (page: number) => {
    setFilters(f => ({ ...f, page }));
    setSelectedDeals([]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserX className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Deals Órfãos</h1>
            <p className="text-sm text-muted-foreground">
              {total.toLocaleString('pt-BR')} deals sem owner atribuído
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMergeDuplicates}
            disabled={mergeDuplicates.isPending}
          >
            <GitMerge className="h-4 w-4 mr-2" />
            Unificar Duplicados
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDeleteZeroValue}
            disabled={deleteZeroValue.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Valor Zero
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {(data?.totalWithSuggestion || 0) > 0 && (
            <Button
              onClick={handleApplySuggestions}
              disabled={applySuggestions.isPending}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Aplicar Sugestões
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <OrphanDealsFiltersComponent filters={filters} onFiltersChange={setFilters} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-muted-foreground">Total sem owner</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.totalWithSuggestion || 0}</p>
                <p className="text-sm text-muted-foreground">Com sugestão (página atual)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.totalWithoutSuggestion || 0}</p>
                <p className="text-sm text-muted-foreground">Sem sugestão (página atual)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Assignment */}
      {selectedDeals.length > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-sm">
                {selectedDeals.length} selecionado(s)
              </Badge>
              <Select value={batchOwner} onValueChange={setBatchOwner}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecionar owner" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAssignSelected}
                disabled={!batchOwner || assignOwner.isPending}
              >
                <Users className="h-4 w-4 mr-2" />
                Atribuir Selecionados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deals Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Deals sem Owner</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Mostrando {deals.length} de {total.toLocaleString('pt-BR')}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedDeals.length === deals.length && deals.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Sugestão</TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-48">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum deal órfão encontrado com esses filtros
                  </TableCell>
                </TableRow>
              ) : (
                deals.map(deal => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDeals.includes(deal.id)}
                        onCheckedChange={() => toggleDealSelection(deal.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{deal.name}</div>
                      {deal.product_name && (
                        <div className="text-xs text-muted-foreground">{deal.product_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{deal.contact_name || '-'}</div>
                      {deal.contact_email && (
                        <div className="text-xs text-muted-foreground">{deal.contact_email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{deal.origin_name || 'Sem origem'}</Badge>
                    </TableCell>
                    <TableCell>
                      {deal.value ? `R$ ${deal.value.toLocaleString('pt-BR')}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={deal.data_source === 'webhook' ? 'secondary' : 'default'}>
                        {deal.data_source || 'manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(deal.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {deal.suggested_owner ? (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          <Wand2 className="h-3 w-3 mr-1" />
                          {getUserName(deal.suggested_owner)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {deal.contact_email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setWebhookDrawerEmail(deal.contact_email)}
                          title="Ver histórico de webhooks"
                        >
                          <Webhook className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(value) => handleAssignSingle(deal.id, value)}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder="Atribuir owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {deal.suggested_owner && (
                            <SelectItem value={deal.suggested_owner}>
                              ⭐ {getUserName(deal.suggested_owner)} (sugerido)
                            </SelectItem>
                          )}
                          {users?.filter(u => u.user_id !== deal.suggested_owner).map(user => (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {user.full_name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Itens por página:</span>
                <Select 
                  value={String(filters.per_page || 50)} 
                  onValueChange={(v) => setFilters(f => ({ ...f, per_page: Number(v), page: 1 }))}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => goToPage(Math.max(1, (filters.page || 1) - 1))}
                      className={filters.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => goToPage(page)}
                          isActive={page === (filters.page || 1)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {totalPages > 5 && (
                    <PaginationItem>
                      <span className="px-2">...</span>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => goToPage(Math.min(totalPages, (filters.page || 1) + 1))}
                      className={(filters.page || 1) >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook History Drawer */}
      <WebhookHistoryDrawer
        email={webhookDrawerEmail}
        open={!!webhookDrawerEmail}
        onClose={() => setWebhookDrawerEmail(null)}
      />
    </div>
  );
};

export default DealsOrfaos;
