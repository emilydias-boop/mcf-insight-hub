import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Target as TargetIcon, Flag, FileText, Shield, Loader2, BookOpen } from "lucide-react";
import { PlaybookUserProgress } from "@/components/playbook/PlaybookUserProgress";
import { useUserDetails, useUserTargets, useUserFlags, useUserObservations, useUserPermissions } from "@/hooks/useUsers";
import { useUpdateUserRole, useUpdateUserEmployment, useCreateUserTarget, useUpdateUserTarget, useCreateUserFlag, useResolveUserFlag, useCreateUserObservation, useUpdateUserPermissions } from "@/hooks/useUserMutations";
import { UserTargetsForm } from "./UserTargetsForm";
import { UserFlagForm } from "./UserFlagForm";
import { UserObservationForm } from "./UserObservationForm";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { AppRole, ResourceType, PermissionLevel, UserStatus } from "@/types/user-management";

interface UserDetailsDrawerProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailsDrawer({ userId, open, onOpenChange }: UserDetailsDrawerProps) {
  const { data: userDetails, isLoading: loadingDetails } = useUserDetails(userId);
  const { data: targets = [], isLoading: loadingTargets } = useUserTargets(userId);
  const { data: flags = [], isLoading: loadingFlags } = useUserFlags(userId);
  const { data: observations = [], isLoading: loadingObservations } = useUserObservations(userId);
  const { data: permissions = [], isLoading: loadingPermissions } = useUserPermissions(userId);

  const updateRole = useUpdateUserRole();
  const updateEmployment = useUpdateUserEmployment();
  const createTarget = useCreateUserTarget();
  const updateTarget = useUpdateUserTarget();
  const createFlag = useCreateUserFlag();
  const resolveFlag = useResolveUserFlag();
  const createObservation = useCreateUserObservation();
  const updatePermissions = useUpdateUserPermissions();

  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [showObservationForm, setShowObservationForm] = useState(false);
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; flagId: string; notes: string }>({
    open: false,
    flagId: "",
    notes: "",
  });
  const [editingTarget, setEditingTarget] = useState<any>(null);

  // Employment form state
  const [employmentData, setEmploymentData] = useState({
    position: "",
    department: "",
    hire_date: "",
    fixed_salary: 0,
    ote: 0,
    commission_rate: 0,
    status: "ativo" as UserStatus,
  });

  // Update employment data when user details load
  useEffect(() => {
    if (userDetails) {
      setEmploymentData({
        position: userDetails.employment?.position || "",
        department: userDetails.employment?.department || "",
        hire_date: userDetails.employment?.hire_date || "",
        fixed_salary: userDetails.employment?.fixed_salary || 0,
        ote: userDetails.employment?.ote || 0,
        commission_rate: userDetails.employment?.commission_rate || 0,
        status: userDetails.employment?.status || "ativo",
      });
    }
  }, [userDetails]);

  const handleRoleChange = (role: AppRole) => {
    if (!userId) return;
    updateRole.mutate({ userId, role });
  };

  const handleEmploymentUpdate = () => {
    if (!userId) return;
    updateEmployment.mutate({ userId, data: employmentData });
  };

  const handleResolveFlag = () => {
    if (!userId || !resolveDialog.flagId) return;
    resolveFlag.mutate(
      {
        id: resolveDialog.flagId,
        userId,
        notes: resolveDialog.notes,
      },
      {
        onSuccess: () => {
          setResolveDialog({ open: false, flagId: "", notes: "" });
        },
      }
    );
  };

  const allResources: ResourceType[] = [
    'dashboard', 'receita', 'custos', 'relatorios', 'alertas',
    'efeito_alavanca', 'projetos', 'credito', 'leilao', 'configuracoes',
    'crm', 'fechamento_sdr', 'tv_sdr', 'usuarios'
  ];

  const [permissionLevels, setPermissionLevels] = useState<Record<ResourceType, PermissionLevel>>({} as Record<ResourceType, PermissionLevel>);

  // Update permission levels when permissions data loads
  useEffect(() => {
    if (permissions.length > 0 || userId) {
      const initial: Record<string, PermissionLevel> = {};
      allResources.forEach(resource => {
        const perm = permissions.find(p => p.resource === resource);
        initial[resource] = perm?.permission_level || 'none';
      });
      setPermissionLevels(initial as Record<ResourceType, PermissionLevel>);
    }
  }, [permissions, userId]);

  const handlePermissionsUpdate = () => {
    if (!userId) return;
    const permsArray = Object.entries(permissionLevels).map(([resource, level]) => ({
      resource: resource as ResourceType,
      permission_level: level,
    }));
    updatePermissions.mutate({ userId, permissions: permsArray });
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

  const redFlags = flags.filter(f => f.flag_type === 'red' && !f.is_resolved);
  const yellowFlags = flags.filter(f => f.flag_type === 'yellow' && !f.is_resolved);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {userDetails.full_name?.[0]?.toUpperCase() || userDetails.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-2xl">{userDetails.full_name || "Sem nome"}</SheetTitle>
                <p className="text-sm text-muted-foreground">{userDetails.email}</p>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="general" className="mt-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="employment">Emprego</TabsTrigger>
              <TabsTrigger value="targets">Metas</TabsTrigger>
              <TabsTrigger value="flags">Flags</TabsTrigger>
              <TabsTrigger value="observations">Obs</TabsTrigger>
              <TabsTrigger value="permissions">Permissões</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              {/* Bloco Playbook Progress */}
              {userId && userDetails.role && (
                <PlaybookUserProgress 
                  userId={userId} 
                  userRole={userDetails.role} 
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Informações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Role</Label>
                    <Select value={userDetails.role || 'viewer'} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="sdr">SDR</SelectItem>
                        <SelectItem value="closer">Closer</SelectItem>
                        <SelectItem value="coordenador">Coordenador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select 
                      value={employmentData.status} 
                      onValueChange={(value: UserStatus) => setEmploymentData({ ...employmentData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">✅ Ativo</SelectItem>
                        <SelectItem value="ferias">🏖️ Férias</SelectItem>
                        <SelectItem value="inativo">❌ Inativo</SelectItem>
                        <SelectItem value="pendente_aprovacao">⏳ Pendente de Aprovação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleEmploymentUpdate} 
                    size="sm" 
                    className="w-full mt-2"
                  >
                    Salvar Status
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dados de Emprego</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Cargo</Label>
                    <Input
                      value={employmentData.position}
                      onChange={(e) => setEmploymentData({ ...employmentData, position: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Departamento</Label>
                    <Input
                      value={employmentData.department}
                      onChange={(e) => setEmploymentData({ ...employmentData, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data de Contratação</Label>
                    <Input
                      type="date"
                      value={employmentData.hire_date}
                      onChange={(e) => setEmploymentData({ ...employmentData, hire_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Salário Fixo</Label>
                    <Input
                      type="number"
                      value={employmentData.fixed_salary}
                      onChange={(e) => setEmploymentData({ ...employmentData, fixed_salary: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>OTE (On-Target Earnings)</Label>
                    <Input
                      type="number"
                      value={employmentData.ote}
                      onChange={(e) => setEmploymentData({ ...employmentData, ote: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Taxa de Comissão (%)</Label>
                    <Input
                      type="number"
                      value={employmentData.commission_rate}
                      onChange={(e) => setEmploymentData({ ...employmentData, commission_rate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <Button onClick={handleEmploymentUpdate} className="w-full">
                    Salvar Alterações
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="targets" className="space-y-4">
              {!showTargetForm && !editingTarget && (
                <Button onClick={() => setShowTargetForm(true)} className="w-full">
                  <TargetIcon className="h-4 w-4 mr-2" />
                  Adicionar Meta
                </Button>
              )}

              {(showTargetForm || editingTarget) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingTarget ? "Editar Meta" : "Nova Meta"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UserTargetsForm
                      userId={userId!}
                      initialData={editingTarget}
                      onSubmit={(data) => {
                        if (editingTarget) {
                          updateTarget.mutate(
                            { id: editingTarget.id, userId: userId!, data },
                            { onSuccess: () => setEditingTarget(null) }
                          );
                        } else {
                          createTarget.mutate(data, { onSuccess: () => setShowTargetForm(false) });
                        }
                      }}
                      onCancel={() => {
                        setShowTargetForm(false);
                        setEditingTarget(null);
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {loadingTargets ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {targets.map((target) => {
                    const progress = ((target.current_value || 0) / target.target_value) * 100;
                    return (
                      <Card key={target.id}>
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold">{target.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {target.type} • {target.period}
                                </p>
                              </div>
                              <Badge variant={target.is_achieved ? "default" : "secondary"}>
                                {target.is_achieved ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                                {target.is_achieved ? "Atingida" : "Pendente"}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{formatCurrency(target.current_value || 0)}</span>
                                <span>{formatCurrency(target.target_value)}</span>
                              </div>
                              <Progress value={Math.min(progress, 100)} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(target.start_date), "dd/MM/yyyy")} - {format(new Date(target.end_date), "dd/MM/yyyy")}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingTarget(target)}
                              className="w-full mt-2"
                            >
                              Editar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="flags" className="space-y-4">
              {!showFlagForm && (
                <Button onClick={() => setShowFlagForm(true)} className="w-full">
                  <Flag className="h-4 w-4 mr-2" />
                  Adicionar Flag
                </Button>
              )}

              {showFlagForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>Nova Flag</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UserFlagForm
                      userId={userId!}
                      onSubmit={(data) => {
                        createFlag.mutate(data, { onSuccess: () => setShowFlagForm(false) });
                      }}
                      onCancel={() => setShowFlagForm(false)}
                    />
                  </CardContent>
                </Card>
              )}

              {loadingFlags ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {redFlags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Red Flags ({redFlags.length})
                      </h3>
                      <div className="space-y-2">
                        {redFlags.map((flag) => (
                          <Card key={flag.id} className="border-destructive/50">
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">{flag.title}</h4>
                                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                                  </div>
                                  <Badge variant="destructive">Severidade: {flag.severity}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(flag.created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setResolveDialog({ open: true, flagId: flag.id, notes: "" })}
                                  className="w-full"
                                >
                                  Resolver
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {yellowFlags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Yellow Flags ({yellowFlags.length})
                      </h3>
                      <div className="space-y-2">
                        {yellowFlags.map((flag) => (
                          <Card key={flag.id} className="border-warning/50">
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold">{flag.title}</h4>
                                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                                  </div>
                                  <Badge className="bg-warning text-warning-foreground">Severidade: {flag.severity}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(flag.created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setResolveDialog({ open: true, flagId: flag.id, notes: "" })}
                                  className="w-full"
                                >
                                  Resolver
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="observations" className="space-y-4">
              {!showObservationForm && (
                <Button onClick={() => setShowObservationForm(true)} className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Observação
                </Button>
              )}

              {showObservationForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>Nova Observação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UserObservationForm
                      userId={userId!}
                      onSubmit={(data) => {
                        createObservation.mutate(data, { onSuccess: () => setShowObservationForm(false) });
                      }}
                      onCancel={() => setShowObservationForm(false)}
                    />
                  </CardContent>
                </Card>
              )}

              {loadingObservations ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {observations.map((obs) => (
                    <Card key={obs.id} className={obs.is_important ? "border-primary" : ""}>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold">{obs.title}</h4>
                            {obs.is_important && (
                              <Badge variant="default">Importante</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{obs.content}</p>
                          {obs.category && (
                            <Badge variant="outline">{obs.category}</Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(obs.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Gerenciar Permissões
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingPermissions ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {allResources.map((resource) => (
                        <div key={resource} className="flex items-center justify-between">
                          <Label className="capitalize">{resource.replace('_', ' ')}</Label>
                          <Select
                            value={permissionLevels[resource]}
                            onValueChange={(value: PermissionLevel) =>
                              setPermissionLevels({ ...permissionLevels, [resource]: value })
                            }
                          >
                            <SelectTrigger className="w-[180px]">
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
                      <Separator />
                      <Button onClick={handlePermissionsUpdate} className="w-full">
                        Salvar Permissões
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <Dialog open={resolveDialog.open} onOpenChange={(open) => setResolveDialog({ ...resolveDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Flag</DialogTitle>
            <DialogDescription>
              Adicione notas sobre a resolução desta flag.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={resolveDialog.notes}
            onChange={(e) => setResolveDialog({ ...resolveDialog, notes: e.target.value })}
            placeholder="Descreva como a flag foi resolvida..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, flagId: "", notes: "" })}>
              Cancelar
            </Button>
            <Button onClick={handleResolveFlag}>Resolver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
