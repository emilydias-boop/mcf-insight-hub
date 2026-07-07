import { useState } from 'react';
import { UserCog, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useArGestores, useAddArGestor, useRemoveArGestor, useAllProfiles,
} from '@/hooks/useArGestores';

export function ArGestoresDialog() {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>('');
  const { data: gestores = [] } = useArGestores();
  const { data: profiles = [] } = useAllProfiles();
  const addM = useAddArGestor();
  const removeM = useRemoveArGestor();

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const available = profiles.filter(p => !gestores.includes(p.id));

  const add = async () => {
    if (!pick) return;
    try {
      await addM.mutateAsync(pick);
      toast.success('Gestor delegado');
      setPick('');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao delegar');
    }
  };

  const remove = async (uid: string) => {
    if (!confirm('Remover delegação deste usuário?')) return;
    try {
      await removeM.mutateAsync(uid);
      toast.success('Delegação removida');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="w-4 h-4 mr-1" /> Delegar acesso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delegar acesso ao À Receber</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Usuários listados abaixo podem visualizar e editar títulos, parcelas e alterar o tipo (integral / parcelado).
            Admins têm acesso automaticamente.
          </p>
          <div className="flex gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger><SelectValue placeholder="Selecionar usuário…" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {available.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name} {p.email && <span className="text-muted-foreground text-xs">· {p.email}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!pick || addM.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Delegar
            </Button>
          </div>
          <div className="border rounded divide-y">
            {gestores.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum delegado.</div>
            ) : (
              gestores.map(uid => {
                const p = profileMap.get(uid);
                return (
                  <div key={uid} className="flex items-center justify-between p-2">
                    <div className="text-sm">
                      <div className="font-medium">{p?.full_name || uid}</div>
                      {p?.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(uid)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}