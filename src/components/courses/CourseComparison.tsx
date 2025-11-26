import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface CourseComparisonProps {
  a010Summary: {
    count: number;
    revenue: number;
    averageTicket: number;
  };
  construirSummary: {
    count: number;
    revenue: number;
    averageTicket: number;
  };
}

export function CourseComparison({ a010Summary, construirSummary }: CourseComparisonProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Comparação de Cursos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* A010 - Consultoria */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <h3 className="font-semibold text-foreground">A010 - Consultoria</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Vendas</span>
                </div>
                <span className="font-semibold text-foreground">
                  {formatNumber(a010Summary.count)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Receita</span>
                </div>
                <span className="font-semibold text-foreground">
                  {formatCurrency(a010Summary.revenue)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Ticket Médio</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(a010Summary.averageTicket)}
                </span>
              </div>
            </div>
          </div>

          {/* Construir Para Alugar */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <h3 className="font-semibold text-foreground">Construir Para Alugar</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Vendas</span>
                </div>
                <span className="font-semibold text-foreground">
                  {formatNumber(construirSummary.count)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Receita</span>
                </div>
                <span className="font-semibold text-foreground">
                  {formatCurrency(construirSummary.revenue)}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Ticket Médio</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(construirSummary.averageTicket)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
