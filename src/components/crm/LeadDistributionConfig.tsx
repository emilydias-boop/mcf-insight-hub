import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, RefreshCw, Save, Percent } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useDistributionConfig,
  useSaveDistributionConfig,
  useResetDistributionCounters,
  DistributionConfigInput,
} from '@/hooks/useLeadDistribution';
import { toast } from 'sonner';

interface LocalConfig {
  user_email: string;
  user_name: string;
  percentage: number;
  is_active: boolean;
  current_count: number;
}

interface LeadDistributionConfigProps {
  originId: string;
  originName: string;
}

export const LeadDistributionConfig = ({ originId, originName }: LeadDistributionConfigProps) => {
  const [localConfigs, setLocalConfigs] = useState<LocalConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Buscar SDRs e Closers
  const { data: availableUsers = [] } = useQuery({
    queryKey: ["sdr-closer-users-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            email,
            full_name
          )
        `)
        .in("role", ["sdr", "closer"]);
      if (error) throw error;
      
      const uniqueUsers = new Map();
      data?.forEach((item: any) => {
        if (item.profiles?.email && !uniqueUsers.has(item.profiles.email)) {
          uniqueUsers.set(item.profiles.email, {
            email: item.profiles.email,
            name: item.profiles.full_name || item.profiles.email,
            role: item.role,
          });
        }
      });
      return Array.from(uniqueUsers.values());
    },
  });

  // Buscar configuração existente
  const { data: existingConfigs = [], isLoading } = useDistributionConfig(originId);
  const saveConfig = useSaveDistributionConfig();
  const resetCounters = useResetDistributionCounters();

  // Sincronizar com dados existentes
  useEffect(() => {
    if (existingConfigs.length > 0) {
      setLocalConfigs(
        existingConfigs.map((c) => ({
          user_email: c.user_email,
          user_name: c.user_name || c.user_email,
          percentage: c.percentage,
          is_active: c.is_active,
          current_count: c.current_count,
        }))
      );
      setHasChanges(false);
    } else {
      setLocalConfigs([]);
      setHasChanges(false);
    }
  }, [existingConfigs]);

  const totalPercentage = localConfigs.reduce((sum, c) => sum + (c.is_active ? c.percentage : 0), 0);

  const handleAddUser = (email: string) => {
    const user = availableUsers.find((u) => u.email === email);
    if (!user) return;
    if (localConfigs.some((c) => c.user_email === email)) {
      toast.error("Usuário já adicionado");
      return;
    }
    setLocalConfigs((prev) => [
      ...prev,
      {
        user_email: email,
        user_name: user.name,
        percentage: 0,
        is_active: true,
        current_count: 0,
      },
    ]);
    setHasChanges(true);
  };

  const handleRemoveUser = (email: string) => {
    setLocalConfigs((prev) => prev.filter((c) => c.user_email !== email));
    setHasChanges(true);
  };

  const handlePercentageChange = (email: string, value: number) => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.user_email === email ? { ...c, percentage: Math.min(100, Math.max(0, value)) } : c))
    );
    setHasChanges(true);
  };

  const handleToggleActive = (email: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.user_email === email ? { ...c, is_active: !c.is_active } : c)));
    setHasChanges(true);
  };

  const handleDistributeEqually = () => {
    const activeCount = localConfigs.filter((c) => c.is_active).length;
    if (activeCount === 0) return;
    const equalPercentage = Math.floor(100 / activeCount);
    const remainder = 100 - equalPercentage * activeCount;

    let assignedRemainder = 0;
    setLocalConfigs((prev) =>
      prev.map((c, idx) => {
        if (!c.is_active) return c;
        const extra = assignedRemainder < remainder ? 1 : 0;
        assignedRemainder++;
        return { ...c, percentage: equalPercentage + extra };
      })
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    if (totalPercentage !== 100) {
      toast.error("O total dos percentuais deve ser 100%");
      return;
    }

    const configs: DistributionConfigInput[] = localConfigs.map((c) => ({
      origin_id: originId,
      user_email: c.user_email,
      user_name: c.user_name,
      percentage: c.percentage,
      is_active: c.is_active,
    }));

    saveConfig.mutate({ originId, configs }, {
      onSuccess: () => setHasChanges(false),
    });
  };

  const handleResetCounters = () => {
    resetCounters.mutate(originId);
  };

  const usedEmails = localConfigs.map((c) => c.user_email);
  const availableToAdd = availableUsers.filter((u) => !usedEmails.includes(u.email));

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando configurações...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure como os leads são distribuídos entre os responsáveis para esta origin.
        </p>
        <Badge variant={totalPercentage === 100 ? "default" : "destructive"}>
          {totalPercentage}%
        </Badge>
      </div>

      {/* Ações */}
      <div className="flex gap-2 flex-wrap">
        <Select onValueChange={handleAddUser}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Adicionar usuário..." />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                Todos os usuários já foram adicionados
              </div>
            ) : (
              availableToAdd.map((user) => (
                <SelectItem key={user.email} value={user.email}>
                  {user.name} ({user.role})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleDistributeEqually} disabled={localConfigs.length === 0}>
          <Percent className="h-4 w-4 mr-1" />
          Distribuir Igual
        </Button>
      </div>

      {/* Tabela */}
      {localConfigs.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-[100px]">Percentual</TableHead>
                <TableHead className="w-[80px] text-center">Leads</TableHead>
                <TableHead className="w-[80px] text-center">Ativo</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localConfigs.map((config) => (
                <TableRow key={config.user_email} className={!config.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{config.user_name}</p>
                      <p className="text-xs text-muted-foreground">{config.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={config.percentage}
                        onChange={(e) => handlePercentageChange(config.user_email, parseInt(e.target.value) || 0)}
                        className="w-16 h-8 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{config.current_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={config.is_active} onCheckedChange={() => handleToggleActive(config.user_email)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveUser(config.user_email)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-md p-8 text-center text-muted-foreground">
          <p className="text-sm">Nenhum usuário configurado para distribuição.</p>
          <p className="text-xs mt-1">Use o seletor acima para adicionar usuários.</p>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetCounters}
          disabled={resetCounters.isPending || localConfigs.length === 0}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${resetCounters.isPending ? "animate-spin" : ""}`} />
          Resetar Contadores
        </Button>

        <Button onClick={handleSave} disabled={!hasChanges || saveConfig.isPending || totalPercentage !== 100}>
          <Save className="h-4 w-4 mr-1" />
          {saveConfig.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {totalPercentage !== 100 && localConfigs.length > 0 && (
        <p className="text-xs text-destructive text-center">
          O total dos percentuais deve somar 100%. Atual: {totalPercentage}%
        </p>
      )}
    </div>
  );
};
