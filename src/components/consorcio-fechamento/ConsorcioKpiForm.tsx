import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsorcioKpiFormData } from '@/types/consorcio-fechamento';
import { Save } from 'lucide-react';

interface ConsorcioKpiFormProps {
  initialData: ConsorcioKpiFormData;
  onSave: (data: ConsorcioKpiFormData) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ConsorcioKpiForm({ 
  initialData, 
  onSave, 
  isLoading = false,
  disabled = false,
}: ConsorcioKpiFormProps) {
  const [formData, setFormData] = useState<ConsorcioKpiFormData>(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editar KPIs</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comissao_consorcio">Comissão Consórcio (R$)</Label>
              <Input
                id="comissao_consorcio"
                type="number"
                step="0.01"
                value={formData.comissao_consorcio}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  comissao_consorcio: parseFloat(e.target.value) || 0 
                }))}
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="meta_comissao_consorcio">Meta Comissão Consórcio</Label>
              <Input
                id="meta_comissao_consorcio"
                type="number"
                step="0.01"
                value={formData.meta_comissao_consorcio || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  meta_comissao_consorcio: parseFloat(e.target.value) || undefined 
                }))}
                disabled={disabled}
                placeholder="2000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="comissao_holding">Comissão Holding (R$)</Label>
              <Input
                id="comissao_holding"
                type="number"
                step="0.01"
                value={formData.comissao_holding}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  comissao_holding: parseFloat(e.target.value) || 0 
                }))}
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="meta_comissao_holding">Meta Comissão Holding</Label>
              <Input
                id="meta_comissao_holding"
                type="number"
                step="0.01"
                value={formData.meta_comissao_holding || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  meta_comissao_holding: parseFloat(e.target.value) || undefined 
                }))}
                disabled={disabled}
                placeholder="500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="score_organizacao">Score Organização (0-100)</Label>
              <Input
                id="score_organizacao"
                type="number"
                min="0"
                max="100"
                value={formData.score_organizacao}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  score_organizacao: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                }))}
                disabled={disabled}
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || disabled}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Salvando...' : 'Salvar KPIs'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
