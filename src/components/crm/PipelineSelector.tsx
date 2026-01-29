import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface PipelineSelectorProps {
  selectedPipelineId: string | null;
  onSelectPipeline: (id: string | null) => void;
  allowedGroupIds?: string[]; // Grupos permitidos pela BU (vazio = sem filtro)
}

// Hook para buscar grupos principais (funis) - com deduplicação por nome
export const useCRMPipelines = () => {
  return useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      // Buscar grupos (que são os funis principais)
      const { data, error } = await supabase
        .from('crm_groups')
        .select('id, name, display_name, created_at, is_archived')
        .order('created_at', { ascending: false }); // Mais recentes primeiro
      
      if (error) throw error;
      if (!data) return [];
      
      // Filtrar arquivados (se coluna existir, senão ignora)
      const activeGroups = data.filter(g => g.is_archived !== true);
      
      // Deduplicar por nome (manter o mais recente de cada)
      const seen = new Map<string, typeof activeGroups[0]>();
      activeGroups.forEach(g => {
        const key = (g.display_name ?? g.name).trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, g);
        }
        // Se já existe, ignorar (já temos o mais recente pois ordenamos por created_at desc)
      });
      
      // Converter de volta para array e ordenar alfabeticamente por nome
      return Array.from(seen.values()).sort((a, b) => 
        (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name)
      );
    },
  });
};

export const PipelineSelector = ({ selectedPipelineId, onSelectPipeline, allowedGroupIds }: PipelineSelectorProps) => {
  const { data: pipelines, isLoading } = useCRMPipelines();
  
  // Filtrar pipelines se houver restrição de BU
  const filteredPipelines = useMemo(() => {
    if (!allowedGroupIds || allowedGroupIds.length === 0) {
      return pipelines; // Sem filtro = admin vê tudo
    }
    return pipelines?.filter(p => allowedGroupIds.includes(p.id));
  }, [pipelines, allowedGroupIds]);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Funil:</Label>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground whitespace-nowrap">Funil:</Label>
      <Select 
        value={selectedPipelineId || 'all'} 
        onValueChange={(value) => onSelectPipeline(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-[260px]">
          <SelectValue placeholder="Selecione um funil" />
        </SelectTrigger>
        <SelectContent>
          {/* Só mostrar "Todos" se não houver filtro de BU */}
          {(!allowedGroupIds || allowedGroupIds.length === 0) && (
            <SelectItem value="all">Todos os funis</SelectItem>
          )}
          {filteredPipelines?.map(pipeline => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              {pipeline.display_name || pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
