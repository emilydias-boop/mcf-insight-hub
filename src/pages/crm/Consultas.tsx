import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SemSucessoTab } from '@/components/consorcio/SemSucessoTab';
import { CartasExcluidasTab } from '@/components/consorcio/CartasExcluidasTab';
import { TodasReunioesTab } from '@/components/consorcio/TodasReunioesTab';
import { MatchSocioParceiroTab } from '@/components/consorcio/MatchSocioParceiroTab';
import { PendingRegistrationsList } from '@/components/consorcio/PendingRegistrationsList';
import { ContemplationTab } from '@/components/consorcio/ContemplationTab';
import { GruposTab } from '@/components/consorcio/grupos/GruposTab';
import { PrevisaoComissoesTab } from '@/components/consorcio/PrevisaoComissoesTab';
import { IndicacoesTab } from '@/components/consorcio/IndicacoesTab';

const TABS = [
  'sem-sucesso', 'excluidas', 'todas', 'match-socio',
  'declinadas', 'contemplacao', 'grupos', 'previsao', 'indicacoes',
] as const;

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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sem-sucesso">Sem Sucesso</TabsTrigger>
          <TabsTrigger value="excluidas">Cartas Excluídas</TabsTrigger>
          <TabsTrigger value="todas">Todas Reuniões</TabsTrigger>
          <TabsTrigger value="match-socio">Match sócio-parceiro</TabsTrigger>
          <span aria-hidden className="mx-2 h-5 w-px self-center bg-border" />
          <TabsTrigger value="declinadas">Cartas Declinadas</TabsTrigger>
          <TabsTrigger value="contemplacao">Contemplação</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
          <TabsTrigger value="previsao">Previsão</TabsTrigger>
          <TabsTrigger value="indicacoes">Indicações</TabsTrigger>
        </TabsList>

        <TabsContent value="sem-sucesso"><SemSucessoTab /></TabsContent>
        <TabsContent value="excluidas"><CartasExcluidasTab /></TabsContent>
        <TabsContent value="todas"><TodasReunioesTab /></TabsContent>
        <TabsContent value="match-socio"><MatchSocioParceiroTab /></TabsContent>
        <TabsContent value="declinadas"><PendingRegistrationsList variant="declinadas" /></TabsContent>
        <TabsContent value="contemplacao"><ContemplationTab /></TabsContent>
        <TabsContent value="grupos"><GruposTab /></TabsContent>
        <TabsContent value="previsao"><PrevisaoComissoesTab /></TabsContent>
        <TabsContent value="indicacoes">
          <div className="[&_[role=tablist]]:bg-transparent [&_[role=tablist]]:border [&_[role=tablist]]:border-border/60">
            <IndicacoesTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
