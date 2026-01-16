import { useState } from 'react';
import { Award, Calculator, Gift, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  verificarContemplacao, 
  simularChanceLance, 
  getCorChanceLance,
  MOTIVO_CONTEMPLACAO_OPTIONS,
  MotivoContemplacao 
} from '@/lib/contemplacao';

interface ContemplationCardProps {
  cota: string;
  valorCredito: number;
  status: string;
  numeroContemplacao?: string | null;
  dataContemplacao?: string | null;
  motivoContemplacao?: string | null;
  onContemplar?: (data: {
    numeroContemplacao: string;
    dataContemplacao: string;
    motivoContemplacao: MotivoContemplacao;
    valorLance?: number;
    percentualLance?: number;
  }) => void;
}

export function ContemplationCard({
  cota,
  valorCredito,
  status,
  numeroContemplacao,
  dataContemplacao,
  motivoContemplacao,
  onContemplar,
}: ContemplationCardProps) {
  const [numeroLoteria, setNumeroLoteria] = useState('');
  const [verificacaoResultado, setVerificacaoResultado] = useState<ReturnType<typeof verificarContemplacao> | null>(null);
  const [percentualLance, setPercentualLance] = useState(20);
  const [simulacao, setSimulacao] = useState<ReturnType<typeof simularChanceLance> | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState<MotivoContemplacao>('sorteio');

  const isContemplado = status === 'contemplado';

  const handleVerificarLoteria = () => {
    if (!numeroLoteria) return;
    const resultado = verificarContemplacao(cota, numeroLoteria);
    setVerificacaoResultado(resultado);
  };

  const handleSimularLance = () => {
    const resultado = simularChanceLance(valorCredito, percentualLance);
    setSimulacao(resultado);
  };

  const handleConfirmarContemplacao = () => {
    if (!onContemplar) return;
    
    onContemplar({
      numeroContemplacao: numeroLoteria,
      dataContemplacao: new Date().toISOString().split('T')[0],
      motivoContemplacao: motivoSelecionado,
      valorLance: motivoSelecionado !== 'sorteio' ? (valorCredito * percentualLance) / 100 : undefined,
      percentualLance: motivoSelecionado !== 'sorteio' ? percentualLance : undefined,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isContemplado) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-green-800">
            <Gift className="h-5 w-5" />
            🎉 Cota Contemplada!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-green-700">Data da Contemplação</p>
              <p className="font-medium text-green-900">
                {dataContemplacao 
                  ? new Date(dataContemplacao).toLocaleDateString('pt-BR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-green-700">Tipo</p>
              <p className="font-medium text-green-900 capitalize">
                {MOTIVO_CONTEMPLACAO_OPTIONS.find(m => m.value === motivoContemplacao)?.label || motivoContemplacao || '-'}
              </p>
            </div>
            {numeroContemplacao && (
              <div>
                <p className="text-sm text-green-700">Número Sorteado</p>
                <p className="font-medium text-green-900">{numeroContemplacao}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="h-5 w-5" />
          Contemplação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Verificação por Loteria Federal */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Verificar Sorteio (Loteria Federal)
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Digite o número sorteado"
              value={numeroLoteria}
              onChange={(e) => {
                setNumeroLoteria(e.target.value);
                setVerificacaoResultado(null);
              }}
              className="flex-1"
            />
            <Button onClick={handleVerificarLoteria} variant="outline">
              Verificar
            </Button>
          </div>
          {verificacaoResultado && (
            <div className={`p-3 rounded-lg ${
              verificacaoResultado.contemplado 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="font-medium">{verificacaoResultado.mensagem}</p>
              <p className="text-sm mt-1">
                Cota: {cota} → Últimos 4 dígitos da loteria: {numeroLoteria.slice(-4)}
              </p>
              {verificacaoResultado.contemplado && onContemplar && (
                <Button 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setMotivoSelecionado('sorteio');
                    handleConfirmarContemplacao();
                  }}
                >
                  Confirmar Contemplação por Sorteio
                </Button>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Simulador de Lance */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Simulador de Lance
          </Label>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Percentual do Lance (%)</Label>
              <Input
                type="number"
                min={5}
                max={50}
                value={percentualLance}
                onChange={(e) => {
                  setPercentualLance(Number(e.target.value));
                  setSimulacao(null);
                }}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Valor do Lance</Label>
              <Input
                value={formatCurrency((valorCredito * percentualLance) / 100)}
                disabled
              />
            </div>
            <Button onClick={handleSimularLance} variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              Simular
            </Button>
          </div>
          
          {simulacao && (
            <div className="p-3 rounded-lg bg-muted space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Chance de Contemplação:</span>
                <Badge className={getCorChanceLance(simulacao.chanceContemplacao)}>
                  {simulacao.chanceContemplacao.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm">{simulacao.mensagem}</p>
              <p className="text-xs text-muted-foreground">
                Posição estimada no ranking: ~{simulacao.posicaoEstimada}º lugar
              </p>
              
              {onContemplar && (simulacao.chanceContemplacao === 'alta' || simulacao.chanceContemplacao === 'muito_alta') && (
                <div className="pt-2 space-y-2">
                  <Select value={motivoSelecionado} onValueChange={(v) => setMotivoSelecionado(v as MotivoContemplacao)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de lance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lance">Lance Livre</SelectItem>
                      <SelectItem value="lance_fixo">Lance Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={handleConfirmarContemplacao}
                  >
                    Registrar Contemplação por Lance
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
