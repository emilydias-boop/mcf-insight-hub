import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_KEY = 'metrics_recalculated';

export function DebugResetButton() {
  const { toast } = useToast();

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    
    toast({
      title: "🔧 Debug: localStorage resetado",
      description: "O botão de recálculo irá aparecer novamente.",
    });
    
    // Recarrega a página para aplicar a mudança
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Bug className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Reset localStorage (Debug)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
