import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GRWallet } from '@/types/gr-types';
import { useAllGRWallets } from '@/hooks/useGRWallet';
import { useTransferGREntry } from '@/hooks/useGRTransfer';
import { useGRWalletEntries } from '@/hooks/useGRWallet';
import { Loader2, AlertTriangle } from 'lucide-react';

interface GRRedistributeDialogProps {
  open: boolean;
  onClose: () => void;
  wallet: GRWallet;
}

export const GRRedistributeDialog = ({ open, onClose, wallet }: GRRedistributeDialogProps) => {
  const [targetWalletId, setTargetWalletId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  
  const { data: wallets = [] } = useAllGRWallets();
  const { data: entries = [] } = useGRWalletEntries(wallet.id);
  const transferEntry = useTransferGREntry();
  
  // Filter out current wallet and closed wallets
  const availableWallets = wallets.filter(w => 
    w.id !== wallet.id && 
    w.is_open && 
    w.current_count < w.max_capacity
  );
  
  const handleSubmit = async () => {
    if (!targetWalletId || entries.length === 0) return;
    
    setIsTransferring(true);
    
    try {
      // Transfer each entry one by one
      for (const entry of entries) {
        await transferEntry.mutateAsync({
          entryId: entry.id,
          fromWalletId: wallet.id,
          toWalletId: targetWalletId,
          reason,
        });
      }
      onClose();
    } catch (error) {
      console.error('Error transferring entries:', error);
    } finally {
      setIsTransferring(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redistribuir Leads</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {wallet.current_count === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <span>Esta carteira não possui leads para redistribuir</span>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm">
                  <span className="font-medium">{wallet.current_count}</span> leads serão 
                  transferidos da carteira de <span className="font-medium">{wallet.gr_name}</span>
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Carteira de Destino</Label>
                <Select value={targetWalletId} onValueChange={setTargetWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWallets.length === 0 ? (
                      <SelectItem value="" disabled>
                        Nenhuma carteira disponível
                      </SelectItem>
                    ) : (
                      availableWallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.gr_name} ({w.current_count}/{w.max_capacity})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da Redistribuição</Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva o motivo da redistribuição..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              isTransferring || 
              !targetWalletId || 
              wallet.current_count === 0
            }
          >
            {isTransferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Redistribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
