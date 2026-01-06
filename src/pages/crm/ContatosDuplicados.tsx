import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDuplicateContacts, useMergeDuplicates, useMergeAllDuplicates } from '@/hooks/useDuplicateContacts';
import { Users, Merge, Check, Phone, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ContatosDuplicados() {
  const { data: duplicates, isLoading } = useDuplicateContacts();
  const mergeDuplicates = useMergeDuplicates();
  const mergeAll = useMergeAllDuplicates();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const handleMergeGroup = (email: string, primaryId: string, duplicateIds: string[]) => {
    mergeDuplicates.mutate({ primaryId, duplicateIds });
  };

  const handleMergeAll = (dryRun: boolean) => {
    mergeAll.mutate({ dryRun });
  };

  const totalDuplicates = duplicates?.reduce((acc, g) => acc + g.contacts.length - 1, 0) || 0;
  const totalGroups = duplicates?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos Duplicados</h1>
          <p className="text-muted-foreground">
            Identifique e unifique contatos com o mesmo email
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleMergeAll(true)}
            disabled={mergeAll.isPending || totalGroups === 0}
          >
            {mergeAll.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Simular
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={mergeAll.isPending || totalGroups === 0}>
                <Merge className="h-4 w-4 mr-2" />
                Unificar Todos
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar unificação em massa</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá unificar <strong>{totalGroups} grupos</strong> de contatos duplicados, 
                  mantendo o contato principal e transferindo todos os deals.
                  <br /><br />
                  <strong>{totalDuplicates} contato(s)</strong> serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMergeAll(false)}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Grupos Duplicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGroups}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Contatos a Remover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalDuplicates}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grupos Duplicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !duplicates?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Nenhum contato duplicado encontrado!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicates.map((group) => {
                const isExpanded = expandedGroup === group.email;
                const primary = group.contacts[0];
                const duplicateIds = group.contacts.slice(1).map(c => c.id);

                return (
                  <div
                    key={group.email}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setExpandedGroup(isExpanded ? null : group.email)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{group.email}</span>
                          <Badge variant="outline">{group.contacts.length} contatos</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Principal: <span className="font-medium">{primary.name}</span>
                          {primary.deals_count > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {primary.deals_count} deal(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleMergeGroup(group.email, primary.id, duplicateIds)}
                        disabled={mergeDuplicates.isPending}
                      >
                        {mergeDuplicates.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Merge className="h-4 w-4" />
                        )}
                        <span className="ml-1">Unificar</span>
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t pt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>Deals</TableHead>
                              <TableHead>Criado em</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.contacts.map((contact, idx) => (
                              <TableRow key={contact.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {contact.name}
                                    {idx === 0 && (
                                      <Badge variant="default" className="text-xs">
                                        Principal
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {contact.phone ? (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {contact.phone}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {contact.deals_count}
                                    {contact.has_owner && (
                                      <Badge variant="secondary" className="text-xs">
                                        c/ owner
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {format(new Date(contact.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                                </TableCell>
                                <TableCell>
                                  {idx > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                      Será removido
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
