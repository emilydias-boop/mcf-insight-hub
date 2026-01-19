import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, User } from 'lucide-react';
import { QualificationDataType } from './QualificationFields';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QualificationSummaryCardProps {
  data: QualificationDataType;
  summary: string;
  sdrName?: string;
  qualifiedAt?: string;
  compact?: boolean;
}

export function QualificationSummaryCard({
  data,
  summary,
  sdrName,
  qualifiedAt,
  compact = false,
}: QualificationSummaryCardProps) {
  const formattedDate = qualifiedAt 
    ? format(new Date(qualifiedAt), "dd/MM 'às' HH:mm", { locale: ptBR })
    : null;

  if (compact) {
    return (
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="h-4 w-4 text-green-600" />
          <span className="font-medium text-sm text-green-700">Qualificação do SDR</span>
          {sdrName && (
            <span className="text-xs text-muted-foreground">por {sdrName}</span>
          )}
          {formattedDate && (
            <span className="text-xs text-muted-foreground">• {formattedDate}</span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-2">
          {data.profissao && (
            <Badge variant="secondary" className="text-xs">👤 {data.profissao}</Badge>
          )}
          {data.estado && (
            <Badge variant="secondary" className="text-xs">📍 {data.estado}</Badge>
          )}
          {data.renda && (
            <Badge variant="secondary" className="text-xs">💰 {data.renda}</Badge>
          )}
          {data.terreno === 'Sim' && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">🏡 Tem terreno</Badge>
          )}
          {data.empreende?.includes('construiu') && (
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">🏗️ Já construiu</Badge>
          )}
        </div>
        
        {data.solucao && (
          <p className="text-sm text-muted-foreground">
            🎯 <span className="font-medium">Busca:</span> {data.solucao}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-green-600" />
          Qualificação do SDR
        </CardTitle>
        {(sdrName || formattedDate) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {sdrName && (
              <>
                <User className="h-3 w-3" />
                <span>{sdrName}</span>
              </>
            )}
            {formattedDate && <span>• {formattedDate}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Badges de dados principais */}
        <div className="flex flex-wrap gap-2">
          {data.profissao && (
            <Badge variant="outline" className="text-xs">
              👤 {data.profissao}
            </Badge>
          )}
          {data.tem_socio && (
            <Badge variant="outline" className="text-xs">
              🤝 Sócio: {data.nome_socio || 'Sim'}
            </Badge>
          )}
          {data.estado && (
            <Badge variant="outline" className="text-xs">
              📍 {data.estado}
            </Badge>
          )}
          {data.renda && (
            <Badge variant="outline" className="text-xs">
              💰 {data.renda}
            </Badge>
          )}
        </div>
        
        {/* Dados secundários */}
        <div className="flex flex-wrap gap-2">
          {data.empreende && (
            <Badge 
              variant="secondary" 
              className={data.empreende.includes('construiu') ? 'bg-blue-100 text-blue-700' : ''}
            >
              🏗️ {data.empreende}
            </Badge>
          )}
          {data.terreno && (
            <Badge 
              variant="secondary"
              className={data.terreno === 'Sim' ? 'bg-green-100 text-green-700' : ''}
            >
              🏡 {data.terreno}
            </Badge>
          )}
          {data.investimento && (
            <Badge variant="secondary">
              💵 {data.investimento}
            </Badge>
          )}
        </div>
        
        {/* Solução que busca */}
        {data.solucao && (
          <div className="pt-2 border-t">
            <p className="text-sm">
              <span className="font-medium">🎯 Busca:</span> {data.solucao}
            </p>
          </div>
        )}
        
        {/* Resumo do SDR */}
        {summary && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {summary.split('---')[1]?.trim() || summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
