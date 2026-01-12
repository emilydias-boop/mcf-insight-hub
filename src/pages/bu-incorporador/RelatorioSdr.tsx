import { Building2 } from "lucide-react";
import { SdrReportSection } from "@/components/relatorios/SdrReportSection";

export default function RelatorioSdrIncorp() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatório SDR</h1>
          <p className="text-muted-foreground mt-1">
            Relatório de performance SDR - BU Incorporador MCF
          </p>
        </div>
      </div>

      <SdrReportSection />
    </div>
  );
}
