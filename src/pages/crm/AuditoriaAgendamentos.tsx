import { Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DuplicatesTab } from '@/components/audit/DuplicatesTab';
import { StatusChangesTab } from '@/components/audit/StatusChangesTab';

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
            Detecte duplicatas e mudanças suspeitas de status
          </p>
        </div>
      </div>

      <Tabs defaultValue="status-changes">
        <TabsList>
          <TabsTrigger value="status-changes">Mudanças de Status</TabsTrigger>
          <TabsTrigger value="duplicatas">Duplicatas</TabsTrigger>
        </TabsList>
        <TabsContent value="status-changes">
          <StatusChangesTab />
        </TabsContent>
        <TabsContent value="duplicatas">
          <DuplicatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
