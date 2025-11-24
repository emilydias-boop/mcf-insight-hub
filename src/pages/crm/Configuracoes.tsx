import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Users, Zap, Database, Shield } from 'lucide-react';
import { SyncMonitor } from '@/components/crm/SyncMonitor';
import { CronJobSetup } from '@/components/crm/CronJobSetup';
import { SyncControls } from '@/components/crm/SyncControls';
import { WebhookMonitor } from '@/components/crm/WebhookMonitor';

const Configuracoes = () => {
  const settingsSections = [
    {
      icon: Database,
      title: 'Campos Customizados',
      description: 'Adicione campos personalizados aos seus contatos e negócios',
      action: 'Gerenciar Campos',
    },
    {
      icon: Zap,
      title: 'Automações',
      description: 'Configure automações para otimizar seu fluxo de trabalho',
      action: 'Configurar Automações',
    },
    {
      icon: Users,
      title: 'Estágios do Pipeline',
      description: 'Personalize os estágios do seu funil de vendas',
      action: 'Editar Estágios',
    },
    {
      icon: Shield,
      title: 'Permissões',
      description: 'Gerencie permissões de acesso ao CRM',
      action: 'Gerenciar Permissões',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Configurações do CRM</h2>
        <p className="text-muted-foreground">Personalize e configure seu sistema de CRM</p>
      </div>

      <WebhookMonitor />
      
      <CronJobSetup />
      
      <SyncControls />
      
      <SyncMonitor />

      <div className="grid gap-6 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">{section.title}</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  {section.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {section.action}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Ajustes gerais do sistema de CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Notificações por Email</p>
              <p className="text-sm text-muted-foreground">Receba alertas sobre novos contatos e negócios</p>
            </div>
            <Button variant="outline" className="border-border">
              Configurar
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Integrações</p>
              <p className="text-sm text-muted-foreground">Conecte o CRM com outras ferramentas</p>
            </div>
            <Button variant="outline" className="border-border">
              Ver Integrações
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Backup de Dados</p>
              <p className="text-sm text-muted-foreground">Configure backups automáticos</p>
            </div>
            <Button variant="outline" className="border-border">
              Configurar Backup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuracoes;
