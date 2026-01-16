import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Badge } from '@/components/ui/badge';
import { STATUS_OPTIONS, ConsorcioStatus } from '@/types/consorcio';

interface StatusEditDropdownProps {
  currentStatus: ConsorcioStatus;
  onStatusChange: (newStatus: ConsorcioStatus) => void;
  isLoading?: boolean;
}

export function StatusEditDropdown({ 
  currentStatus, 
  onStatusChange, 
  isLoading 
}: StatusEditDropdownProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status: ConsorcioStatus | null;
    title: string;
    description: string;
  }>({
    open: false,
    status: null,
    title: '',
    description: '',
  });

  const currentConfig = STATUS_OPTIONS.find(s => s.value === currentStatus);

  const handleStatusSelect = (newStatus: ConsorcioStatus) => {
    if (newStatus === currentStatus) return;

    // Status que precisam de confirmação
    if (newStatus === 'cancelado') {
      setConfirmDialog({
        open: true,
        status: newStatus,
        title: 'Cancelar Cota',
        description: 'Tem certeza que deseja cancelar esta cota? Esta ação marcará a cota como cancelada e não poderá ser facilmente revertida.',
      });
      return;
    }

    if (newStatus === 'contemplado') {
      setConfirmDialog({
        open: true,
        status: newStatus,
        title: 'Marcar como Contemplado',
        description: 'Tem certeza que deseja marcar esta cota como contemplada? Recomendamos usar a aba de Contemplação para registrar os detalhes.',
      });
      return;
    }

    if (newStatus === 'inativo') {
      setConfirmDialog({
        open: true,
        status: newStatus,
        title: 'Inativar Cota',
        description: 'Tem certeza que deseja inativar esta cota? Ela não aparecerá mais nos relatórios ativos.',
      });
      return;
    }

    onStatusChange(newStatus);
  };

  const handleConfirm = () => {
    if (confirmDialog.status) {
      onStatusChange(confirmDialog.status);
    }
    setConfirmDialog({ open: false, status: null, title: '', description: '' });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            disabled={isLoading}
          >
            <Badge className={currentConfig?.color}>
              {currentConfig?.label || currentStatus}
            </Badge>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUS_OPTIONS.map((status) => (
            <DropdownMenuItem
              key={status.value}
              onClick={() => handleStatusSelect(status.value as ConsorcioStatus)}
              className="flex items-center gap-2"
            >
              <Badge className={status.color} variant="outline">
                {status.label}
              </Badge>
              {status.value === currentStatus && (
                <Check className="h-4 w-4 ml-auto" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, status: null, title: '', description: '' });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
