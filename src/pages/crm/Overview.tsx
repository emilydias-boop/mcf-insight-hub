import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Tag } from 'lucide-react';

// Import sub-page components
import Tags from './Tags';
import { FunilDashboard } from '@/components/crm/FunilDashboard';

const Overview = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">Painel de Controle do Funil Comercial</h2>
        <p className="text-sm text-muted-foreground hidden sm:block">Acompanhe a performance do seu funil de vendas em tempo real</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="dashboard" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Dashboard</span>
            <span className="xs:hidden">Dash</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Tag className="h-3 w-3 sm:h-4 sm:w-4" />
            Tags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FunilDashboard />
        </TabsContent>


        <TabsContent value="tags">
          <Tags />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Overview;
