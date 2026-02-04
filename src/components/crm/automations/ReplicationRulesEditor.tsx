import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Play, RefreshCw, ArrowRight, Copy, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useDealReplicationRules,
  useCreateReplicationRule,
  useUpdateReplicationRule,
  useDeleteReplicationRule,
  useToggleReplicationRule,
  useReplicationLogs,
  useProcessReplicationQueue,
  DealReplicationRule,
  CreateReplicationRuleInput,
  MatchCondition,
} from '@/hooks/useDealReplicationRules';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReplicationRulesEditorProps {
  originId?: string;
}

export function ReplicationRulesEditor({ originId }: ReplicationRulesEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DealReplicationRule | null>(null);
  const [formData, setFormData] = useState<CreateReplicationRuleInput>({
    name: '',
    description: '',
    source_origin_id: originId || '',
    source_stage_id: '',
    target_origin_id: '',
    target_stage_id: '',
    match_condition: null,
    is_active: true,
    copy_custom_fields: true,
    copy_tasks: false,
    priority: 0,
  });
  const [matchType, setMatchType] = useState<'none' | 'product_name' | 'tags'>('none');
  const [matchValues, setMatchValues] = useState('');

  const { data: rules = [], isLoading: rulesLoading } = useDealReplicationRules(originId);
  const { data: logs = [], isLoading: logsLoading } = useReplicationLogs(undefined, 20);
  const createRule = useCreateReplicationRule();
  const updateRule = useUpdateReplicationRule();
  const deleteRule = useDeleteReplicationRule();
  const toggleRule = useToggleReplicationRule();
  const processQueue = useProcessReplicationQueue();

  // Fetch origins - avoid deep type instantiation
  const originsQuery = useQuery({
    queryKey: ['crm-origins-list'],
    queryFn: async () => {
      // @ts-ignore - Supabase types cause deep instantiation
      const result = await supabase.from('crm_origins').select('id, name').eq('is_active', true).order('name');
      return (result.data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  const origins = originsQuery.data ?? [];

  // Fetch stages - avoid deep type instantiation
  const stagesQuery = useQuery({
    queryKey: ['crm-stages-list'],
    queryFn: async () => {
      // @ts-ignore - Supabase types cause deep instantiation
      const result = await supabase.from('crm_stages').select('id, stage_name, origin_id').eq('is_active', true).order('stage_order');
      const data = result.data ?? [];
      return data.map((s: any) => ({ 
        id: String(s.id), 
        name: String(s.stage_name), 
        origin_id: String(s.origin_id) 
      }));
    },
  });
  const stages = stagesQuery.data ?? [];

  const sourceStages = stages.filter(s => s.origin_id === formData.source_origin_id);
  const targetStages = stages.filter(s => s.origin_id === formData.target_origin_id);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      source_origin_id: originId || '',
      source_stage_id: '',
      target_origin_id: '',
      target_stage_id: '',
      match_condition: null,
      is_active: true,
      copy_custom_fields: true,
      copy_tasks: false,
      priority: 0,
    });
    setMatchType('none');
    setMatchValues('');
    setEditingRule(null);
  };

  const handleEdit = (rule: DealReplicationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      source_origin_id: rule.source_origin_id,
      source_stage_id: rule.source_stage_id,
      target_origin_id: rule.target_origin_id,
      target_stage_id: rule.target_stage_id,
      match_condition: rule.match_condition,
      is_active: rule.is_active,
      copy_custom_fields: rule.copy_custom_fields,
      copy_tasks: rule.copy_tasks,
      priority: rule.priority,
    });
    
    if (rule.match_condition) {
      setMatchType(rule.match_condition.type as 'product_name' | 'tags');
      setMatchValues(rule.match_condition.values.join(', '));
    } else {
      setMatchType('none');
      setMatchValues('');
    }
    
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const matchCondition: MatchCondition | null = matchType !== 'none' && matchValues.trim() 
      ? {
          type: matchType,
          operator: matchType === 'tags' ? 'includes_any' : 'contains',
          values: matchValues.split(',').map(v => v.trim()).filter(Boolean),
        }
      : null;

    const data = {
      ...formData,
      match_condition: matchCondition,
    };

    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, ...data });
    } else {
      await createRule.mutateAsync(data);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta regra?')) {
      await deleteRule.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Regras de Replicação
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Automação Cross-Pipeline</h3>
              <p className="text-sm text-muted-foreground">
                Configure regras para duplicar deals automaticamente entre pipelines
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => processQueue.mutate()}
                disabled={processQueue.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${processQueue.isPending ? 'animate-spin' : ''}`} />
                Processar Fila
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Regra
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Replicação'}</DialogTitle>
                    <DialogDescription>
                      Configure quando e para onde os deals devem ser duplicados automaticamente
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Regra</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ex: Parceria → Consórcio"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Input
                          type="number"
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descrição opcional da regra"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Card className="p-4 space-y-3">
                        <h4 className="font-medium text-sm">Origem (Trigger)</h4>
                        <div className="space-y-2">
                          <Label className="text-xs">Pipeline</Label>
                          <Select
                            value={formData.source_origin_id}
                            onValueChange={(v) => setFormData({ ...formData, source_origin_id: v, source_stage_id: '' })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              {origins.map(o => (
                                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Etapa que dispara</Label>
                          <Select
                            value={formData.source_stage_id}
                            onValueChange={(v) => setFormData({ ...formData, source_stage_id: v })}
                            disabled={!formData.source_origin_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a etapa" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceStages.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Card>

                      <Card className="p-4 space-y-3">
                        <h4 className="font-medium text-sm">Destino</h4>
                        <div className="space-y-2">
                          <Label className="text-xs">Pipeline</Label>
                          <Select
                            value={formData.target_origin_id}
                            onValueChange={(v) => setFormData({ ...formData, target_origin_id: v, target_stage_id: '' })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              {origins.map(o => (
                                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Etapa inicial</Label>
                          <Select
                            value={formData.target_stage_id}
                            onValueChange={(v) => setFormData({ ...formData, target_stage_id: v })}
                            disabled={!formData.target_origin_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a etapa" />
                            </SelectTrigger>
                            <SelectContent>
                              {targetStages.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Card>
                    </div>

                    <Card className="p-4 space-y-3">
                      <h4 className="font-medium text-sm">Condição de Match</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Tipo de Condição</Label>
                          <Select
                            value={matchType}
                            onValueChange={(v: 'none' | 'product_name' | 'tags') => setMatchType(v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem condição (todos os deals)</SelectItem>
                              <SelectItem value="product_name">Nome do Produto (contém)</SelectItem>
                              <SelectItem value="tags">Tags (inclui alguma)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {matchType !== 'none' && (
                          <div className="space-y-2">
                            <Label className="text-xs">Valores (separados por vírgula)</Label>
                            <Input
                              value={matchValues}
                              onChange={(e) => setMatchValues(e.target.value)}
                              placeholder="A001, A009, PARCERIA"
                            />
                          </div>
                        )}
                      </div>
                    </Card>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.is_active}
                          onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                        />
                        <Label>Ativa</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.copy_custom_fields}
                          onCheckedChange={(v) => setFormData({ ...formData, copy_custom_fields: v })}
                        />
                        <Label>Copiar campos personalizados</Label>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={!formData.name || !formData.source_origin_id || !formData.source_stage_id || !formData.target_origin_id || !formData.target_stage_id}
                    >
                      {editingRule ? 'Salvar' : 'Criar Regra'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {rulesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma regra de replicação configurada</p>
                <p className="text-sm">Clique em "Nova Regra" para começar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, is_active: v })}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.name}</span>
                            <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                              {rule.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{rule.source_origin?.name}</span>
                            <span className="text-xs">({rule.source_stage?.name})</span>
                            <ArrowRight className="h-4 w-4" />
                            <span>{rule.target_origin?.name}</span>
                            <span className="text-xs">({rule.target_stage?.name})</span>
                          </div>
                          {rule.match_condition && rule.match_condition.values?.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-muted-foreground">Condição:</span>
                              {rule.match_condition.values.slice(0, 3).map((v, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{v}</Badge>
                              ))}
                              {rule.match_condition.values.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{rule.match_condition.values.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Histórico de Replicações</h3>
            <p className="text-sm text-muted-foreground">
              Últimas replicações executadas automaticamente
            </p>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma replicação executada ainda</p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead>Deal Origem</TableHead>
                  <TableHead>Deal Destino</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.executed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{log.rule?.name || '-'}</TableCell>
                    <TableCell className="text-sm">{log.source_deal?.name || log.source_deal_id}</TableCell>
                    <TableCell className="text-sm">{log.target_deal?.name || log.target_deal_id}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
