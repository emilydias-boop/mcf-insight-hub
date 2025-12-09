import { PlaybookDoc, PLAYBOOK_STATUS_LABELS, PLAYBOOK_STATUS_COLORS } from "@/types/playbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePlaybookStatsForDoc, usePlaybookReadsForDoc } from "@/hooks/usePlaybookReads";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Users, BookOpen, CheckCircle, XCircle } from "lucide-react";

interface PlaybookReadStatsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: PlaybookDoc | null;
}

export function PlaybookReadStats({ open, onOpenChange, doc }: PlaybookReadStatsProps) {
  const { data: stats, isLoading: statsLoading } = usePlaybookStatsForDoc(
    doc?.id || null,
    doc?.role || null
  );
  
  const { data: reads } = usePlaybookReadsForDoc(doc?.id || null);

  // Buscar usuários do cargo
  const { data: usersData } = useQuery({
    queryKey: ["users-by-role", doc?.role],
    queryFn: async () => {
      if (!doc?.role) return [];
      
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", doc.role as any);
      
      if (error) throw error;
      
      const userIds = userRoles?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!doc?.role && open,
  });

  if (!doc) return null;

  const readsMap = new Map((reads || []).map(r => [r.user_id, r]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Estatísticas de Leitura: {doc.titulo}
          </DialogTitle>
        </DialogHeader>

        {statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards de estatísticas */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.nao_lido || 0}</p>
                      <p className="text-xs text-muted-foreground">Não lido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.lido || 0}</p>
                      <p className="text-xs text-muted-foreground">Lido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.confirmado || 0}</p>
                      <p className="text-xs text-muted-foreground">Confirmado</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela detalhada */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lido em</TableHead>
                  <TableHead>Confirmado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersData?.map((user) => {
                  const read = readsMap.get(user.id);
                  const status = read?.status || 'nao_lido';

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={PLAYBOOK_STATUS_COLORS[status]}>
                          {PLAYBOOK_STATUS_LABELS[status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {read?.lido_em ? (
                          format(new Date(read.lido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {read?.confirmado_em ? (
                          format(new Date(read.confirmado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!usersData || usersData.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum usuário encontrado com este cargo.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
