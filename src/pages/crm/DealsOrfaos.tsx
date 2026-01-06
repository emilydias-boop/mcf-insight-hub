import { useState } from 'react';
import { useOrphanDeals, useAssignDealOwner, useApplySuggestedOwners } from '@/hooks/useOrphanDeals';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX, Wand2, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DealsOrfaos = () => {
  const { data: deals, isLoading, refetch } = useOrphanDeals();
  const { data: users } = useUsers();
  const assignOwner = useAssignDealOwner();
  const applySuggestions = useApplySuggestedOwners();

  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [batchOwner, setBatchOwner] = useState<string>('');

  const dealsWithSuggestion = deals?.filter(d => d.suggested_owner) || [];
  const dealsWithoutSuggestion = deals?.filter(d => !d.suggested_owner) || [];

  const toggleDealSelection = (dealId: string) => {
    setSelectedDeals(prev =>
      prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]
    );
  };

  const toggleAll = () => {
    if (selectedDeals.length === deals?.length) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(deals?.map(d => d.id) || []);
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

  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const user = users?.find(u => u.user_id === userId);
    return user?.full_name || user?.email || userId;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
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
              {deals?.length || 0} deals sem owner atribuído
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {dealsWithSuggestion.length > 0 && (
            <Button
              onClick={handleApplySuggestions}
              disabled={applySuggestions.isPending}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Aplicar {dealsWithSuggestion.length} Sugestões
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deals?.length || 0}</p>
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
                <p className="text-2xl font-bold">{dealsWithSuggestion.length}</p>
                <p className="text-sm text-muted-foreground">Com sugestão de owner</p>
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
                <p className="text-2xl font-bold">{dealsWithoutSuggestion.length}</p>
                <p className="text-sm text-muted-foreground">Sem sugestão</p>
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
        <CardHeader>
          <CardTitle>Deals sem Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedDeals.length === deals?.length && deals.length > 0}
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
                <TableHead className="w-48">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum deal órfão encontrado 🎉
                  </TableCell>
                </TableRow>
              ) : (
                deals?.map(deal => (
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
        </CardContent>
      </Card>
    </div>
  );
};

export default DealsOrfaos;
