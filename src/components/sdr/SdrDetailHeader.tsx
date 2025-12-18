import { ArrowLeft, User, Briefcase, Users2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SdrDetailHeaderProps {
  name: string;
  email: string;
  cargo?: string;
  squad?: string;
  status?: string;
  startDate: Date;
  endDate: Date;
  onBack: () => void;
}

export function SdrDetailHeader({
  name,
  email,
  cargo = "SDR",
  squad = "Inside Sales",
  status = "Ativo",
  startDate,
  endDate,
  onBack,
}: SdrDetailHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{name}</h1>
            <Badge 
              variant="outline" 
              className={status === "Ativo" 
                ? "bg-green-500/10 text-green-400 border-green-500/30" 
                : "bg-red-500/10 text-red-400 border-red-500/30"
              }
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {status}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              <span>{cargo}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users2 className="h-4 w-4" />
              <span>{squad}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span className="text-xs">{email.split('@')[0]}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
        <span className="font-medium">Período:</span>
        <span>
          {format(startDate, "dd/MM/yyyy", { locale: ptBR })} - {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
