import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SaleCelebration } from "@/components/tv/SaleCelebration";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type CelebrationType = "contrato" | "parceria" | null;

export default function TVSdrCelebrationDemo() {
  const navigate = useNavigate();
  const [activeCelebration, setActiveCelebration] = useState<CelebrationType>(null);

  const handleSimulate = (type: CelebrationType) => {
    setActiveCelebration(type);
  };

  const handleComplete = () => {
    setActiveCelebration(null);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/tv-sdr/fullscreen")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              🎉 Demo de Celebrações
            </h1>
            <p className="text-muted-foreground mt-2">
              Teste as animações de vendas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Botão Contrato */}
          <div className="space-y-4">
            <Button
              onClick={() => handleSimulate("contrato")}
              size="lg"
              className="w-full h-32 text-2xl font-bold bg-gradient-to-br from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white"
            >
              🏆 Simular CONTRATO
            </Button>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-foreground">Características:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Confete dourado/laranja</li>
                <li>• Fundo amarelo/âmbar</li>
                <li>• Texto em amarelo</li>
                <li>• Duração: 10 segundos</li>
              </ul>
            </div>
          </div>

          {/* Botão Parceria */}
          <div className="space-y-4">
            <Button
              onClick={() => handleSimulate("parceria")}
              size="lg"
              className="w-full h-32 text-2xl font-bold bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
            >
              🤝 Simular PARCERIA
            </Button>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-foreground">Características:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Confete azul/ciano</li>
                <li>• Fundo azul/ciano</li>
                <li>• Texto em azul</li>
                <li>• Duração: 10 segundos</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">💡 Dica</h3>
          <p className="text-sm text-muted-foreground">
            Na TV real, as celebrações duram 50 segundos. Aqui a duração é reduzida 
            para 10 segundos para facilitar os testes. Clique em qualquer botão 
            para fechar a celebração antes do tempo.
          </p>
        </div>
      </div>

      {/* Celebrações */}
      {activeCelebration && (
        <div onClick={handleComplete} className="cursor-pointer">
          <SaleCelebration
            leadName="Cliente Demo"
            leadType="A"
            sdrName="SDR Demonstração"
            closerName="Closer Demonstração"
            productName={
              activeCelebration === "contrato"
                ? "Contrato Incorporadora - Inside Sales"
                : "Parceria Estratégica OB"
            }
            duration={10000}
            onComplete={handleComplete}
          />
        </div>
      )}
    </div>
  );
}
