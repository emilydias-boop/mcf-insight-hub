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
}

// Hook para buscar pipelines principais (origens que têm estágios)
export const useCRMPipelines = () => {
  return useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      // Buscar origens que têm estágios associados (são pipelines)
      const { data: stages, error: stagesError } = await supabase
        .from('crm_stages')
        .select('origin_id')
        .eq('is_active', true);
      
      if (stagesError) throw stagesError;
      
      // IDs únicos de origens que têm estágios
      const originIdsWithStages = [...new Set(stages?.map(s => s.origin_id).filter(Boolean))];
      
      if (originIdsWithStages.length === 0) return [];
      
      // Buscar dados dessas origens
      const { data: origins, error: originsError } = await supabase
        .from('crm_origins')
        .select('id, name, display_name, pipeline_type, group_id')
        .in('id', originIdsWithStages)
        .order('display_name');
      
      if (originsError) throw originsError;
      
      return origins || [];
    },
  });
};

export const PipelineSelector = ({ selectedPipelineId, onSelectPipeline }: PipelineSelectorProps) => {
  const { data: pipelines, isLoading } = useCRMPipelines();
  
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
          <SelectItem value="all">Todos os funis</SelectItem>
          {pipelines?.map(pipeline => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              {pipeline.display_name || pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
