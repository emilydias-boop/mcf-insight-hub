import { useState, useEffect } from 'react';
import { Check, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface QualificationField {
  key: string;
  label: string;
  type: 'boolean' | 'select' | 'text';
  options?: string[];
  required?: boolean;
}

// Campos padrão de qualificação - podem ser customizados por origem
export const DEFAULT_QUALIFICATION_FIELDS: QualificationField[] = [
  { 
    key: 'faixa_de_renda', 
    label: 'Faixa de renda', 
    type: 'select', 
    options: ['Até 5k', '5k-10k', '10k-20k', '+20k'],
    required: true 
  },
  { 
    key: 'ja_empreende', 
    label: 'Já empreende?', 
    type: 'boolean',
    required: true 
  },
  { 
    key: 'tem_terreno_ou_imove', 
    label: 'Tem terreno/imóvel?', 
    type: 'boolean',
    required: true 
  },
  { 
    key: 'o_quanto_esta_dispos', 
    label: 'Quanto está disposto a investir?', 
    type: 'text',
    required: false 
  },
  { 
    key: 'solucao_que_busca', 
    label: 'Solução que busca', 
    type: 'text',
    required: false 
  },
];

interface QualificationChecklistProps {
  customFields: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
  fields?: QualificationField[];
  isUpdating?: boolean;
  onComplete?: () => void;
}

export function QualificationChecklist({ 
  customFields, 
  onFieldChange,
  fields = DEFAULT_QUALIFICATION_FIELDS,
  isUpdating = false,
  onComplete
}: QualificationChecklistProps) {
  const [localFields, setLocalFields] = useState<Record<string, unknown>>(customFields);

  useEffect(() => {
    setLocalFields(customFields);
  }, [customFields]);

  // Calcular progresso
  const requiredFields = fields.filter(f => f.required);
  const filledRequired = requiredFields.filter(f => {
    const value = localFields[f.key];
    if (f.type === 'boolean') return value === true || value === 'true' || value === 'Sim';
    return value !== undefined && value !== null && value !== '';
  });
  
  const progress = requiredFields.length > 0 
    ? Math.round((filledRequired.length / requiredFields.length) * 100)
    : 100;

  const isComplete = filledRequired.length === requiredFields.length && requiredFields.length > 0;

  // Verificar se o campo está preenchido
  const isFieldFilled = (field: QualificationField): boolean => {
    const value = localFields[field.key];
    if (field.type === 'boolean') {
      return value === true || value === 'true' || value === 'Sim';
    }
    return value !== undefined && value !== null && value !== '';
  };

  // Obter valor do campo
  const getFieldValue = (field: QualificationField): string | boolean => {
    const value = localFields[field.key];
    if (field.type === 'boolean') {
      return value === true || value === 'true' || value === 'Sim';
    }
    return (value as string) || '';
  };

  // Atualizar campo
  const handleChange = (key: string, value: unknown) => {
    setLocalFields(prev => ({ ...prev, [key]: value }));
    onFieldChange(key, value);
    
    // Verificar se completou todos os obrigatórios
    const updatedFields = { ...localFields, [key]: value };
    const allFilled = requiredFields.every(f => {
      const val = updatedFields[f.key];
      if (f.type === 'boolean') return val === true || val === 'true' || val === 'Sim';
      return val !== undefined && val !== null && val !== '';
    });
    
    if (allFilled && onComplete) {
      onComplete();
    }
  };

  return (
    <div className="space-y-4">
      {/* Progresso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Qualificação {isUpdating && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
          </span>
          <Badge 
            variant={isComplete ? "default" : "secondary"} 
            className={cn(
              "text-xs",
              isComplete && "bg-green-600 hover:bg-green-700"
            )}
          >
            {filledRequired.length}/{requiredFields.length} obrigatórios
          </Badge>
        </div>
        <Progress value={progress} className={cn(
          "h-2",
          isComplete && "[&>div]:bg-green-600"
        )} />
      </div>

      {/* Campos */}
      <div className="space-y-3">
        {fields.map((field) => (
          <div 
            key={field.key} 
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-colors",
              isFieldFilled(field) ? "bg-green-500/10" : "bg-muted/30"
            )}
          >
            {/* Ícone de status */}
            {isFieldFilled(field) ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            )}

            {/* Campo */}
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground block mb-1">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              
              {field.type === 'boolean' && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={getFieldValue(field) as boolean}
                    onCheckedChange={(checked) => handleChange(field.key, checked ? 'Sim' : '')}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <span className="text-sm">
                    {getFieldValue(field) ? 'Sim' : 'Não'}
                  </span>
                </div>
              )}

              {field.type === 'select' && (
                <Select
                  value={getFieldValue(field) as string}
                  onValueChange={(value) => handleChange(field.key, value)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.type === 'text' && (
                <Input
                  value={getFieldValue(field) as string}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder="Digite..."
                  className="h-8 text-sm"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mensagem de conclusão */}
      {isComplete && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 text-green-700 text-sm">
          <Check className="h-4 w-4" />
          <span>Lead qualificado! Pronto para agendar reunião.</span>
        </div>
      )}
    </div>
  );
}
