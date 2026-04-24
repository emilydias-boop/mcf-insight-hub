import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  Loader2, Shield, Settings, Link2, KeyRound, 
  Mail, Calendar, Clock, AlertTriangle, LogOut, RefreshCw, Trash2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUserDetails, useUserPermissions, useUserIntegrations } from "@/hooks/useUsers";
import { useRolesConfig } from "@/hooks/useRolesConfig";
import { 
  useUpdateUserRole, 
  useUpdateUserAccess, 
  useUpdateUserPermissions, 
  useUpdateUserIntegrations,
  useSendPasswordReset,
  useDeleteUser,
  useAddUserRole,
  useRemoveUserRole,
} from "@/hooks/useUserMutations";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AppRole, 
  ResourceType, 
  PermissionLevel, 
  AccessStatus,
  ACCESS_STATUS_LABELS,
  ROLE_LABELS,
  RESOURCE_LABELS
} from "@/types/user-management";
import { cn } from "@/lib/utils";

interface UserDetailsDrawerProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailsDrawer({ userId, open, onOpenChange }: UserDetailsDrawerProps) {
  const { data: userDetails, isLoading: loadingDetails } = useUserDetails(userId);
  const { data: permissions = [] } = useUserPermissions(userId);
  const { data: integrations } = useUserIntegrations(userId);
  const { roles: activeRoles } = useRolesConfig(true);
  const queryClient = useQueryClient();

  const updateRole = useUpdateUserRole();
  const addUserRole = useAddUserRole();
  const removeUserRole = useRemoveUserRole();
  const updateAccess = useUpdateUserAccess();
  const updatePermissions = useUpdateUserPermissions();
  const updateIntegrations = useUpdateUserIntegrations();
  const sendPasswordReset = useSendPasswordReset();
  const deleteUser = useDeleteUser();
  
  const [canBookR2, setCanBookR2] = useState(false);
  const [savingCanBookR2, setSavingCanBookR2] = useState(false);
  // Capabilities avançadas da agenda
  const [agendaCaps, setAgendaCaps] = useState({
    can_manage_agenda: false,
    can_handle_no_show: true,
    can_link_contract: false,
    can_cancel_meeting: false,
  });
  const [savingCapKey, setSavingCapKey] = useState<string | null>(null);
  // Form state for General tab
  const [generalData, setGeneralData] = useState({
    full_name: "",
    email: "",
    access_status: "ativo" as AccessStatus,
    squad: [] as string[],
  });

  // Form state for Security tab
  const [blockedUntil, setBlockedUntil] = useState<string>("");

  // Form state for Permissions tab
  const [permissionLevels, setPermissionLevels] = useState<Record<ResourceType, PermissionLevel>>(
    {} as Record<ResourceType, PermissionLevel>
  );
  const [viewingScope, setViewingScope] = useState<'own' | 'team' | 'company'>('own');

  // Form state for Integrations tab
  const [integrationsData, setIntegrationsData] = useState({
    clint_user_id: "",
    twilio_agent_id: "",
  });

  const allResources: ResourceType[] = [
    'dashboard', 'receita', 'custos', 'relatorios', 'alertas',
    'efeito_alavanca', 'projetos', 'credito', 'leilao', 'configuracoes',
    'crm', 'fechamento_sdr', 'tv_sdr', 'usuarios', 'agenda_r2'
  ];

  // Grouped resources for better organization
  const resourceGroups = {
    'Dashboards': ['dashboard', 'tv_sdr'] as ResourceType[],
    'CRM': ['crm', 'agenda_r2'] as ResourceType[],
    'Financeiro': ['receita', 'custos'] as ResourceType[],
    'Relatórios & Alertas': ['relatorios', 'alertas'] as ResourceType[],
    'SDR': ['fechamento_sdr'] as ResourceType[],
    'Sistema': ['configuracoes', 'usuarios'] as ResourceType[],
    'Outros': ['efeito_alavanca', 'projetos', 'credito', 'leilao'] as ResourceType[],
  };

  // Update form data when user details load
  useEffect(() => {
    if (userDetails) {
      setGeneralData({
        full_name: userDetails.full_name || "",
        email: userDetails.email || "",
        access_status: userDetails.access_status || "ativo",
        squad: userDetails.squad || [],
      });
      setBlockedUntil(userDetails.blocked_until || "");
      setCanBookR2(!!(userDetails as any).can_book_r2);
      setAgendaCaps({
        can_manage_agenda: !!(userDetails as any).can_manage_agenda,
        can_handle_no_show: (userDetails as any).can_handle_no_show ?? true,
        can_link_contract: !!(userDetails as any).can_link_contract,
        can_cancel_meeting: !!(userDetails as any).can_cancel_meeting,
      });
    }
  }, [userDetails]);

  // Update permission levels when permissions data loads
  useEffect(() => {
    if (permissions.length > 0 || userId) {
      const initial: Record<string, PermissionLevel> = {};
      allResources.forEach(resource => {
        const perm = permissions.find(p => p.resource === resource);
        initial[resource] = perm?.permission_level || 'none';
      });
      setPermissionLevels(initial as Record<ResourceType, PermissionLevel>);
      
      // Extract viewing scope from restrictions if exists
      const anyPerm = permissions.find(p => p.restrictions?.viewing_scope);
      if (anyPerm?.restrictions?.viewing_scope) {
        setViewingScope(anyPerm.restrictions.viewing_scope);
      }
    }
  }, [permissions, userId]);

  // Update integrations data when loaded
  useEffect(() => {
    if (integrations) {
      setIntegrationsData({
        clint_user_id: integrations.clint_user_id || "",
        twilio_agent_id: integrations.twilio_agent_id || "",
      });
    }
  }, [integrations]);

  const handleRoleChange = (role: AppRole) => {
    if (!userId) return;
    updateRole.mutate({ userId, role });
  };

  const userRoles: AppRole[] = ((userDetails as any)?.roles as AppRole[]) || (userDetails?.role ? [userDetails.role] : []);

  const handleToggleRole = (role: AppRole, checked: boolean) => {
    if (!userId) return;
    if (checked) {
      addUserRole.mutate({ userId, role });
    } else {
      if (userRoles.length <= 1) {
        toast.error("O usuário precisa ter ao menos um cargo.");
        return;
      }
      removeUserRole.mutate({ userId, role });
    }
  };

  const handleSaveGeneral = () => {
    if (!userId) return;
    updateAccess.mutate({ userId, data: generalData });
  };

  const handleToggleCanBookR2 = async (checked: boolean) => {
    if (!userId) return;
    setSavingCanBookR2(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ can_book_r2: checked } as any)
        .eq("id", userId);
      if (error) throw error;
      setCanBookR2(checked);
      queryClient.invalidateQueries({ queryKey: ["r2-bookers"] });
      toast.success(checked ? "Permissão R2 ativada" : "Permissão R2 desativada");
    } catch {
      toast.error("Erro ao atualizar permissão R2");
    } finally {
      setSavingCanBookR2(false);
    }
  };

  const handleToggleAgendaCap = async (
    key: 'can_manage_agenda' | 'can_handle_no_show' | 'can_link_contract' | 'can_cancel_meeting',
    checked: boolean
  ) => {
    if (!userId) return;
    setSavingCapKey(key);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: checked } as any)
        .eq('id', userId);
      if (error) throw error;
      setAgendaCaps((prev) => ({ ...prev, [key]: checked }));
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-agenda-capabilities'] });
      toast.success('Permissão atualizada');
    } catch {
      toast.error('Erro ao atualizar permissão');
    } finally {
      setSavingCapKey(null);
    }
  };

  const handleSaveBlockedUntil = () => {
    if (!userId) return;
    updateAccess.mutate({ 
      userId, 
      data: { blocked_until: blockedUntil || null } 
    });
  };

  const handleSendPasswordReset = async () => {
    if (!userDetails?.email) return;

    try {
      const result = await sendPasswordReset.mutateAsync({ email: userDetails.email });
      await navigator.clipboard.writeText(result.reset_link);
      toast.success("Link de redefinição copiado!", {
        description: "⚠️ Cada link funciona apenas UMA vez. Envie manualmente ao usuário (WhatsApp, email, etc). Se ele já usou ou expirou, gere outro.",
        duration: 8000,
      });
      
    } catch {
      // Toast handled in mutation
    }
  };

  const handlePermissionsUpdate = () => {
    if (!userId) return;
    const permsArray = Object.entries(permissionLevels).map(([resource, level]) => ({
      resource: resource as ResourceType,
      permission_level: level,
    }));
    updatePermissions.mutate({ userId, permissions: permsArray });
  };

  const handleSaveIntegrations = () => {
    if (!userId) return;
    updateIntegrations.mutate({ userId, data: integrationsData });
  };

  if (loadingDetails) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!userDetails) return null;

  const roleInfo = ROLE_LABELS[userDetails.role || 'viewer'] || ROLE_LABELS.viewer;
  const statusInfo = ACCESS_STATUS_LABELS[userDetails.access_status || 'ativo'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {/* ===== HEADER FIXO ===== */}
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {userDetails.full_name?.[0]?.toUpperCase() || userDetails.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground truncate">
                {userDetails.full_name || "Sem nome"}
              </h2>
              <p className="text-sm text-muted-foreground truncate">{userDetails.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
                  {statusInfo.label}
                </Badge>
                <Badge variant="outline" className={cn("text-xs", roleInfo.color)}>
                  {roleInfo.label}
                </Badge>
              </div>
            </div>
            {/* Delete user button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir <strong>{userDetails.full_name || userDetails.email}</strong>? 
                    Esta ação é irreversível e removerá todos os dados do usuário.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      if (userId) {
                        deleteUser.mutate(userId, {
                          onSuccess: () => onOpenChange(false),
                        });
                      }
                    }}
                    disabled={deleteUser.isPending}
                  >
                    {deleteUser.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          {/* Info dates */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Criado: {userDetails.created_at 
                ? format(new Date(userDetails.created_at), "dd/MM/yyyy", { locale: ptBR }) 
                : "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Último login: {userDetails.last_login_at 
                ? format(new Date(userDetails.last_login_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) 
                : "Nunca"}</span>
            </div>
          </div>
        </SheetHeader>

        {/* ===== TABS ===== */}
        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="text-xs">
              <Settings className="h-3 w-3 mr-1" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs">
              <KeyRound className="h-3 w-3 mr-1" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs">
              <Link2 className="h-3 w-3 mr-1" />
              Integrações
            </TabsTrigger>
          </TabsList>

          {/* ===== ABA GERAL ===== */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informações de Acesso</CardTitle>
                <CardDescription>Dados básicos da conta do usuário</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input
                      value={generalData.full_name}
                      onChange={(e) => setGeneralData({ ...generalData, full_name: e.target.value })}
                      placeholder="Nome do usuário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email de login</Label>
                    <Input
                      type="email"
                      value={generalData.email}
                      onChange={(e) => setGeneralData({ ...generalData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">Email não pode ser alterado</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cargo primário</Label>
                    <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/30 text-sm flex items-center">
                      <Badge variant="outline" className={cn("text-xs", roleInfo.color)}>
                        {roleInfo.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        (definido pela prioridade dos cargos selecionados abaixo)
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status de acesso</Label>
                    <Select 
                      value={generalData.access_status} 
                      onValueChange={(value: AccessStatus) => setGeneralData({ ...generalData, access_status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">✅ Ativo</SelectItem>
                        <SelectItem value="bloqueado">🚫 Bloqueado</SelectItem>
                        <SelectItem value="desativado">⏸️ Desativado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Business Units (BUs)</Label>
                  <div className="space-y-2 p-3 border rounded-md">
                    {[
                      { value: 'incorporador', label: 'BU - Incorporador MCF' },
                      { value: 'consorcio', label: 'BU - Consórcio' },
                      { value: 'credito', label: 'BU - Crédito' },
                      { value: 'projetos', label: 'BU - Projetos' },
                      { value: 'leilao', label: 'BU - Leilão' },
                      { value: 'marketing', label: 'BU - Marketing' },
                    ].map((bu) => (
                      <label key={bu.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generalData.squad.includes(bu.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGeneralData({ ...generalData, squad: [...generalData.squad, bu.value] });
                            } else {
                              setGeneralData({ ...generalData, squad: generalData.squad.filter(s => s !== bu.value) });
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{bu.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Define quais BUs o usuário pode visualizar no menu</p>
                </div>

                <Separator />

                {/* ===== Cargos no sistema (multi-role) ===== */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cargos no sistema</Label>
                    <span className="text-xs text-muted-foreground">
                      {userRoles.length} {userRoles.length === 1 ? 'cargo' : 'cargos'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione um ou mais cargos. O cargo de maior prioridade vira o primário (define dashboards padrão).
                    Útil em períodos de migração (ex: SDR que está virando Closer).
                  </p>
                  <div className="space-y-2 p-3 border rounded-md max-h-64 overflow-y-auto">
                    {activeRoles.map((r) => {
                      const roleKey = r.role_key as AppRole;
                      const isChecked = userRoles.includes(roleKey);
                      const isPrimary = userDetails.role === roleKey;
                      const isLastRole = isChecked && userRoles.length === 1;
                      const isSaving = (addUserRole.isPending || removeUserRole.isPending);
                      return (
                        <label
                          key={r.role_key}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer py-1",
                            isLastRole && "cursor-not-allowed opacity-80"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isSaving || isLastRole}
                            onChange={(e) => handleToggleRole(roleKey, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{r.label}</span>
                          {isPrimary && (
                            <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                              primário
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ O usuário precisa fazer logout/login para o novo cargo passar a valer (refresh do JWT).
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode agendar R2</Label>
                    <p className="text-xs text-muted-foreground">Aparece como responsável no agendamento de R2</p>
                  </div>
                  <Switch
                    checked={canBookR2}
                    onCheckedChange={handleToggleCanBookR2}
                    disabled={savingCanBookR2}
                  />
                </div>

                <Button 
                  onClick={handleSaveGeneral} 
                  className="w-full"
                  disabled={updateAccess.isPending}
                >
                  {updateAccess.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar dados do usuário
                </Button>
              </CardContent>
            </Card>

            {/* ===== Permissões avançadas da Agenda ===== */}
            {userDetails.role && !['admin', 'manager', 'coordenador'].includes(userDetails.role) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Permissões avançadas da Agenda</CardTitle>
                  <CardDescription>
                    Libere ações de gestor para este usuário (mantém o cargo atual). Admins, managers e coordenadores já têm tudo liberado por padrão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      key: 'can_manage_agenda' as const,
                      label: 'Gerenciar agenda',
                      hint: 'Voltar p/ agendada, marcar como Realizada, remanejar/mover leads sem aplicar No-Show',
                    },
                    {
                      key: 'can_handle_no_show' as const,
                      label: 'Tratar No-Show',
                      hint: 'Aplicar status de No-Show em reuniões',
                    },
                    {
                      key: 'can_link_contract' as const,
                      label: 'Vincular contratos pagos',
                      hint: 'Botão "Vincular Contrato" e marcar Contrato Pago manualmente',
                    },
                    {
                      key: 'can_cancel_meeting' as const,
                      label: 'Cancelar / excluir reuniões',
                      hint: 'Cancelar, restaurar e excluir reuniões da agenda',
                    },
                  ].map((cap) => (
                    <div key={cap.key} className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <Label>{cap.label}</Label>
                        <p className="text-xs text-muted-foreground">{cap.hint}</p>
                      </div>
                      <Switch
                        checked={agendaCaps[cap.key]}
                        onCheckedChange={(v) => handleToggleAgendaCap(cap.key, v)}
                        disabled={savingCapKey === cap.key}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== ABA SEGURANÇA ===== */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações de Segurança</CardTitle>
                <CardDescription>Gerenciar credenciais e sessões</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleSendPasswordReset}
                  disabled={sendPasswordReset.isPending}
                >
                  {sendPasswordReset.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Gerar link de reset de senha
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  disabled
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Forçar logout em todos os dispositivos
                  <Badge variant="secondary" className="ml-auto text-xs">Em breve</Badge>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bloqueio Temporário</CardTitle>
                <CardDescription>
                  Se preenchido, o usuário não poderá fazer login até a data/hora especificada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Bloquear login até</Label>
                    <Input
                      type="datetime-local"
                      value={blockedUntil ? blockedUntil.slice(0, 16) : ""}
                      onChange={(e) => setBlockedUntil(e.target.value ? new Date(e.target.value).toISOString() : "")}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setBlockedUntil("")}
                    className="mt-6"
                  >
                    Limpar
                  </Button>
                </div>
                {blockedUntil && (
                  <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500">
                      Usuário bloqueado até {format(new Date(blockedUntil), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <Button 
                  onClick={handleSaveBlockedUntil} 
                  variant="secondary"
                  size="sm"
                  disabled={updateAccess.isPending}
                >
                  Salvar bloqueio
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Histórico de Login</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum registro de login disponível.</p>
                  <p className="text-xs mt-1">Os logs de autenticação não estão sendo capturados no momento.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== ABA PERMISSÕES ===== */}
          <TabsContent value="permissions" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Permissões por Módulo</CardTitle>
                <CardDescription>Defina o nível de acesso para cada área do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(resourceGroups).map(([groupName, resources]) => (
                  <div key={groupName} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{groupName}</h4>
                    <div className="space-y-2 pl-2">
                      {resources.map((resource) => (
                        <div key={resource} className="flex items-center justify-between py-1">
                          <Label className="text-sm font-normal">{RESOURCE_LABELS[resource]}</Label>
                          <Select
                            value={permissionLevels[resource] || 'none'}
                            onValueChange={(value: PermissionLevel) =>
                              setPermissionLevels({ ...permissionLevels, [resource]: value })
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              <SelectItem value="view">Visualizar</SelectItem>
                              <SelectItem value="edit">Editar</SelectItem>
                              <SelectItem value="full">Completo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Escopo de Visualização</CardTitle>
                <CardDescription>Define quais dados o usuário pode ver</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-2">
                  {[
                    { value: 'own', label: 'Apenas os próprios dados' },
                    { value: 'team', label: 'Equipe (se gestor)' },
                    { value: 'company', label: 'Empresa inteira (se diretor/admin)' },
                  ].map((option) => (
                    <label 
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="viewingScope"
                        value={option.value}
                        checked={viewingScope === option.value}
                        onChange={(e) => setViewingScope(e.target.value as any)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handlePermissionsUpdate} 
              className="w-full"
              disabled={updatePermissions.isPending}
            >
              {updatePermissions.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar Permissões
            </Button>
          </TabsContent>

          {/* ===== ABA INTEGRAÇÕES ===== */}
          <TabsContent value="integrations" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">IDs de Integrações Externas</CardTitle>
                <CardDescription>Vincule o usuário a sistemas externos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Clint User ID</Label>
                  <Input
                    value={integrationsData.clint_user_id}
                    onChange={(e) => setIntegrationsData({ ...integrationsData, clint_user_id: e.target.value })}
                    placeholder="ID histórico do usuário no Clint CRM"
                  />
                  <p className="text-xs text-muted-foreground">
                    Campo mantido apenas como referência histórica (integração Clint encerrada).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Twilio Agent / Ramal</Label>
                  <Input
                    value={integrationsData.twilio_agent_id}
                    onChange={(e) => setIntegrationsData({ ...integrationsData, twilio_agent_id: e.target.value })}
                    placeholder="ID do agente ou número do ramal"
                  />
                </div>

                <Button 
                  onClick={handleSaveIntegrations} 
                  className="w-full"
                  disabled={updateIntegrations.isPending}
                >
                  {updateIntegrations.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salvar Integrações
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sincronização</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  disabled
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-sincronizar com Clint
                  <Badge variant="secondary" className="ml-auto text-xs">Em breve</Badge>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
