import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus } from 'lucide-react';
import { useBulkTransfer } from '@/hooks/useBulkTransfer';

interface BulkTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  onSuccess: () => void;
}

export const BulkTransferDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  onSuccess,
}: BulkTransferDialogProps) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const bulkTransfer = useBulkTransfer();

  // Buscar SDRs e Closers disponíveis
  const { data: availableUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['transfer-users-sdr-closer'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_roles!inner(role)
        `)
        .in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador'])
        .order('full_name');
      return data || [];
    },
    enabled: open,
  });

  const handleTransfer = async () => {
    if (!selectedUser) return;

    const user = availableUsers?.find((u: any) => u.email === selectedUser);
    if (!user) return;

    await bulkTransfer.mutateAsync({
      dealIds: selectedDealIds,
      newOwnerEmail: user.email,
      newOwnerName: user.full_name || user.email,
    });

    setSelectedUser(null);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Transferir Leads em Massa
          </DialogTitle>
          <DialogDescription>
            Transferir {selectedDealIds.length} lead{selectedDealIds.length > 1 ? 's' : ''} para um novo responsável.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">
            Novo responsável
          </label>
          <Select value={selectedUser || ''} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o responsável" />
            </SelectTrigger>
            <SelectContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                availableUsers?.map((user: any) => (
                  <SelectItem key={user.id} value={user.email}>
                    <span className="flex items-center gap-2">
                      {user.full_name || user.email}
                      <span className="text-muted-foreground text-xs">
                        ({user.user_roles?.[0]?.role?.toUpperCase()})
                      </span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkTransfer.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUser || bulkTransfer.isPending}
          >
            {bulkTransfer.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Transferindo...
              </>
            ) : (
              `Transferir ${selectedDealIds.length} leads`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
