import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_LEILOES } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { Clock, MapPin, Eye, Hammer, Gavel, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const MOCK_LEILOES_ATIVOS = MOCK_LEILOES.filter(l => l.status === 'ativo');
const MOCK_HISTORICO_ARREMATAR = [
  { id: '1', data: '15/02/2024', imovel: 'Apartamento 3 quartos', valorInicial: 320000, valorFinal: 340000, arrematante: 'João Silva' },
  { id: '2', data: '10/02/2024', imovel: 'Casa em condomínio', valorInicial: 650000, valorFinal: 710000, arrematante: 'Maria Santos' },
];

export default function Leilao() {
  return (
    <ResourceGuard resource="leilao">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leilões Imobiliários</h1>
          <p className="text-muted-foreground mt-1">Acompanhamento de leilões e arrematações</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leilões Ativos</p>
                  <p className="text-3xl font-bold text-primary">3</p>
                </div>
                <Gavel className="h-10 w-10 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total em Lances</p>
                  <p className="text-3xl font-bold text-success">{formatCurrency(2450000)}</p>
                </div>
                <DollarSign className="h-10 w-10 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Leilões em Andamento</h2>
          
          {MOCK_LEILOES_ATIVOS.map((leilao) => (
            <Card key={leilao.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2">{leilao.imovel}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">{leilao.endereco}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Encerra em {leilao.tempoRestante}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Valor Inicial</p>
                      <p className="text-lg font-semibold text-foreground">{formatCurrency(leilao.valorInicial)}</p>
                      <p className="text-sm text-muted-foreground mt-2">Lance Atual</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(leilao.lanceAtual)}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Ver Detalhes
                      </Button>
                      <Button size="sm">
                        Dar Lance
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Histórico de Arrematações</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Imóvel</TableHead>
                  <TableHead className="text-muted-foreground">Valor Inicial</TableHead>
                  <TableHead className="text-muted-foreground">Valor Final</TableHead>
                  <TableHead className="text-muted-foreground">Arrematante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_HISTORICO_ARREMATAR.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{item.data}</TableCell>
                    <TableCell className="font-medium text-foreground">{item.imovel}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(item.valorInicial)}</TableCell>
                    <TableCell className="font-semibold text-success">{formatCurrency(item.valorFinal)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.arrematante}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ResourceGuard>
  );
}
