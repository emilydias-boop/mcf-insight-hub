import { Shield } from 'lucide-react';
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
            Detecte mudanças suspeitas de status
          </p>
        </div>
      </div>

      <StatusChangesTab />
    </div>
  );
}
