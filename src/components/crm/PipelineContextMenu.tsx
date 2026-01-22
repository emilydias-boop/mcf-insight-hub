import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Button } from '@/components/ui/button';
import { MoreVertical, Settings, MousePointer, Archive, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PipelineContextMenuProps {
  targetType: 'origin' | 'group';
  targetId: string;
  targetName: string;
  onConfigure: () => void;
  onSelect: () => void;
}

export const PipelineContextMenu = ({
  targetType,
  targetId,
  targetName,
  onConfigure,
  onSelect,
}: PipelineContextMenuProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (targetType === 'origin') {
        const { error } = await supabase
          .from('crm_origins')
          .update({ is_archived: true } as any)
          .eq('id', targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_groups')
          .update({ is_archived: true } as any)
          .eq('id', targetId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${targetType === 'origin' ? 'Origem' : 'Pipeline'} arquivada!`);
      queryClient.invalidateQueries({ queryKey: ['crm-origins'] });
      queryClient.invalidateQueries({ queryKey: ['crm-groups'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins-by-pipeline'] });
      setShowArchiveDialog(false);
    },
    onError: (error) => {
      toast.error('Erro ao arquivar: ' + (error as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const table = targetType === 'origin' ? 'crm_origins' : 'crm_groups';
      const { error } = await supabase.from(table).delete().eq('id', targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${targetType === 'origin' ? 'Origem' : 'Pipeline'} excluída!`);
      queryClient.invalidateQueries({ queryKey: ['crm-origins'] });
      queryClient.invalidateQueries({ queryKey: ['crm-groups'] });
      queryClient.invalidateQueries({ queryKey: ['crm-origins-by-pipeline'] });
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast.error('Erro ao excluir: ' + (error as Error).message);
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onConfigure}>
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSelect}>
            <MousePointer className="h-4 w-4 mr-2" />
            Selecionar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
            <Archive className="h-4 w-4 mr-2" />
            Arquivar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar {targetType === 'origin' ? 'origem' : 'pipeline'}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{targetName}" será arquivada e não aparecerá mais na listagem. 
              Os dados serão preservados e você pode desarquivar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate()}>
              {archiveMutation.isPending ? 'Arquivando...' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. "{targetName}" e todos os dados relacionados
              serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
