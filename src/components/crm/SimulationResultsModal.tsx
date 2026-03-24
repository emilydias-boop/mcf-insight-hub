import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Mail, Phone, Shield, ShieldAlert } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SimulationGroup {
  key: string;
  matchType: 'email' | 'phone';
  primary_id: string;
  primary_name: string;
  primary_email: string | null;
  primary_phone: string | null;
  primary_max_stage_order: number;
  primary_deals: number;
  primary_meetings: number;
  primary_stage_name: string | null;
  duplicates: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    deals: number;
    meetings: number;
    max_stage_order: number;
    stage_name: string | null;
    risk: boolean;
  }[];
  has_risk: boolean;
  phone_risk: boolean;
}

interface SimulationResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    email_groups: number;
    phone_groups: number;
    deal_consolidation_pairs: number;
    groups_processed: SimulationGroup[];
  } | null;
  onExecute: () => void;
  isExecuting: boolean;
}

export function SimulationResultsModal({ open, onOpenChange, data, onExecute, isExecuting }: SimulationResultsModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'risk'>('all');

  if (!data) return null;

  const groups = data.groups_processed || [];
  const riskGroups = groups.filter(g => g.has_risk);
  const safeGroups = groups.filter(g => !g.has_risk);
  const filteredGroups = filter === 'risk' ? riskGroups : groups;

  const totalContactsToDelete = groups.reduce((acc, g) => acc + g.duplicates.length, 0);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Simulação Detalhada — Limpeza Completa
          </DialogTitle>
          <DialogDescription>
            Revise exatamente o que será mantido e removido antes de executar.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{data.email_groups}</div>
            <div className="text-xs text-muted-foreground">Grupos Email</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{data.phone_groups}</div>
            <div className="text-xs text-muted-foreground">Grupos Telefone</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{data.deal_consolidation_pairs}</div>
            <div className="text-xs text-muted-foreground">Pares de Deals</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{totalContactsToDelete}</div>
            <div className="text-xs text-muted-foreground">Contatos a remover</div>
          </div>
        </div>

        {/* Risk summary */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3 text-green-500" />
              {safeGroups.length} seguros
            </Badge>
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              {riskGroups.length} com risco
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({groups.length})
            </Button>
            <Button
              variant={filter === 'risk' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('risk')}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Riscos ({riskGroups.length})
            </Button>
          </div>
        </div>

        {/* Groups list */}
        <ScrollArea className="flex-1 min-h-0 max-h-[45vh]">
          <div className="space-y-2 pr-4">
            {filteredGroups.map((group) => {
              const groupKey = `${group.matchType}-${group.key}`;
              const isOpen = expandedGroups.has(groupKey);

              return (
                <Collapsible key={groupKey} open={isOpen} onOpenChange={() => toggleGroup(groupKey)}>
                  <CollapsibleTrigger className="w-full">
                    <div className={`flex items-center justify-between p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors ${group.has_risk ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        {group.matchType === 'email' ? (
                          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium truncate">{group.key}</span>
                        <Badge variant="outline" className="shrink-0">{group.duplicates.length + 1} contatos</Badge>
                        {group.has_risk && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-500 shrink-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Risco
                          </Badge>
                        )}
                        {group.phone_risk && (
                          <Badge variant="outline" className="text-orange-600 border-orange-500 shrink-0">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            Emails diferentes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-1 mb-2 border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Deals</TableHead>
                            <TableHead>Reuniões</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Principal */}
                          <TableRow className="bg-green-500/5">
                            <TableCell>
                              <Check className="h-4 w-4 text-green-600" />
                            </TableCell>
                            <TableCell className="font-medium">{group.primary_name}</TableCell>
                            <TableCell className="text-sm">{group.primary_email || '-'}</TableCell>
                            <TableCell className="text-sm">{group.primary_phone || '-'}</TableCell>
                            <TableCell>{group.primary_deals}</TableCell>
                            <TableCell>{group.primary_meetings}</TableCell>
                            <TableCell className="text-sm">{group.primary_stage_name || '-'}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-600 text-white">Manter</Badge>
                            </TableCell>
                          </TableRow>
                          {/* Duplicates */}
                          {group.duplicates.map((dup) => (
                            <TableRow key={dup.id} className={dup.risk ? 'bg-yellow-500/5' : 'bg-red-500/5'}>
                              <TableCell>
                                {dup.risk ? (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <span className="h-4 w-4 block" />
                                )}
                              </TableCell>
                              <TableCell>{dup.name}</TableCell>
                              <TableCell className="text-sm">{dup.email || '-'}</TableCell>
                              <TableCell className="text-sm">{dup.phone || '-'}</TableCell>
                              <TableCell>
                                {dup.deals}
                                {dup.risk && dup.deals > group.primary_deals && (
                                  <span className="text-yellow-600 text-xs ml-1">⚠️ mais que o principal</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {dup.meetings}
                                {dup.risk && dup.meetings > group.primary_meetings && (
                                  <span className="text-yellow-600 text-xs ml-1">⚠️</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{dup.stage_name || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">Remover</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>

        {/* Action */}
        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            {riskGroups.length > 0 && (
              <span className="text-yellow-600">
                ⚠️ {riskGroups.length} grupo(s) com risco — revise antes de executar
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={onExecute} disabled={isExecuting}>
              Executar Limpeza Completa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
