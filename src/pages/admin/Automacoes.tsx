import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowList } from "@/components/automations/FlowList";
import { TemplateList } from "@/components/automations/TemplateList";
import { AutomationLogs } from "@/components/automations/AutomationLogs";
import { AutomationSettings } from "@/components/automations/AutomationSettings";
import { AutomationMetrics } from "@/components/automations/AutomationMetrics";
import { Bot, FileText, History, Settings, BarChart3 } from "lucide-react";

export default function Automacoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automações</h1>
        <p className="text-muted-foreground">
          Gerencie fluxos de automação de mensagens por stage do CRM
        </p>
      </div>

      <AutomationMetrics />

      <Tabs defaultValue="flows" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="flows" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Fluxos
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="space-y-4">
          <FlowList />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplateList />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <AutomationLogs />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <AutomationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
