import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar, User, Check, ChevronRight } from 'lucide-react';
import type { MeetingSuggestion } from '@/hooks/useMeetingSuggestion';

interface SuggestionCardProps {
  suggestion: MeetingSuggestion;
  onAccept: () => void;
  onChooseOther: () => void;
  isLoading?: boolean;
}

export function SuggestionCard({ 
  suggestion, 
  onAccept, 
  onChooseOther,
  isLoading 
}: SuggestionCardProps) {
  const scoreColor = suggestion.score >= 80 
    ? 'bg-emerald-500' 
    : suggestion.score >= 60 
      ? 'bg-amber-500' 
      : 'bg-blue-500';

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Sugestão Inteligente</span>
          </div>
          <Badge className={`${scoreColor} text-white font-bold`}>
            {suggestion.score}/100
          </Badge>
        </div>

        {/* Main Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-lg font-medium">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span>
              {format(suggestion.date, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: suggestion.closerColor }}
            />
            <span className="font-medium">{suggestion.closerName}</span>
            <Badge variant="outline" className="ml-auto">
              {suggestion.availableSlots}/{suggestion.maxSlots} vagas
            </Badge>
          </div>
        </div>

        {/* Reasons */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">Por que este horário?</p>
          <ul className="space-y-1">
            {suggestion.reasons.slice(0, 3).map((reason, idx) => (
              <li key={idx} className="text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={onAccept} 
            className="flex-1"
            disabled={isLoading}
          >
            <Check className="h-4 w-4 mr-2" />
            Aceitar Sugestão
          </Button>
          <Button 
            variant="outline" 
            onClick={onChooseOther}
            disabled={isLoading}
          >
            Escolher Outro
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
