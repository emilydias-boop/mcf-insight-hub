import { useState } from 'react';
import { useRolesConfig, RoleConfig } from '@/hooks/useRolesConfig';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Shield, Pencil, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const COLOR_OPTIONS = [
  { label: 'Vermelho', value: 'bg-red-500/20 text-red-700 border-red-500/30' },
  { label: 'Roxo', value: 'bg-purple-500/20 text-purple-700 border-purple-500/30' },
  { label: 'Azul', value: 'bg-blue-500/20 text-blue-700 border-blue-500/30' },
  { label: 'Verde', value: 'bg-green-500/20 text-green-700 border-green-500/30' },
  { label: 'Laranja', value: 'bg-orange-500/20 text-orange-700 border-orange-500/30' },
  { label: 'Âmbar', value: 'bg-amber-500/20 text-amber-700 border-amber-500/30' },
  { label: 'Esmeralda', value: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30' },
  { label: 'Rosa', value: 'bg-pink-500/20 text-pink-700 border-pink-500/30' },
  { label: 'Ciano', value: 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30' },
  { label: 'Cinza', value: 'bg-gray-500/20 text-gray-700 border-gray-500/30' },
];

export default function AdminRoles() {
  const { roles, isLoading } = useRolesConfig();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0].value);
  const [newDesc, setNewDesc] = useState('');

  // Edit form
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleCreate = async () => {
    if (!newKey || !newLabel) {
      toast.error('Chave e label são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-roles', {
        body: { action: 'create', role_key: newKey, label: newLabel, color: newColor, description: newDesc || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Cargo "${newLabel}" criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['roles-config'] });
      setCreateOpen(false);
      setNewKey('');
      setNewLabel('');
      setNewColor(COLOR_OPTIONS[0].value);
      setNewDesc('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar cargo');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (updates: Partial<RoleConfig> & { id: string }) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-roles', {
        body: { action: 'update', ...updates },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Cargo atualizado!');
      queryClient.invalidateQueries({ queryKey: ['roles-config'] });
      setEditRole(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar cargo');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (role: RoleConfig) => {
    if (role.is_system) {
      toast.error('Roles de sistema não podem ser desativados');
      return;
    }
    await handleUpdate({ id: role.id, is_active: !role.is_active });
  };

  const openEdit = (role: RoleConfig) => {
    setEditRole(role);
    setEditLabel(role.label);
    setEditColor(role.color);
    setEditDesc(role.description || '');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Gerenciamento de Cargos
          </h1>
          <p className="text-muted-foreground">
            Crie e gerencie os cargos do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/permissoes">
            <Button variant="outline">
              Matriz de Permissões
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cargo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Cargo</DialogTitle>
                <DialogDescription>
                  O cargo será adicionado ao sistema e poderá receber permissões na Matriz de Permissões.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Chave (slug)</Label>
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="ex: supervisor"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase, sem espaços ou acentos. Não pode ser alterada depois.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Label (nome exibido)</Label>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="ex: Supervisor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setNewColor(c.value)}
                        className={`px-3 py-1 rounded-full text-xs border transition-all ${c.value} ${
                          newColor === c.value ? 'ring-2 ring-primary ring-offset-2' : ''
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="ex: Supervisiona equipes de vendas"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={saving || !newKey || !newLabel}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Cargo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cargos do Sistema</CardTitle>
          <CardDescription>
            Cargos marcados como "Sistema" não podem ser desativados. Configure permissões na Matriz de Permissões.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id} className={!role.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <Badge variant="outline" className={`${role.color} border`}>
                      {role.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {role.role_key}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                    {role.description || '—'}
                  </TableCell>
                  <TableCell>
                    {role.is_system ? (
                      <Badge variant="secondary" className="text-xs">Sistema</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Customizado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={role.is_active}
                        onCheckedChange={() => handleToggleActive(role)}
                        disabled={role.is_system || saving}
                      />
                      <span className="text-xs text-muted-foreground">
                        {role.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(role)}
                      disabled={role.is_system}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editRole} onOpenChange={(open) => !open && setEditRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cargo: {editRole?.role_key}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setEditColor(c.value)}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${c.value} ${
                      editColor === c.value ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>Cancelar</Button>
            <Button
              onClick={() => editRole && handleUpdate({
                id: editRole.id,
                label: editLabel,
                color: editColor,
                description: editDesc || null,
              } as any)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
