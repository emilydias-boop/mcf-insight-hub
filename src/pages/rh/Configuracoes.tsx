import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Building2, Users } from "lucide-react";
import CargosTab from "@/components/hr/config/CargosTab";
import DepartamentosTab from "@/components/hr/config/DepartamentosTab";
import SquadsTab from "@/components/hr/config/SquadsTab";

export default function ConfiguracoesRH() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do RH</h1>
        <p className="text-muted-foreground">
          Gerencie cargos, departamentos e squads da organização
        </p>
      </div>

      <Tabs defaultValue="cargos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cargos" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Cargos
          </TabsTrigger>
          <TabsTrigger value="departamentos" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Departamentos / BUs
          </TabsTrigger>
          <TabsTrigger value="squads" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Squads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cargos">
          <CargosTab />
        </TabsContent>

        <TabsContent value="departamentos">
          <DepartamentosTab />
        </TabsContent>

        <TabsContent value="squads">
          <SquadsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
