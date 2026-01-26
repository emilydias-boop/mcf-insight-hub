import { Network, Settings2, Users2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricasTab } from "@/components/admin/organograma/MetricasTab";
import { EstruturaTab } from "@/components/admin/organograma/EstruturaTab";
import { GestoresTab } from "@/components/admin/organograma/GestoresTab";

export default function Organograma() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6" />
          Organograma & Métricas
        </h1>
        <p className="text-muted-foreground">
          Configure a estrutura hierárquica, gestores e métricas de cada cargo
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gestores">
        <TabsList>
          <TabsTrigger value="gestores" className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Definir Gestores
          </TabsTrigger>
          <TabsTrigger value="estrutura" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Estrutura
          </TabsTrigger>
          <TabsTrigger value="metricas" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Métricas por Cargo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gestores" className="mt-6">
          <GestoresTab />
        </TabsContent>

        <TabsContent value="estrutura" className="mt-6">
          <EstruturaTab />
        </TabsContent>

        <TabsContent value="metricas" className="mt-6">
          <MetricasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
