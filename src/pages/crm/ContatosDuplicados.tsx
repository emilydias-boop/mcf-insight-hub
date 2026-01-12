import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDuplicateContacts, useMergeDuplicates, useMergeAllDuplicates, DuplicateMatchType, DuplicateGroup } from '@/hooks/useDuplicateContacts';
import { Users, Merge, Check, Phone, AlertTriangle, Loader2, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function DuplicateGroupCard({ 
  group, 
  isExpanded, 
  onToggle, 
  onMerge, 
  isPending 
}: { 
  group: DuplicateGroup; 
  isExpanded: boolean; 
  onToggle: () => void; 
  onMerge: () => void;
  isPending: boolean;
}) {
  const primary = group.contacts[0];
  const duplicateIds = group.contacts.slice(1).map(c => c.id);

  return (
    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <div 
          className="flex-1 cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            {group.matchType === 'email' ? (
              <Mail className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Phone className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{group.matchKey}</span>
            <Badge variant="outline">{group.contacts.length} contatos</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Principal: <span className="font-medium">{primary.name}</span>
            {primary.deals_count > 0 && (
              <Badge variant="secondary" className="ml-2">
                {primary.deals_count} deal(s)
              </Badge>
            )}
            {primary.meetings_count > 0 && (
              <Badge variant="default" className="ml-1">
                <Calendar className="h-3 w-3 mr-1" />
                {primary.meetings_count}
              </Badge>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onMerge}
          disabled={isPending}
        >
          {isPending ? (
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
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Reuniões</TableHead>
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
                  <TableCell className="text-sm">
                    {contact.email || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <div className="flex items-center gap-1 text-sm">
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
                  <TableCell>
                    {contact.meetings_count > 0 ? (
                      <Badge variant="outline">{contact.meetings_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
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
}

function DuplicatesList({ matchType }: { matchType: DuplicateMatchType }) {
  const { data: duplicates, isLoading } = useDuplicateContacts(matchType);
  const mergeDuplicates = useMergeDuplicates();
  const mergeAll = useMergeAllDuplicates();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const handleMergeGroup = (primaryId: string, duplicateIds: string[]) => {
    mergeDuplicates.mutate({ primaryId, duplicateIds });
  };

  const handleMergeAll = (dryRun: boolean) => {
    mergeAll.mutate({ dryRun, matchType });
  };

  const totalDuplicates = duplicates?.reduce((acc, g) => acc + g.contacts.length - 1, 0) || 0;
  const totalGroups = duplicates?.length || 0;

  return (
    <div className="space-y-4">
      {/* Stats e Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Grupos:</span>{' '}
            <span className="font-bold">{totalGroups}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">A remover:</span>{' '}
            <span className="font-bold text-destructive">{totalDuplicates}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMergeAll(true)}
            disabled={mergeAll.isPending || totalGroups === 0}
          >
            {mergeAll.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Simular
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={mergeAll.isPending || totalGroups === 0}>
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

      {/* Lista */}
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
          {duplicates.map((group) => (
            <DuplicateGroupCard
              key={`${group.matchType}-${group.matchKey}`}
              group={group}
              isExpanded={expandedGroup === group.matchKey}
              onToggle={() => setExpandedGroup(expandedGroup === group.matchKey ? null : group.matchKey)}
              onMerge={() => handleMergeGroup(group.contacts[0].id, group.contacts.slice(1).map(c => c.id))}
              isPending={mergeDuplicates.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContatosDuplicados() {
  const [activeTab, setActiveTab] = useState<DuplicateMatchType>('email');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Contatos Duplicados</h1>
        <p className="text-muted-foreground">
          Identifique e unifique contatos duplicados por email ou telefone
        </p>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grupos Duplicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DuplicateMatchType)}>
            <TabsList className="mb-4">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Por Email
              </TabsTrigger>
              <TabsTrigger value="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Por Telefone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <DuplicatesList matchType="email" />
            </TabsContent>

            <TabsContent value="phone">
              <DuplicatesList matchType="phone" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
