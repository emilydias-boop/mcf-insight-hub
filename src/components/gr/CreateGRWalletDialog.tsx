import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateGRWallet } from '@/hooks/useGRWallet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface CreateGRWalletDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateGRWalletDialog = ({ open, onClose }: CreateGRWalletDialogProps) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [bu, setBu] = useState('incorporador');
  const [maxCapacity, setMaxCapacity] = useState('50');
  
  const createWallet = useCreateGRWallet();
  
  // Buscar usuários com role GR
  const { data: users = [] } = useQuery({
    queryKey: ['gr-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });
  
  const handleSubmit = async () => {
    if (!selectedUser) return;
    
    await createWallet.mutateAsync({
      gr_user_id: selectedUser,
      bu,
      max_capacity: parseInt(maxCapacity) || 50,
    });
    
    setSelectedUser('');
    setBu('incorporador');
    setMaxCapacity('50');
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Carteira de GR</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Gerente de Conta</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Business Unit</Label>
            <Select value={bu} onValueChange={setBu}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incorporador">Incorporador</SelectItem>
                <SelectItem value="consorcio">Consórcio</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="leilao">Leilão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Capacidade Máxima</Label>
            <Input
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              min={1}
              max={500}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedUser || createWallet.isPending}>
            {createWallet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Carteira
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
