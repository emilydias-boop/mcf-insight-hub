import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Pencil,
  FolderPlus,
  ListPlus,
  Trash2,
  Copy,
} from "lucide-react";
import { TaskSpace, TaskSpaceType, useUpdateTaskSpace, useDeleteTaskSpace } from "@/hooks/useTaskSpaces";

interface SpaceContextMenuProps {
  space: TaskSpace;
  onAddChild?: (type: TaskSpaceType) => void;
}

export function SpaceContextMenu({ space, onAddChild }: SpaceContextMenuProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newName, setNewName] = useState(space.name);

  const updateSpace = useUpdateTaskSpace();
  const deleteSpace = useDeleteTaskSpace();

  const handleRename = async () => {
    if (newName.trim() && newName !== space.name) {
      await updateSpace.mutateAsync({ id: space.id, name: newName.trim() });
    }
    setShowRenameDialog(false);
  };

  const handleDelete = async () => {
    await deleteSpace.mutateAsync(space.id);
    setShowDeleteDialog(false);
  };

  const canAddPasta = space.type === "setor";
  const canAddLista = space.type === "setor" || space.type === "pasta";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          side="right"
          sideOffset={5}
          className="w-48 bg-popover border shadow-md z-[100]"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={() => {
            setNewName(space.name);
            setShowRenameDialog(true);
          }}>
            <Pencil className="mr-2 h-4 w-4" />
            Renomear
          </DropdownMenuItem>

          {canAddPasta && onAddChild && (
            <DropdownMenuItem onClick={() => onAddChild("pasta")}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Adicionar Pasta
            </DropdownMenuItem>
          )}

          {canAddLista && onAddChild && (
            <DropdownMenuItem onClick={() => onAddChild("lista")}>
              <ListPlus className="mr-2 h-4 w-4" />
              Adicionar Lista
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Novo nome..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={updateSpace.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {space.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {space.type === "setor" && (
                <>Esta ação excluirá o setor e <strong>todas as pastas e listas</strong> dentro dele.</>
              )}
              {space.type === "pasta" && (
                <>Esta ação excluirá a pasta e <strong>todas as listas</strong> dentro dela.</>
              )}
              {space.type === "lista" && (
                <>Esta ação excluirá a lista. As tarefas associadas serão mantidas.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSpace.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
