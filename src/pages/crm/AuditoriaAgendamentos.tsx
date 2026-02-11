import { Copy, Shield } from 'lucide-react';
import { DuplicatesTab } from '@/components/audit/DuplicatesTab';

export default function AuditoriaAgendamentos() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria - Duplicatas
          </h1>
          <p className="text-muted-foreground text-sm">
            Detecte e revise duplicatas de webhook
          </p>
        </div>
      </div>

      <DuplicatesTab />
    </div>
  );
}
