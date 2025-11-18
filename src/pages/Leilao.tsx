import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_LEILOES } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { Clock, MapPin, Eye, Hammer } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Leilao() {
  const leiloesAtivos = MOCK_LEILOES.filter(l => l.status === 'ativo');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Leilões Imobiliários</h1>
        <p className="text-muted-foreground mt-1">Acompanhamento de leilões e arrematações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leilões Ativos</p>
                <p className="text-3xl font-bold text-primary">{leiloesAtivos.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Hammer className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total em Lances</p>
                <p className="text-3xl font-bold text-success">
                  {formatCurrency(leiloesAtivos.reduce((sum, l) => sum + l.lanceAtual, 0))}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Leilões Ativos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leiloesAtivos.map((leilao) => (
            <Card key={leilao.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">{leilao.imovel}</CardTitle>
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {leilao.endereco}
                    </div>
                  </div>
                  <Badge>Ativo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Inicial</span>
                    <span className="text-foreground font-medium">{formatCurrency(leilao.valorInicial)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Lance Atual</span>
                    <span className="text-lg font-bold text-success">{formatCurrency(leilao.lanceAtual)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Termina em {leilao.tempoRestante}</span>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => toast({ title: "Em breve", description: "Detalhes do leilão em desenvolvimento" })}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => toast({ title: "Lance registrado", description: "Seu lance foi registrado com sucesso" })}
                  >
                    <Hammer className="h-4 w-4 mr-2" />
                    Dar Lance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Histórico de Arrematações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Imóvel</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor Inicial</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor Final</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Arrematante</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm text-foreground">15/01/2024</td>
                    <td className="py-3 px-4 text-sm text-foreground">Apartamento 2 quartos</td>
                    <td className="py-3 px-4 text-sm text-right text-muted-foreground">{formatCurrency(200000)}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-success">{formatCurrency(235000)}</td>
                    <td className="py-3 px-4 text-sm text-foreground">João Silva</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
