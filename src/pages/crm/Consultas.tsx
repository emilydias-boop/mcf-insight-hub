import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SemSucessoTab } from '@/components/consorcio/SemSucessoTab';
import { CartasExcluidasTab } from '@/components/consorcio/CartasExcluidasTab';
import { TodasReunioesTab } from '@/components/consorcio/TodasReunioesTab';
import { MatchSocioParceiroTab } from '@/components/consorcio/MatchSocioParceiroTab';

const TABS = ['sem-sucesso', 'excluidas', 'todas', 'match-socio'] as const;

export default function Consultas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = (TABS as readonly string[]).includes(tabParam || '')
    ? (tabParam as string)
    : 'sem-sucesso';

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sem-sucesso">Sem Sucesso</TabsTrigger>
          <TabsTrigger value="excluidas">Cartas Excluídas</TabsTrigger>
          <TabsTrigger value="todas">Todas Reuniões</TabsTrigger>
          <TabsTrigger value="match-socio">Match sócio-parceiro</TabsTrigger>
        </TabsList>

        <TabsContent value="sem-sucesso"><SemSucessoTab /></TabsContent>
        <TabsContent value="excluidas"><CartasExcluidasTab /></TabsContent>
        <TabsContent value="todas"><TodasReunioesTab /></TabsContent>
        <TabsContent value="match-socio"><MatchSocioParceiroTab /></TabsContent>
      </Tabs>
    </div>
  );
}
