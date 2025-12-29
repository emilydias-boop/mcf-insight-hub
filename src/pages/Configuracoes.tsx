import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, Settings, DollarSign, Mail, Palette, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { OperationalCostsConfig } from "@/components/dashboard/OperationalCostsConfig";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useMyProfile, useUpdateMyProfile, useUpdateMyEmail, useUpdateMyPassword } from "@/hooks/useMyProfile";

export default function Configuracoes() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  // Profile hooks
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const updateEmail = useUpdateMyEmail();
  const updatePassword = useUpdateMyPassword();

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    try {
      // Update name
      if (fullName !== profile?.full_name) {
        await updateProfile.mutateAsync({ full_name: fullName });
      }

      // Update email if changed
      if (email !== profile?.email) {
        await updateEmail.mutateAsync({ email });
      }

      if (fullName === profile?.full_name && email === profile?.email) {
        toast({ title: "Info", description: "Nenhuma alteração detectada" });
      }
    } catch (error) {
      // Errors are handled in the mutation hooks
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Erro", description: "Preencha todos os campos de senha", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    try {
      await updatePassword.mutateAsync({ password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleSaveNotifications = () => {
    toast({ title: "Sucesso", description: "Preferências de notificação salvas!" });
  };

  const isSavingProfile = updateProfile.isPending || updateEmail.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Gerenciamento de preferências e integrações" : "Gerenciamento de preferências pessoais"}
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'md:w-[720px] grid-cols-6' : 'md:w-[480px] grid-cols-4'}`}>
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="financeiro" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integracoes" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Integrações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="perfil" className="space-y-4 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nome" className="text-foreground">Nome Completo</Label>
                    <Input 
                      id="nome" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ao alterar o email, você receberá uma confirmação no novo endereço.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foto" className="text-foreground">Foto de Perfil</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-8 w-8 text-primary" />
                        )}
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Alterar Foto (em breve)
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aparencia" className="space-y-4 mt-6">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-4 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Preferências de Notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">Receber notificações por email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Push</p>
                  <p className="text-sm text-muted-foreground">Notificações no navegador</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">SMS</p>
                  <p className="text-sm text-muted-foreground">Alertas por mensagem de texto</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Alertas Críticos</p>
                  <p className="text-sm text-muted-foreground">Notificações de alta prioridade</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Resumo Diário</p>
                  <p className="text-sm text-muted-foreground">Receber resumo das métricas</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button onClick={handleSaveNotifications}>Salvar Preferências</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="space-y-4 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Alterar Senha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nova-senha" className="text-foreground">Nova Senha</Label>
                <Input 
                  id="nova-senha" 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-senha" className="text-foreground">Confirmar Nova Senha</Label>
                <Input 
                  id="confirmar-senha" 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
              <Button 
                onClick={handleChangePassword} 
                disabled={updatePassword.isPending}
              >
                {updatePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
              </Button>
              
              <Separator className="my-6" />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Autenticação de Dois Fatores</p>
                  <p className="text-sm text-muted-foreground">Adicionar camada extra de segurança</p>
                </div>
                <Switch disabled />
              </div>
              <p className="text-xs text-muted-foreground">Em breve</p>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="financeiro" className="space-y-4 mt-6">
            <OperationalCostsConfig />
            
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Recálculo de Métricas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Execute o recálculo de todas as métricas semanais após configurar os custos operacionais.
                </p>
                <Button 
                  onClick={async () => {
                    const { toast } = await import("sonner");
                    toast.info("Recalculando métricas...");
                    try {
                      const { supabase } = await import("@/integrations/supabase/client");
                      const { data: dates } = await supabase
                        .from('hubla_transactions')
                        .select('sale_date')
                        .order('sale_date', { ascending: true })
                        .limit(1);
                      
                      const { data: maxDates } = await supabase
                        .from('hubla_transactions')
                        .select('sale_date')
                        .order('sale_date', { ascending: false })
                        .limit(1);

                      const startDate = dates?.[0]?.sale_date || '2024-06-01';
                      const endDate = maxDates?.[0]?.sale_date || new Date().toISOString();

                      const { error } = await supabase.functions.invoke('recalculate-metrics', {
                        body: { start_date: startDate, end_date: endDate }
                      });

                      if (error) throw error;
                      toast.success("Métricas recalculadas com sucesso!");
                    } catch (error: any) {
                      toast.error("Erro ao recalcular: " + error.message);
                    }
                  }}
                  variant="outline"
                >
                  Recalcular Todas as Métricas
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="integracoes" className="space-y-4 mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Integrações Ativas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary/20 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Manus</p>
                      <p className="text-sm text-muted-foreground">CRM e gestão de leads</p>
                    </div>
                  </div>
                  <Badge variant="default">Conectado</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary/20 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Stripe</p>
                      <p className="text-sm text-muted-foreground">Processamento de pagamentos</p>
                    </div>
                  </div>
                  <Badge variant="outline">Desconectado</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary/20 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">SendGrid</p>
                      <p className="text-sm text-muted-foreground">Envio de emails</p>
                    </div>
                  </div>
                  <Badge variant="default">Conectado</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
