import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ClipboardCheck, Sparkles, Save, Calendar, Loader2 } from 'lucide-react';
import { useUpdateCRMDeal } from '@/hooks/useCRMData';
import { toast } from 'sonner';

// Campos de qualificação específicos para o funil Perpétuo X1
const PERPETUO_X1_FIELDS = [
  {
    key: 'faixa_renda',
    label: 'Faixa de Renda',
    type: 'select' as const,
    options: [
      { value: 'ate_5k', label: 'Até R$ 5.000' },
      { value: '5k_10k', label: 'R$ 5.000 - R$ 10.000' },
      { value: '10k_20k', label: 'R$ 10.000 - R$ 20.000' },
      { value: 'acima_20k', label: 'Acima de R$ 20.000' },
    ],
    required: true,
  },
  {
    key: 'ja_empreende',
    label: 'Já empreende?',
    type: 'select' as const,
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
    ],
    required: true,
  },
  {
    key: 'tem_terreno_imovel',
    label: 'Possui terreno ou imóvel?',
    type: 'select' as const,
    options: [
      { value: 'terreno', label: 'Terreno' },
      { value: 'imovel', label: 'Imóvel' },
      { value: 'ambos', label: 'Ambos' },
      { value: 'nenhum', label: 'Nenhum' },
    ],
    required: true,
  },
  {
    key: 'quanto_investir',
    label: 'Quanto pretende investir?',
    type: 'select' as const,
    options: [
      { value: 'ate_50k', label: 'Até R$ 50.000' },
      { value: '50k_100k', label: 'R$ 50.000 - R$ 100.000' },
      { value: '100k_200k', label: 'R$ 100.000 - R$ 200.000' },
      { value: 'acima_200k', label: 'Acima de R$ 200.000' },
    ],
    required: true,
  },
  {
    key: 'solucao_busca',
    label: 'Qual solução está buscando?',
    type: 'text' as const,
    required: false,
    placeholder: 'Ex: Construir para alugar, investimento...',
  },
];

interface SdrQualificationBlockProps {
  dealId: string;
  customFields: Record<string, any> | null;
  onFieldChange?: () => void;
  onSchedule?: (summary: string) => void;
}

export function SdrQualificationBlock({ 
  dealId, 
  customFields, 
  onFieldChange,
  onSchedule 
}: SdrQualificationBlockProps) {
  const updateDeal = useUpdateCRMDeal();
  
  // Estado local dos campos de qualificação
  const [qualificationData, setQualificationData] = useState<Record<string, string>>({});
  const [leadSummary, setLeadSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Inicializar com dados existentes
  useEffect(() => {
    if (customFields) {
      const existing: Record<string, string> = {};
      PERPETUO_X1_FIELDS.forEach(field => {
        if (customFields[`qual_${field.key}`]) {
          existing[field.key] = customFields[`qual_${field.key}`];
        }
      });
      setQualificationData(existing);
      
      // Carregar resumo existente
      if (customFields.lead_summary) {
        setLeadSummary(customFields.lead_summary);
      }
    }
  }, [customFields]);
  
  // Calcular progresso
  const progress = useMemo(() => {
    const requiredFields = PERPETUO_X1_FIELDS.filter(f => f.required);
    const filledRequired = requiredFields.filter(f => qualificationData[f.key]);
    return Math.round((filledRequired.length / requiredFields.length) * 100);
  }, [qualificationData]);
  
  // Gerar resumo automático
  const generateSummary = () => {
    const parts: string[] = [];
    
    // Faixa de renda
    const renda = PERPETUO_X1_FIELDS[0].options?.find(o => o.value === qualificationData.faixa_renda);
    if (renda) {
      parts.push(`renda ${renda.label}`);
    }
    
    // Já empreende
    if (qualificationData.ja_empreende === 'sim') {
      parts.push('já empreende');
    } else if (qualificationData.ja_empreende === 'nao') {
      parts.push('não empreende ainda');
    }
    
    // Terreno/imóvel
    const tiLabel = {
      terreno: 'possui terreno',
      imovel: 'possui imóvel',
      ambos: 'possui terreno e imóvel',
      nenhum: 'não possui terreno/imóvel',
    }[qualificationData.tem_terreno_imovel || ''];
    if (tiLabel) parts.push(tiLabel);
    
    // Investimento
    const invest = PERPETUO_X1_FIELDS[3].options?.find(o => o.value === qualificationData.quanto_investir);
    if (invest) {
      parts.push(`pretende investir ${invest.label}`);
    }
    
    // Solução
    if (qualificationData.solucao_busca) {
      parts.push(`busca: ${qualificationData.solucao_busca}`);
    }
    
    if (parts.length === 0) {
      return 'Preencha os campos de qualificação para gerar o resumo.';
    }
    
    return `Lead com ${parts.join('. ')}.`;
  };
  
  // Atualizar campo
  const handleFieldChange = (key: string, value: string) => {
    setQualificationData(prev => ({ ...prev, [key]: value }));
  };
  
  // Gerar resumo automaticamente
  const handleGenerateSummary = () => {
    const summary = generateSummary();
    setLeadSummary(summary);
  };
  
  // Salvar qualificação e resumo
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const updatedCustomFields = {
        ...(customFields || {}),
        lead_summary: leadSummary,
      };
      
      // Adicionar campos de qualificação com prefixo
      PERPETUO_X1_FIELDS.forEach(field => {
        if (qualificationData[field.key]) {
          updatedCustomFields[`qual_${field.key}`] = qualificationData[field.key];
        }
      });
      
      await updateDeal.mutateAsync({
        id: dealId,
        custom_fields: updatedCustomFields,
      });
      
      toast.success('Qualificação salva com sucesso!');
      onFieldChange?.();
    } catch (error) {
      toast.error('Erro ao salvar qualificação');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Agendar com resumo
  const handleSchedule = () => {
    if (onSchedule) {
      onSchedule(leadSummary || generateSummary());
    }
  };
  
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Qualificação do Lead
          </CardTitle>
          <Badge variant={progress === 100 ? 'default' : 'secondary'} className="text-xs">
            {progress}% completo
          </Badge>
        </div>
        <Progress value={progress} className="h-1.5 mt-2" />
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Campos de qualificação */}
        <div className="grid gap-3">
          {PERPETUO_X1_FIELDS.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              
              {field.type === 'select' ? (
                <Select
                  value={qualificationData[field.key] || ''}
                  onValueChange={(value) => handleFieldChange(field.key, value)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={qualificationData[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="h-9 text-sm"
                />
              )}
            </div>
          ))}
        </div>
        
        {/* Resumo do lead */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Resumo do Lead</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={handleGenerateSummary}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Gerar
            </Button>
          </div>
          <Textarea
            value={leadSummary}
            onChange={(e) => setLeadSummary(e.target.value)}
            placeholder="O resumo será gerado automaticamente ou você pode editar manualmente..."
            className="min-h-[80px] text-sm resize-none"
          />
          <p className="text-[10px] text-muted-foreground">
            Este resumo será incluído automaticamente nas notas do agendamento.
          </p>
        </div>
        
        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Salvar
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            onClick={handleSchedule}
            disabled={!leadSummary && progress < 50}
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Agendar Reunião
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
