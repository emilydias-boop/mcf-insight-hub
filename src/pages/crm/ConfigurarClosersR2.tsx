import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Settings, Users, Mail, Trash2, Edit, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useR2ClosersList, useCreateR2Closer, useUpdateR2Closer, useDeleteR2Closer, R2Closer, R2CloserFormData } from '@/hooks/useR2Closers';

const COLORS = [
  '#8B5CF6', '#F97316', '#10B981', '#3B82F6', '#EC4899', 
  '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#84CC16'
];

export default function ConfigurarClosersR2() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCloser, setSelectedCloser] = useState<R2Closer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closerToDelete, setCloserToDelete] = useState<R2Closer | null>(null);

  const { data: closers, isLoading, error } = useR2ClosersList();
  const createMutation = useCreateR2Closer();
  const updateMutation = useUpdateR2Closer();
  const deleteMutation = useDeleteR2Closer();

  // Form state
  const [formData, setFormData] = useState<R2CloserFormData>({
    name: '',
    email: '',
    color: COLORS[0],
    is_active: true,
    priority: 99,
  });

  const handleAdd = () => {
    setSelectedCloser(null);
    const nextPriority = (closers?.length || 0) + 1;
    setFormData({
      name: '',
      email: '',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      is_active: true,
      priority: nextPriority,
    });
    setFormOpen(true);
  };

  const handleEdit = (closer: R2Closer) => {
    setSelectedCloser(closer);
    setFormData({
      name: closer.name,
      email: closer.email,
      color: closer.color || COLORS[0],
      is_active: closer.is_active ?? true,
      priority: closer.priority ?? 99,
    });
    setFormOpen(true);
  };

  const handleDelete = (closer: R2Closer) => {
    setCloserToDelete(closer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (closerToDelete) {
      await deleteMutation.mutateAsync(closerToDelete.id);
      setDeleteDialogOpen(false);
      setCloserToDelete(null);
    }
  };

  const handleSubmit = async () => {
    if (selectedCloser) {
      await updateMutation.mutateAsync({ id: selectedCloser.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setFormOpen(false);
  };

  const activeClosers = closers?.filter(c => c.is_active) || [];
  const inactiveClosers = closers?.filter(c => !c.is_active) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm/agenda-r2')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Configurar Closers R2</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os closers de Reunião 02
            </p>
          </div>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Closer R2
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{closers?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{activeClosers.length}</p>
              </div>
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-2xl font-bold text-muted-foreground">{inactiveClosers.length}</p>
              </div>
              <X className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Closers R2</CardTitle>
          <CardDescription>
            Lista de closers responsáveis pelas reuniões R2 (Reunião 02)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Erro ao carregar closers R2
            </div>
          ) : closers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum closer R2 cadastrado.</p>
              <p className="text-sm">Clique em "Adicionar Closer R2" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-center">Prioridade</TableHead>
                  <TableHead className="w-[50px]">Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closers?.map((closer) => (
                  <TableRow key={closer.id}>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {closer.priority ?? 99}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: closer.color || '#6B7280' }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{closer.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {closer.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={closer.is_active ? 'default' : 'secondary'}>
                        {closer.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(closer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(closer)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCloser ? 'Editar Closer R2' : 'Adicionar Closer R2'}
            </DialogTitle>
            <DialogDescription>
              {selectedCloser ? 'Atualize as informações do closer R2.' : 'Preencha as informações do novo closer R2.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do closer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Input
                  id="priority"
                  type="number"
                  min={1}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 99 })}
                  placeholder="1 = maior prioridade"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Ativo</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.email || createMutation.isPending || updateMutation.isPending}
            >
              {selectedCloser ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Closer R2?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{closerToDelete?.name}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
