import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GRWallet } from '@/types/gr-types';
import { useUpdateGRWallet } from '@/hooks/useGRWallet';
import { Loader2 } from 'lucide-react';

interface GRCapacityDialogProps {
  open: boolean;
  onClose: () => void;
  wallet: GRWallet;
}

export const GRCapacityDialog = ({ open, onClose, wallet }: GRCapacityDialogProps) => {
  const [capacity, setCapacity] = useState(wallet.max_capacity.toString());
  const updateWallet = useUpdateGRWallet();
  
  const handleSubmit = () => {
    const newCapacity = parseInt(capacity);
    if (isNaN(newCapacity) || newCapacity < wallet.current_count) {
      return;
    }
    
    updateWallet.mutate(
      { id: wallet.id, max_capacity: newCapacity },
      { onSuccess: () => onClose() }
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Capacidade</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="capacity">Nova Capacidade</Label>
            <Input
              id="capacity"
              type="number"
              min={wallet.current_count}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Mínimo: {wallet.current_count} (quantidade atual de clientes)
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex justify-between text-sm">
              <span>Clientes atuais:</span>
              <span className="font-medium">{wallet.current_count}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Capacidade atual:</span>
              <span className="font-medium">{wallet.max_capacity}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Nova capacidade:</span>
              <span className="font-medium text-primary">{capacity}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateWallet.isPending || parseInt(capacity) < wallet.current_count}
          >
            {updateWallet.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
