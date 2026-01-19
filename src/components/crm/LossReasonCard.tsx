import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XCircle, MessageSquare } from 'lucide-react';

interface LossReasonCardProps {
  stageName?: string;
  reason?: string;
}

export const LossReasonCard = ({ stageName, reason }: LossReasonCardProps) => {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" />
          <Badge variant="destructive" className="text-xs">
            {stageName || 'Perdido'}
          </Badge>
        </div>
        
        {reason && (
          <div className="flex items-start gap-2 text-sm">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-muted-foreground">{reason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
