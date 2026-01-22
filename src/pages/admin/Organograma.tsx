import { useState } from "react";
import { Network, Settings2, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useCargos, useCargoMetricas, useCargoMetricasMutations, useOrganograma } from "@/hooks/useOrganograma";
import { FONTES_DADOS, TIPOS_CALCULO, SQUADS, CargoMetricaConfig } from "@/types/organograma";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function MetricaConfigCard({ 
  metrica, 
  onUpdate, 
  onDelete 
}: { 
  metrica: CargoMetricaConfig;
  onUpdate: (updates: Partial<CargoMetricaConfig>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    label_exibicao: metrica.label_exibicao,
    peso_percentual: metrica.peso_percentual,
    fonte_dados: metrica.fonte_dados || '',
    meta_padrao: metrica.meta_padrao || 0,
  });

  const handleSave = () => {
    onUpdate({
      label_exibicao: editForm.label_exibicao,
      peso_percentual: editForm.peso_percentual,
      fonte_dados: editForm.fonte_dados,
      meta_padrao: editForm.meta_padrao,
    });
    setIsEditing(false);
  };

  const fonteLabel = FONTES_DADOS.find(f => f.value === metrica.fonte_dados)?.label || metrica.fonte_dados;

  return (
    <Card className="mb-3">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
          
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Label de Exibição</Label>
                    <Input 
                      value={editForm.label_exibicao}
                      onChange={(e) => setEditForm(prev => ({ ...prev, label_exibicao: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Peso (%)</Label>
                    <Input 
                      type="number"
                      value={editForm.peso_percentual}
                      onChange={(e) => setEditForm(prev => ({ ...prev, peso_percentual: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fonte de Dados</Label>
                    <Select 
                      value={editForm.fonte_dados} 
                      onValueChange={(v) => setEditForm(prev => ({ ...prev, fonte_dados: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTES_DADOS.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Meta Padrão</Label>
                    <Input 
                      type="number"
                      value={editForm.meta_padrao}
                      onChange={(e) => setEditForm(prev => ({ ...prev, meta_padrao: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{metrica.ordem}. {metrica.label_exibicao}</span>
                    <Badge variant="outline">{metrica.peso_percentual}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fonte: {fonteLabel} | Meta: {metrica.meta_padrao || '-'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricasTab() {
  const { data: cargos, isLoading: cargosLoading } = useCargos();
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: metricas, isLoading: metricasLoading } = useCargoMetricas(selectedCargoId, selectedSquad);
  const { createMetrica, updateMetrica, deleteMetrica } = useCargoMetricasMutations();

  const [newMetrica, setNewMetrica] = useState({
    nome_metrica: '',
    label_exibicao: '',
    peso_percentual: 25,
    tipo_calculo: 'contagem',
    fonte_dados: 'meeting_slot_attendees',
    meta_padrao: 0,
  });

  const handleAddMetrica = () => {
    if (!selectedCargoId || !newMetrica.nome_metrica || !newMetrica.label_exibicao) return;

    createMetrica.mutate({
      cargo_catalogo_id: selectedCargoId,
      squad: selectedSquad,
      nome_metrica: newMetrica.nome_metrica,
      label_exibicao: newMetrica.label_exibicao,
      peso_percentual: newMetrica.peso_percentual,
      tipo_calculo: newMetrica.tipo_calculo,
      fonte_dados: newMetrica.fonte_dados,
      meta_padrao: newMetrica.meta_padrao || null,
      ordem: (metricas?.length || 0) + 1,
      ativo: true,
    });

    setIsAddDialogOpen(false);
    setNewMetrica({
      nome_metrica: '',
      label_exibicao: '',
      peso_percentual: 25,
      tipo_calculo: 'contagem',
      fonte_dados: 'meeting_slot_attendees',
      meta_padrao: 0,
    });
  };

  const totalPeso = metricas?.reduce((sum, m) => sum + m.peso_percentual, 0) || 0;
  const selectedCargo = cargos?.find(c => c.id === selectedCargoId);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-64">
          <Label>Cargo</Label>
          {cargosLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedCargoId || ''} onValueChange={(v) => setSelectedCargoId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cargo" />
              </SelectTrigger>
              <SelectContent>
                {cargos?.map(cargo => (
                  <SelectItem key={cargo.id} value={cargo.id}>
                    {cargo.nome_exibicao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="w-48">
          <Label>Squad (opcional)</Label>
          <Select value={selectedSquad || 'all'} onValueChange={(v) => setSelectedSquad(v === 'all' ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas (global)</SelectItem>
              {SQUADS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics List */}
      {selectedCargoId ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Métricas de Fechamento para: {selectedCargo?.nome_exibicao}</CardTitle>
                <CardDescription>
                  {selectedSquad ? `Squad: ${SQUADS.find(s => s.value === selectedSquad)?.label}` : 'Configuração global (todas as squads)'}
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Métrica
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Métrica</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nome da Métrica (código)</Label>
                        <Input 
                          placeholder="ex: reunioes_agendadas"
                          value={newMetrica.nome_metrica}
                          onChange={(e) => setNewMetrica(prev => ({ ...prev, nome_metrica: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Label de Exibição</Label>
                        <Input 
                          placeholder="ex: Reuniões Agendadas"
                          value={newMetrica.label_exibicao}
                          onChange={(e) => setNewMetrica(prev => ({ ...prev, label_exibicao: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Peso (%)</Label>
                        <Input 
                          type="number"
                          value={newMetrica.peso_percentual}
                          onChange={(e) => setNewMetrica(prev => ({ ...prev, peso_percentual: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <Label>Meta Padrão</Label>
                        <Input 
                          type="number"
                          value={newMetrica.meta_padrao}
                          onChange={(e) => setNewMetrica(prev => ({ ...prev, meta_padrao: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Fonte de Dados</Label>
                      <Select 
                        value={newMetrica.fonte_dados} 
                        onValueChange={(v) => setNewMetrica(prev => ({ ...prev, fonte_dados: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONTES_DADOS.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleAddMetrica} disabled={createMetrica.isPending}>
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {metricasLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : metricas && metricas.length > 0 ? (
              <>
                {metricas.map(metrica => (
                  <MetricaConfigCard
                    key={metrica.id}
                    metrica={metrica}
                    onUpdate={(updates) => updateMetrica.mutate({ id: metrica.id, ...updates })}
                    onDelete={() => deleteMetrica.mutate(metrica.id)}
                  />
                ))}
                
                <div className={cn(
                  "mt-4 p-3 rounded-lg flex items-center justify-between",
                  totalPeso === 100 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                )}>
                  <span className="font-medium">Total dos pesos:</span>
                  <span className="font-bold">{totalPeso}% {totalPeso === 100 ? '✓' : '(deve ser 100%)'}</span>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma métrica configurada para este cargo.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um cargo para configurar suas métricas de fechamento.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EstruturaTab() {
  const { data: organograma, isLoading } = useOrganograma();
  const { data: cargos } = useCargos();

  // Group by squad
  const orgBySquad = organograma?.reduce((acc, node) => {
    const squad = node.squad || 'geral';
    if (!acc[squad]) acc[squad] = [];
    acc[squad].push(node);
    return acc;
  }, {} as Record<string, typeof organograma>) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Visualize e gerencie a estrutura hierárquica da organização.
        </p>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Posição
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : Object.keys(orgBySquad).length > 0 ? (
        Object.entries(orgBySquad).map(([squad, nodes]) => (
          <Card key={squad}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {squad === 'incorporador' ? '🏠' : squad === 'consorcio' ? '💳' : squad === 'credito' ? '💰' : '📊'}
                {SQUADS.find(s => s.value === squad)?.label || squad.toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {nodes.map(node => (
                  <div key={node.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground ml-4">└──</span>
                    <span>{node.cargo?.nome_exibicao || 'Cargo não definido'}</span>
                    <Badge variant="outline" className="ml-auto">
                      {node.cargo?.cargo_base}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhuma estrutura organizacional definida.</p>
            <p className="text-sm mt-2">Clique em "Adicionar Posição" para começar.</p>
          </CardContent>
        </Card>
      )}

      {/* Cargos disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Cargos Disponíveis</CardTitle>
          <CardDescription>Cargos cadastrados no catálogo que podem ser usados no organograma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {cargos?.map(cargo => (
              <Badge key={cargo.id} variant="outline" className="py-1.5">
                {cargo.nome_exibicao}
                <span className="text-muted-foreground ml-1">({cargo.area})</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Organograma() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6" />
          Organograma & Métricas
        </h1>
        <p className="text-muted-foreground">
          Configure a estrutura hierárquica e métricas de cada cargo
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="metricas">
        <TabsList>
          <TabsTrigger value="estrutura" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Estrutura
          </TabsTrigger>
          <TabsTrigger value="metricas" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Métricas por Cargo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estrutura" className="mt-6">
          <EstruturaTab />
        </TabsContent>

        <TabsContent value="metricas" className="mt-6">
          <MetricasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
