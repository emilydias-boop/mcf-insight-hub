import { useState } from "react";
import { PlaybookDoc, PLAYBOOK_STATUS_LABELS, PLAYBOOK_STATUS_COLORS, PLAYBOOK_ROLE_LABELS } from "@/types/playbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlaybookStatsForDoc, usePlaybookReadsForDoc, usePlaybookViewers } from "@/hooks/usePlaybookReads";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Users, BookOpen, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { PlaybookViewedBy } from "./PlaybookViewedBy";

interface PlaybookReadStatsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: PlaybookDoc | null;
}

type FilterType = "all" | "never_seen" | "seen_not_confirmed";

export function PlaybookReadStats({ open, onOpenChange, doc }: PlaybookReadStatsProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: stats, isLoading: statsLoading } = usePlaybookStatsForDoc(
    doc?.id || null,
    doc?.role || null
  );
  
  const { data: reads } = usePlaybookReadsForDoc(doc?.id || null);
  const { data: viewers } = usePlaybookViewers(doc?.id || null);

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
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!doc?.role && open,
  });

  if (!doc) return null;

  const readsMap = new Map((reads || []).map(r => [r.user_id, r]));

  // Aplicar filtro
  const filteredUsers = usersData?.filter(user => {
    const read = readsMap.get(user.id);
    
    if (filter === "never_seen") {
      return !read;
    }
    if (filter === "seen_not_confirmed") {
      return read && read.status !== 'confirmado';
    }
    return true;
  }) || [];

  const viewedCount = stats ? stats.lido + stats.confirmado : 0;
  const neverViewedCount = stats?.nao_lido || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Estatísticas: {doc.titulo}</span>
            <Badge variant="outline">{PLAYBOOK_ROLE_LABELS[doc.role]}</Badge>
          </DialogTitle>
        </DialogHeader>

        {statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Viewed By - estilo Notion */}
            <div className="flex items-center justify-between border-b pb-4">
              <PlaybookViewedBy viewers={viewers || []} maxAvatars={5} />
            </div>

            {/* Resumo textual */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-1">
              <p className="text-sm">
                <span className="font-medium text-primary">{viewedCount}</span> de{" "}
                <span className="font-medium">{stats?.total || 0}</span> usuários deste cargo já visualizaram este documento
              </p>
              {neverViewedCount > 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <EyeOff className="h-4 w-4" />
                  {neverViewedCount} {neverViewedCount === 1 ? 'usuário nunca abriu' : 'usuários nunca abriram'} este documento
                </p>
              )}
            </div>

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
                      <p className="text-xs text-muted-foreground">Nunca viram</p>
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
                      <p className="text-xs text-muted-foreground">Viram</p>
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
                      <p className="text-xs text-muted-foreground">Confirmaram</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtro */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="never_seen">Nunca viram</SelectItem>
                  <SelectItem value="seen_not_confirmed">Viram mas não confirmaram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela detalhada */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Viu?</TableHead>
                  <TableHead>Primeira visualização</TableHead>
                  <TableHead>Última visualização</TableHead>
                  <TableHead className="text-center">Views</TableHead>
                  <TableHead>Confirmado?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const read = readsMap.get(user.id);
                  const hasViewed = !!read;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasViewed ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Eye className="h-4 w-4" />
                            <span>Sim</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <EyeOff className="h-4 w-4" />
                            <span>Não</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {read?.lido_em ? (
                          <div>
                            <p>{format(new Date(read.lido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(read.lido_em), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {read?.ultima_acao_em ? (
                          <div>
                            <p>{format(new Date(read.ultima_acao_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(read.ultima_acao_em), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {read?.visualizacoes_qtd || 0}
                      </TableCell>
                      <TableCell>
                        {read?.confirmado_em ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>Sim</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Não</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum usuário encontrado com este filtro.
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
