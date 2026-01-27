import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WizardData } from './types';
import { Layers, GitBranch } from 'lucide-react';

interface WizardStepInfoProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

export const WizardStepInfo = ({ data, onChange, errors }: WizardStepInfoProps) => {
  const { data: groups } = useQuery({
    queryKey: ['crm-groups-for-wizard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_groups')
        .select('id, name, display_name')
        .eq('is_archived', false)
        .order('name');
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Tipo de Pipeline */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Tipo de Pipeline</Label>
        <RadioGroup
          value={data.type}
          onValueChange={(value: 'group' | 'origin') => onChange({ type: value })}
          className="grid grid-cols-2 gap-4"
        >
          <label
            htmlFor="type-group"
            className={`
              flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
              ${data.type === 'group' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'}
            `}
          >
            <RadioGroupItem value="group" id="type-group" />
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Pipeline (Grupo)</p>
                <p className="text-xs text-muted-foreground">Contém múltiplas origens</p>
              </div>
            </div>
          </label>
          
          <label
            htmlFor="type-origin"
            className={`
              flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
              ${data.type === 'origin' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'}
            `}
          >
            <RadioGroupItem value="origin" id="type-origin" />
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Origin (Sub-pipeline)</p>
                <p className="text-xs text-muted-foreground">Dentro de um grupo existente</p>
              </div>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Grupo Pai (se Origin) */}
      {data.type === 'origin' && (
        <div className="space-y-2">
          <Label htmlFor="parent_group">Grupo Pai *</Label>
          <Select
            value={data.parent_group_id || ''}
            onValueChange={(value) => onChange({ parent_group_id: value })}
          >
            <SelectTrigger className={errors.parent_group_id ? 'border-destructive' : ''}>
              <SelectValue placeholder="Selecione o grupo pai" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {groups?.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.display_name || group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.parent_group_id && (
            <p className="text-sm text-destructive">{errors.parent_group_id}</p>
          )}
        </div>
      )}

      {/* Nome */}
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ex: Hubla A010, Inside Sales Premium..."
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      {/* Nome de Exibição */}
      <div className="space-y-2">
        <Label htmlFor="display_name">Nome de Exibição</Label>
        <Input
          id="display_name"
          value={data.display_name}
          onChange={(e) => onChange({ display_name: e.target.value })}
          placeholder="Nome amigável para exibir na interface (opcional)"
        />
        <p className="text-xs text-muted-foreground">
          Se não preenchido, será usado o nome principal
        </p>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Descrição opcional do pipeline..."
          rows={3}
        />
      </div>
    </div>
  );
};
