import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, User, ArrowRight } from "lucide-react";
import { useTransferDealOwner } from "@/hooks/useLeadDistribution";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OwnerChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealName: string;
  currentOwner?: string | null;
}

interface UserOption {
  email: string;
  name: string;
  role: string;
}

export function OwnerChangeDialog({
  open,
  onOpenChange,
  dealId,
  dealName,
  currentOwner,
}: OwnerChangeDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const transferMutation = useTransferDealOwner();

  // Buscar SDRs e Closers disponíveis
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sdr-closer-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          profiles!inner(id, email, full_name)
        `)
        .in("role", ["sdr", "closer"]);

      if (error) {
        console.error("Erro ao buscar usuários para transferência:", error);
        throw error;
      }

      return (data || []).map((ur: any) => ({
        email: ur.profiles.email,
        name: ur.profiles.full_name || ur.profiles.email.split("@")[0],
        role: ur.role,
      })) as UserOption[];
    },
    enabled: open,
  });

  // Filtrar usuários pela busca
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const searchLower = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
    );
  }, [users, search]);

  const handleTransfer = async () => {
    if (!selectedUser) return;

    await transferMutation.mutateAsync({
      dealId,
      newOwnerEmail: selectedUser.email,
      newOwnerName: selectedUser.name,
      previousOwner: currentOwner || undefined,
    });

    onOpenChange(false);
    setSelectedUser(null);
    setSearch("");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getCurrentOwnerInitials = () => {
    if (!currentOwner) return "?";
    const emailPart = currentOwner.split("@")[0];
    const parts = emailPart.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return emailPart.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Transferir Lead
          </DialogTitle>
          <DialogDescription>
            Selecione o novo responsável pelo lead "{dealName}"
          </DialogDescription>
        </DialogHeader>

        {/* Current Owner */}
        {currentOwner && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-destructive/20 text-destructive">
                {getCurrentOwnerInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentOwner}</p>
              <p className="text-xs text-muted-foreground">Responsável atual</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* User List */}
        <ScrollArea className="h-[240px] rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
              <p className="text-sm text-destructive text-center">Erro ao carregar usuários</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredUsers.map((user) => {
                const isSelected = selectedUser?.email === user.email;
                const isCurrent = user.email.toLowerCase() === currentOwner?.toLowerCase();

                return (
                  <button
                    key={user.email}
                    onClick={() => !isCurrent && setSelectedUser(user)}
                    disabled={isCurrent}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                      isSelected
                        ? "bg-primary/10 border border-primary"
                        : isCurrent
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback
                        className={`text-xs ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge
                      variant={user.role === "closer" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {user.role.toUpperCase()}
                    </Badge>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px]">
                        Atual
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUser || transferMutation.isPending}
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              "Transferir Lead"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
