import { useState, useEffect } from 'react';
import { Employee } from '@/types/hr';
import { useEmployeeMutations } from '@/hooks/useEmployees';
import { useUsers, useUserPermissions, useUserIntegrations } from '@/hooks/useUsers';
import { ResourceType, PermissionLevel, AppRole } from '@/types/user-management';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2, Shield, Plug, Save, Loader2, Search, Unlink, Check } from 'lucide-react';
import { toast } from 'sonner';

interface EmployeePermissionsTabProps {
  employee: Employee;
}

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'sdr', label: 'SDR' },
  { value: 'closer', label: 'Closer' },
  { value: 'closer_sombra', label: 'Closer Sombra' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'manager', label: 'Gestor' },
  { value: 'rh', label: 'RH' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'admin', label: 'Admin' },
];

const RESOURCE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: 'crm', label: 'CRM' },
  { value: 'dashboard', label: 'Dashboard Master' },
  { value: 'fechamento_sdr', label: 'Fechamento SDR' },
  { value: 'tv_sdr', label: 'TV SDR' },
  { value: 'financeiro', label: 'Módulo Financeiro' },
  { value: 'relatorios', label: 'Relatórios' },
];

const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'view', label: 'Visualizar' },
  { value: 'full', label: 'Completo' },
];

export default function EmployeePermissionsTab({ employee }: EmployeePermissionsTabProps) {
  const { data: users, isLoading: usersLoading } = useUsers();
  const { updateEmployee } = useEmployeeMutations();
  
  const linkedUserId = employee.user_id || employee.profile_id;
  const { data: permissions, isLoading: permissionsLoading, refetch: refetchPermissions } = useUserPermissions(linkedUserId);
  const { data: integrations, isLoading: integrationsLoading, refetch: refetchIntegrations } = useUserIntegrations(linkedUserId);
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(linkedUserId);
  const [userRole, setUserRole] = useState<AppRole | ''>('');
  const [resourcePermissions, setResourcePermissions] = useState<Record<ResourceType, PermissionLevel>>({} as Record<ResourceType, PermissionLevel>);
  const [clintUserId, setClintUserId] = useState('');
  const [twilioAgentId, setTwilioAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchingClint, setSearchingClint] = useState(false);

  // Find linked user email
  const linkedUser = users?.find(u => u.user_id === linkedUserId);

  // Load current role
  useEffect(() => {
    if (linkedUserId) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', linkedUserId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUserRole(data.role as AppRole);
        });
    }
  }, [linkedUserId]);

  // Load permissions
  useEffect(() => {
    if (permissions) {
      const perms: Record<ResourceType, PermissionLevel> = {} as Record<ResourceType, PermissionLevel>;
      permissions.forEach((p) => {
        perms[p.resource] = p.permission_level;
      });
      setResourcePermissions(perms);
    }
  }, [permissions]);

  // Load integrations
  useEffect(() => {
    if (integrations) {
      setClintUserId(integrations.clint_user_id || '');
      setTwilioAgentId(integrations.twilio_agent_id || '');
    }
  }, [integrations]);

  const handleLinkUser = async () => {
    if (!selectedUserId) return;
    
    setSaving(true);
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: { user_id: selectedUserId, profile_id: selectedUserId }
      });
      toast.success('Usuário vinculado com sucesso');
      refetchPermissions();
      refetchIntegrations();
    } catch (error: any) {
      toast.error('Erro ao vincular usuário: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkUser = async () => {
    setSaving(true);
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: { user_id: null, profile_id: null }
      });
      setSelectedUserId(null);
      setUserRole('');
      setResourcePermissions({} as Record<ResourceType, PermissionLevel>);
      toast.success('Usuário desvinculado');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!linkedUserId || !userRole) return;
    
    setSaving(true);
    try {
      // First check if role exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', linkedUserId)
        .maybeSingle();
      
      if (existingRole) {
        // Update
        const { error } = await supabase
          .from('user_roles')
          .update({ role: userRole })
          .eq('user_id', linkedUserId);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: linkedUserId, role: userRole });
        if (error) throw error;
      }
      
      toast.success('Perfil atualizado');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!linkedUserId) return;
    
    setSaving(true);
    try {
      // Delete existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', linkedUserId);

      // Insert new permissions
      const permissionsToInsert = Object.entries(resourcePermissions)
        .filter(([_, level]) => level !== 'none')
        .map(([resource, level]) => ({
          user_id: linkedUserId,
          resource: resource as ResourceType,
          permission_level: level as PermissionLevel,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);
        
        if (error) throw error;
      }
      
      toast.success('Permissões salvas');
      refetchPermissions();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegrations = async () => {
    if (!linkedUserId) return;
    
    setSaving(true);
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('user_integrations')
        .select('id')
        .eq('user_id', linkedUserId)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('user_integrations')
          .update({
            clint_user_id: clintUserId || null,
            twilio_agent_id: twilioAgentId || null,
          })
          .eq('user_id', linkedUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_integrations')
          .insert({
            user_id: linkedUserId,
            clint_user_id: clintUserId || null,
            twilio_agent_id: twilioAgentId || null,
          });
        if (error) throw error;
      }
      
      toast.success('Integrações salvas');
      refetchIntegrations();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchClint = async () => {
    if (!linkedUser?.email) return;
    
    setSearchingClint(true);
    try {
      const { data, error } = await supabase.functions.invoke('clint-api', {
        body: { resource: 'users' }
      });
      
      if (error) throw error;
      
      const clintUser = data?.data?.find((u: any) => 
        u.email?.toLowerCase() === linkedUser.email?.toLowerCase()
      );
      
      if (clintUser) {
        setClintUserId(clintUser.id);
        toast.success('Usuário encontrado no Clint');
      } else {
        toast.info('Nenhum usuário encontrado com este email no Clint');
      }
    } catch (error: any) {
      toast.error('Erro ao buscar no Clint: ' + error.message);
    } finally {
      setSearchingClint(false);
    }
  };

  if (usersLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* User Linking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Vínculo com Usuário do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedUserId ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuário vinculado:</p>
                <p className="font-medium">{linkedUser?.email || linkedUserId}</p>
                {linkedUser?.full_name && (
                  <p className="text-sm text-muted-foreground">{linkedUser.full_name}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleUnlinkUser} disabled={saving}>
                <Unlink className="h-4 w-4 mr-1" />
                Desvincular
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Selecionar usuário para vincular</Label>
              <div className="flex gap-2">
                <Select value={selectedUserId || ''} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || user.email} {user.email && `(${user.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleLinkUser} disabled={!selectedUserId || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Selection */}
      {linkedUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Perfil Principal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={userRole} onValueChange={(v) => setUserRole(v as AppRole)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o perfil..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSaveRole} disabled={!userRole || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource Permissions */}
      {linkedUserId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissões por Módulo
            </CardTitle>
            <Button size="sm" onClick={handleSavePermissions} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </CardHeader>
          <CardContent>
            {permissionsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {RESOURCE_OPTIONS.map((resource) => (
                  <div key={resource.value} className="flex items-center justify-between">
                    <Label className="font-normal">{resource.label}</Label>
                    <Select 
                      value={resourcePermissions[resource.value] || 'none'} 
                      onValueChange={(v) => setResourcePermissions({ ...resourcePermissions, [resource.value]: v as PermissionLevel })}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERMISSION_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Integrations */}
      {linkedUserId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4" />
              Integrações Externas
            </CardTitle>
            <Button size="sm" onClick={handleSaveIntegrations} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </CardHeader>
          <CardContent>
            {integrationsLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Clint User ID</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={clintUserId} 
                      onChange={(e) => setClintUserId(e.target.value)}
                      placeholder="ID do usuário no Clint"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleSearchClint}
                      disabled={searchingClint || !linkedUser?.email}
                    >
                      {searchingClint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Twilio Agent ID</Label>
                  <Input 
                    value={twilioAgentId} 
                    onChange={(e) => setTwilioAgentId(e.target.value)}
                    placeholder="ID do agente no Twilio"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!linkedUserId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Vincule um usuário do sistema para gerenciar permissões e integrações.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
