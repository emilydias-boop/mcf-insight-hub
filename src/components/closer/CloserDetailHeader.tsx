import { ArrowLeft, Briefcase, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CloserDetailHeaderProps {
  name: string;
  email: string;
  color?: string | null;
  meetingType?: string | null;
  startDate: Date;
  endDate: Date;
  onBack: () => void;
}

export function CloserDetailHeader({
  name,
  email,
  color,
  meetingType,
  startDate,
  endDate,
  onBack,
}: CloserDetailHeaderProps) {
  const periodLabel = `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          {/* Avatar with closer color */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
            style={{ backgroundColor: color || '#3B82F6' }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              {name}
              <Badge variant="outline" className="text-xs">
                <Briefcase className="h-3 w-3 mr-1" />
                Closer
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <Calendar className="h-4 w-4" />
        <span>{periodLabel}</span>
        {meetingType && (
          <Badge variant="secondary" className="ml-2 text-xs">
            {meetingType.toUpperCase()}
          </Badge>
        )}
      </div>
    </div>
  );
}
