import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface SaleCelebrationProps {
  leadName: string;
  leadType: "A" | "B";
  sdrName: string;
  closerName: string;
  productName: string;
  onComplete: () => void;
}

export function SaleCelebration({
  leadName,
  leadType,
  sdrName,
  closerName,
  productName,
  onComplete,
}: SaleCelebrationProps) {
  const isContrato = productName.toLowerCase().includes("contrato");
  const bgColor = isContrato ? "from-yellow-500/20 to-amber-600/20" : "from-blue-500/20 to-cyan-600/20";
  const accentColor = isContrato ? "text-yellow-500" : "text-blue-500";

  useEffect(() => {
    const colors = isContrato
      ? ["#FFD700", "#FFA500", "#FF8C00"]
      : ["#4169E1", "#1E90FF", "#00BFFF"];

    const duration = 50000; // 50 segundos
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [isContrato, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in">
      <Card className={`max-w-2xl w-full mx-4 bg-gradient-to-br ${bgColor} border-2 shadow-2xl animate-scale-in`}>
        <CardContent className="p-12 space-y-6 text-center">
          <div className="flex justify-center">
            <Sparkles className={`h-20 w-20 ${accentColor} animate-pulse`} />
          </div>
          
          <div>
            <h2 className="text-5xl font-bold text-foreground mb-2">
              🎉 VENDA REALIZADA! 🎉
            </h2>
            <p className={`text-3xl font-bold ${accentColor} uppercase tracking-wide`}>
              {productName}
            </p>
          </div>

          <div className="space-y-4 bg-card/50 rounded-lg p-6 border border-border">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Lead</p>
              <p className="text-2xl font-bold text-foreground">{leadName}</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-bold ${
                leadType === "A" ? "bg-chart-1 text-white" : "bg-chart-2 text-white"
              }`}>
                Lead {leadType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground uppercase">SDR</p>
                <p className="text-xl font-semibold text-foreground">{sdrName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Closer</p>
                <p className="text-xl font-semibold text-foreground">{closerName}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground animate-pulse">
            Parabéns pelo fechamento! 🚀
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
