import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, Settings, DollarSign, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Configuracoes() {
  const handleSave = () => {
    toast({ title: "Sucesso", description: "Alterações salvas com sucesso!" });
  };

  return (
    <ResourceGuard resource="configuracoes">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento de preferências e integrações</p>
        </div>

        <Tabs defaultValue="perfil" className="w-full">
          <TabsList className="grid w-full md:w-[600px] grid-cols-4">
            <TabsTrigger value="perfil" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Integrações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-4 mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-foreground">Nome Completo</Label>
                  <Input id="nome" defaultValue="João Silva" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <Input id="email" type="email" defaultValue="joao.silva@mcf.com.br" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="text-foreground">Telefone</Label>
                  <Input id="telefone" defaultValue="(11) 98765-4321" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="foto" className="text-foreground">Foto de Perfil</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <Button variant="outline" size="sm">Alterar Foto</Button>
                  </div>
                </div>
                <Button onClick={handleSave}>Salvar Alterações</Button>
              </CardContent>
            </Card>
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
                <Button onClick={handleSave}>Salvar Preferências</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seguranca" className="space-y-4 mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Segurança da Conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha-atual" className="text-foreground">Senha Atual</Label>
                  <Input id="senha-atual" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha" className="text-foreground">Nova Senha</Label>
                  <Input id="nova-senha" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha" className="text-foreground">Confirmar Nova Senha</Label>
                  <Input id="confirmar-senha" type="password" />
                </div>
                <Button onClick={handleSave}>Alterar Senha</Button>
                
                <Separator className="my-6" />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Autenticação de Dois Fatores</p>
                    <p className="text-sm text-muted-foreground">Adicionar camada extra de segurança</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>
      </div>
    </ResourceGuard>
  );
}
