import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shuffle,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Users,
  Percent,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useDistributionConfig,
  useSaveDistributionConfig,
  useResetDistributionCounters,
  DistributionConfigInput,
} from "@/hooks/useLeadDistribution";

interface LocalConfig {
  user_email: string;
  user_name: string;
  percentage: number;
  is_active: boolean;
  current_count: number;
}

export default function LeadDistribution() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [localConfigs, setLocalConfigs] = useState<LocalConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Buscar grupos (pipelines)
  const { data: groups = [] } = useQuery({
    queryKey: ["crm-groups-for-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_groups")
        .select("id, name, display_name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Buscar origins filtradas pelo grupo selecionado
  const { data: origins = [], isLoading: isLoadingOrigins } = useQuery({
    queryKey: ["crm-origins-for-distribution", selectedGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_origins")
        .select("id, name, display_name")
        .eq("group_id", selectedGroupId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGroupId,
  });

  // Buscar SDRs e Closers
  const { data: availableUsers = [] } = useQuery({
    queryKey: ["sdr-closer-users-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          profiles!inner(id, email, full_name)
        `)
        .in("role", ["sdr", "closer"]);

      if (error) throw error;
      return (data || []).map((ur: any) => ({
        email: ur.profiles.email,
        name: ur.profiles.full_name || ur.profiles.email.split("@")[0],
        role: ur.role,
      }));
    },
  });

  // Buscar configuração atual
  const { data: currentConfig = [], isLoading: isLoadingConfig } = useDistributionConfig(selectedOriginId);

  // Mutations
  const saveConfigMutation = useSaveDistributionConfig();
  const resetCountersMutation = useResetDistributionCounters();

  // Sincronizar local state com dados do servidor
  useEffect(() => {
    if (currentConfig.length > 0) {
      setLocalConfigs(
        currentConfig.map((c) => ({
          user_email: c.user_email,
          user_name: c.user_name || c.user_email.split("@")[0],
          percentage: Number(c.percentage),
          is_active: c.is_active,
          current_count: c.current_count,
        }))
      );
    } else {
      setLocalConfigs([]);
    }
    setHasChanges(false);
  }, [currentConfig]);

  // Calcular total de percentuais
  const totalPercentage = localConfigs.reduce((sum, c) => sum + (c.is_active ? c.percentage : 0), 0);
  const isValidTotal = Math.abs(totalPercentage - 100) < 0.01;

  // Adicionar usuário
  const handleAddUser = (user: { email: string; name: string }) => {
    if (localConfigs.some((c) => c.user_email === user.email)) {
      toast.error("Usuário já adicionado");
      return;
    }
    setLocalConfigs([
      ...localConfigs,
      {
        user_email: user.email,
        user_name: user.name,
        percentage: 0,
        is_active: true,
        current_count: 0,
      },
    ]);
    setHasChanges(true);
  };

  // Remover usuário
  const handleRemoveUser = (email: string) => {
    setLocalConfigs(localConfigs.filter((c) => c.user_email !== email));
    setHasChanges(true);
  };

  // Atualizar percentual
  const handlePercentageChange = (email: string, value: string) => {
    const numValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setLocalConfigs(
      localConfigs.map((c) =>
        c.user_email === email ? { ...c, percentage: numValue } : c
      )
    );
    setHasChanges(true);
  };

  // Toggle ativo/inativo
  const handleToggleActive = (email: string) => {
    setLocalConfigs(
      localConfigs.map((c) =>
        c.user_email === email ? { ...c, is_active: !c.is_active } : c
      )
    );
    setHasChanges(true);
  };

  // Distribuir igualmente
  const handleDistributeEqually = () => {
    const activeCount = localConfigs.filter((c) => c.is_active).length;
    if (activeCount === 0) {
      toast.error("Nenhum usuário ativo para distribuir");
      return;
    }
    const equalPct = Math.round((100 / activeCount) * 100) / 100;
    setLocalConfigs(
      localConfigs.map((c) => ({
        ...c,
        percentage: c.is_active ? equalPct : 0,
      }))
    );
    setHasChanges(true);
  };

  // Salvar configuração
  const handleSave = async () => {
    if (!selectedOriginId) return;
    if (!isValidTotal && localConfigs.some((c) => c.is_active)) {
      toast.error("A soma dos percentuais deve ser 100%");
      return;
    }

    const configs: DistributionConfigInput[] = localConfigs.map((c) => ({
      origin_id: selectedOriginId,
      user_email: c.user_email,
      user_name: c.user_name,
      percentage: c.percentage,
      is_active: c.is_active,
    }));

    await saveConfigMutation.mutateAsync({ originId: selectedOriginId, configs });
    setHasChanges(false);
  };

  // Resetar contadores
  const handleResetCounters = async () => {
    if (!selectedOriginId) return;
    await resetCountersMutation.mutateAsync(selectedOriginId);
  };

  // Usuários disponíveis para adicionar (não estão na config)
  const usersToAdd = availableUsers.filter(
    (u) => !localConfigs.some((c) => c.user_email === u.email)
  );

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Shuffle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Distribuição de Leads</h1>
          <p className="text-muted-foreground">
            Configure a distribuição automática de leads por pipeline
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configurar Distribuição
          </CardTitle>
          <CardDescription>
            Defina a porcentagem de leads que cada SDR/Closer receberá automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seletor de Grupo (Pipeline) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pipeline (Grupo)</label>
            <Select 
              value={selectedGroupId || ""} 
              onValueChange={(value) => {
                setSelectedGroupId(value);
                setSelectedOriginId(null); // Reset origin ao mudar grupo
                setLocalConfigs([]);
                setHasChanges(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.display_name || group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Origin (só aparece após selecionar grupo) */}
          {selectedGroupId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Origin (Sub-pipeline)</label>
              <Select 
                value={selectedOriginId || ""} 
                onValueChange={(value) => {
                  setSelectedOriginId(value);
                  setHasChanges(false);
                }}
                disabled={isLoadingOrigins}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingOrigins ? "Carregando..." : "Selecione uma origin..."} />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((origin) => (
                    <SelectItem key={origin.id} value={origin.id}>
                      {origin.display_name || origin.name}
                    </SelectItem>
                  ))}
                  {origins.length === 0 && !isLoadingOrigins && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Nenhuma origin encontrada neste pipeline
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedOriginId && (
            <>
              {/* Barra de ações */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={usersToAdd.length === 0}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Usuário
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <ScrollArea className="h-[200px]">
                        {usersToAdd.map((user) => (
                          <DropdownMenuItem
                            key={user.email}
                            onClick={() => handleAddUser(user)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <span className="flex-1 truncate">{user.name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {user.role.toUpperCase()}
                              </Badge>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        {usersToAdd.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Todos os usuários já foram adicionados
                          </div>
                        )}
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="outline" onClick={handleDistributeEqually}>
                    <Percent className="h-4 w-4 mr-2" />
                    Distribuir Igualmente
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={isValidTotal || localConfigs.length === 0 ? "default" : "destructive"}
                    className="text-sm"
                  >
                    Total: {totalPercentage.toFixed(1)}%
                  </Badge>
                  {!isValidTotal && localConfigs.some((c) => c.is_active) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>

              {/* Tabela de configuração */}
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : localConfigs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum usuário configurado. Adicione SDRs ou Closers para configurar a distribuição.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="w-[120px] text-center">Percentual</TableHead>
                      <TableHead className="w-[100px] text-center">Leads</TableHead>
                      <TableHead className="w-[80px] text-center">Ativo</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localConfigs.map((config) => (
                      <TableRow key={config.user_email}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{config.user_name}</p>
                            <p className="text-xs text-muted-foreground">{config.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={config.percentage}
                              onChange={(e) =>
                                handlePercentageChange(config.user_email, e.target.value)
                              }
                              className="w-20 text-center"
                              disabled={!config.is_active}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{config.current_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={config.is_active}
                            onCheckedChange={() => handleToggleActive(config.user_email)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUser(config.user_email)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Ações finais */}
              <div className="flex items-center justify-between pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={localConfigs.length === 0}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Resetar Contadores
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resetar contadores?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso vai zerar a contagem de leads distribuídos para todos os usuários
                        desta pipeline. Use isso no início de um novo período.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetCounters}>
                        Resetar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLocalConfigs(
                        currentConfig.map((c) => ({
                          user_email: c.user_email,
                          user_name: c.user_name || c.user_email.split("@")[0],
                          percentage: Number(c.percentage),
                          is_active: c.is_active,
                          current_count: c.current_count,
                        }))
                      );
                      setHasChanges(false);
                    }}
                    disabled={!hasChanges}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={
                      !hasChanges ||
                      saveConfigMutation.isPending ||
                      (!isValidTotal && localConfigs.some((c) => c.is_active))
                    }
                  >
                    {saveConfigMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Configuração
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
