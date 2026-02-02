import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle, Calendar, Info, Building2 } from 'lucide-react';
import { useClosersList, useDeleteCloser, Closer } from '@/hooks/useClosers';
import { CloserFormDialog } from '@/components/crm/CloserFormDialog';
import { useActiveBU } from '@/hooks/useActiveBU';

const BU_LABELS: Record<string, string> = {
  incorporador: 'Incorporador',
  consorcio: 'Consórcio',
  credito: 'Crédito',
  projetos: 'Projetos',
  leilao: 'Leilão',
};

export default function ConfigurarClosers() {
  const { data: closers, isLoading, error } = useClosersList();
  const deleteCloser = useDeleteCloser();
  const activeBU = useActiveBU();
  
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCloser, setSelectedCloser] = useState<Closer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closerToDelete, setCloserToDelete] = useState<Closer | null>(null);

  const handleEdit = (closer: Closer) => {
    setSelectedCloser(closer);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedCloser(null);
    setFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (closerToDelete) {
      await deleteCloser.mutateAsync(closerToDelete.id);
      setDeleteDialogOpen(false);
      setCloserToDelete(null);
    }
  };

  // Filtrar closers pela BU ativa (se houver)
  const filteredClosers = closers?.filter(c => !activeBU || c.bu === activeBU) || [];
  const activeClosers = filteredClosers.filter(c => c.is_active);
  const configuredClosers = filteredClosers.filter(c => c.calendly_event_type_uri);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurar Closers</h1>
          <p className="text-muted-foreground">Gerencie os closers e suas integrações com Calendly</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Closer
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Closers {activeBU ? `(${BU_LABELS[activeBU] || activeBU})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredClosers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closers Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeClosers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Calendly Configurado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{configuredClosers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Configuração */}
      {closers && closers.length > 0 && configuredClosers.length < activeClosers.length && (
        <Alert className="bg-amber-500/10 border-amber-500/50">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <strong>{activeClosers.length - configuredClosers.length} closer(s)</strong> ainda não têm o Calendly configurado. 
            Configure o Event Type URI para habilitar agendamentos automáticos.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela de Closers */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Closers</CardTitle>
          <CardDescription>Todos os closers cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-destructive text-center py-8">
              Erro ao carregar closers: {error.message}
            </div>
          ) : filteredClosers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum closer cadastrado {activeBU ? `para ${BU_LABELS[activeBU] || activeBU}` : ''}.</p>
              <Button onClick={handleAdd} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar primeiro closer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Closer</TableHead>
                  <TableHead>Email</TableHead>
                  {!activeBU && <TableHead>BU</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Calendly</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClosers.map((closer) => (
                  <TableRow key={closer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: closer.color || '#3b82f6' }}
                        />
                        <span className="font-medium">{closer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{closer.email}</TableCell>
                    {!activeBU && (
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Building2 className="h-3 w-3" />
                          {BU_LABELS[closer.bu || 'incorporador'] || closer.bu}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      {closer.is_active ? (
                        <Badge variant="default" className="bg-green-500/20 text-green-700 hover:bg-green-500/30">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {closer.calendly_event_type_uri ? (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                          <Calendar className="mr-1 h-3 w-3" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Não configurado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(closer)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setCloserToDelete(closer);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <CloserFormDialog 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        closer={selectedCloser} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o closer <strong>{closerToDelete?.name}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
