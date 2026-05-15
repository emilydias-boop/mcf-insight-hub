import { Shield } from 'lucide-react';
import { StatusChangesTab } from '@/components/audit/StatusChangesTab';
import { LeadTransfersTab } from '@/components/audit/LeadTransfersTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AuditoriaAgendamentos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria
          </h1>
          <p className="text-muted-foreground text-sm">
            Detecte mudanças suspeitas de status
          </p>
        </div>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Mudanças de Status</TabsTrigger>
          <TabsTrigger value="transfers">Transferências de Leads</TabsTrigger>
        </TabsList>
        <TabsContent value="status">
          <StatusChangesTab />
        </TabsContent>
        <TabsContent value="transfers">
          <LeadTransfersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
