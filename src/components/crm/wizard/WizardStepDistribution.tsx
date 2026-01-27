import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Scale, Users } from 'lucide-react';
import { WizardData, WizardDistribution } from './types';
import { cn } from '@/lib/utils';

interface WizardStepDistributionProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}

export const WizardStepDistribution = ({ data, onChange, errors }: WizardStepDistributionProps) => {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch SDRs and Closers
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Use RPC or direct fetch to avoid type instantiation issues
        const client = supabase as any;
        
        const { data: profilesData } = await client
          .from('profiles')
          .select('id, email, full_name')
          .eq('is_active', true)
          .order('full_name');
        
        if (!profilesData) {
          setUsers([]);
          return;
        }
        
        const { data: rolesData } = await client
          .from('user_roles')
          .select('user_id, role')
          .in('role', ['sdr', 'closer']);
        
        if (!rolesData) {
          setUsers([]);
          return;
        }
        
        const sdrCloserUserIds = new Set(rolesData.map((r: any) => r.user_id));
        
        const filteredUsers = profilesData
          .filter((p: any) => sdrCloserUserIds.has(p.id))
          .map((p: any) => ({
            id: p.id,
            email: p.email || '',
            full_name: p.full_name || p.email || '',
          }));
        
        setUsers(filteredUsers);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const availableUsers = users.filter(
    (user) => !data.distribution.some((d) => d.user_email === user.email)
  );

  const addUser = () => {
    if (!selectedEmail) return;
    const user = users.find((u) => u.email === selectedEmail);
    if (!user) return;

    const newDistribution: WizardDistribution = {
      user_email: user.email,
      user_name: user.full_name || user.email,
      percentage: 0,
      is_active: true,
    };

    onChange({ distribution: [...data.distribution, newDistribution] });
    setSelectedEmail('');
  };

  const updateDistribution = (email: string, updates: Partial<WizardDistribution>) => {
    const updated = data.distribution.map((d) =>
      d.user_email === email ? { ...d, ...updates } : d
    );
    onChange({ distribution: updated });
  };

  const removeUser = (email: string) => {
    onChange({ distribution: data.distribution.filter((d) => d.user_email !== email) });
  };

  const distributeEqually = () => {
    const activeCount = data.distribution.filter((d) => d.is_active).length;
    if (activeCount === 0) return;

    const equalPercentage = Math.floor(100 / activeCount);
    const remainder = 100 - equalPercentage * activeCount;

    let remainderAssigned = 0;
    const updated = data.distribution.map((d) => {
      if (!d.is_active) return { ...d, percentage: 0 };
      const extra = remainderAssigned < remainder ? 1 : 0;
      remainderAssigned++;
      return { ...d, percentage: equalPercentage + extra };
    });

    onChange({ distribution: updated });
  };

  const totalPercentage = data.distribution
    .filter((d) => d.is_active)
    .reduce((sum, d) => sum + d.percentage, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Distribuição de Leads</h3>
          <p className="text-sm text-muted-foreground">
            Configure quem receberá os novos leads e em qual proporção. (Opcional)
          </p>
        </div>
        {data.distribution.length > 0 && (
          <Button variant="outline" size="sm" onClick={distributeEqually}>
            <Scale className="h-4 w-4 mr-2" />
            Distribuir Igualmente
          </Button>
        )}
      </div>

      {errors.distribution && (
        <p className="text-sm text-destructive">{errors.distribution}</p>
      )}

      {/* User List */}
      {data.distribution.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/20">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum usuário adicionado</p>
          <p className="text-sm text-muted-foreground">
            A distribuição de leads é opcional. Se não configurada, os leads não serão atribuídos automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.distribution.map((dist) => (
            <div
              key={dist.user_email}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg border bg-background",
                !dist.is_active && "opacity-50"
              )}
            >
              {/* Active Toggle */}
              <Switch
                checked={dist.is_active}
                onCheckedChange={(checked) =>
                  updateDistribution(dist.user_email, { is_active: checked })
                }
              />

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{dist.user_name}</p>
                <p className="text-sm text-muted-foreground truncate">{dist.user_email}</p>
              </div>

              {/* Percentage */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={dist.percentage}
                  onChange={(e) =>
                    updateDistribution(dist.user_email, {
                      percentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)),
                    })
                  }
                  className="w-20 text-center"
                  disabled={!dist.is_active}
                />
                <span className="text-muted-foreground">%</span>
              </div>

              {/* Remove */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeUser(dist.user_email)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add User */}
      <div className="flex gap-2">
        <Select value={selectedEmail} onValueChange={setSelectedEmail}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um usuário para adicionar"} />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {availableUsers.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                {isLoading ? 'Carregando usuários...' : 'Todos os usuários já foram adicionados'}
              </div>
            ) : (
              availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.email}>
                  {user.full_name || user.email}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button onClick={addUser} disabled={!selectedEmail}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>

      {/* Total */}
      {data.distribution.length > 0 && (
        <div className={cn(
          "flex justify-between items-center p-3 rounded-lg border",
          totalPercentage === 100 ? "bg-primary/10 border-primary/50" : 
          totalPercentage > 100 ? "bg-destructive/10 border-destructive/50" :
          "bg-accent/50 border-accent"
        )}>
          <span className="font-medium">Total:</span>
          <span className={cn(
            "font-bold text-lg",
            totalPercentage === 100 ? "text-primary" :
            totalPercentage > 100 ? "text-destructive" : "text-accent-foreground"
          )}>
            {totalPercentage}%
          </span>
        </div>
      )}
    </div>
  );
};
