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

// Hook para buscar grupos principais (funis)
export const useCRMPipelines = () => {
  return useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      // Buscar grupos (que são os funis principais)
      const { data, error } = await supabase
        .from('crm_groups')
        .select('id, name, display_name')
        .order('name');
      
      if (error) throw error;
      return data || [];
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
