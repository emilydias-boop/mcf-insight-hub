import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

export default function ConsorcioFechamento() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Fechamento - Consórcio</h1>
          <p className="text-muted-foreground">
            Gestão de fechamento e comissões das equipes de consórcio
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Em Desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Este módulo está sendo implementado.</p>
        </CardContent>
      </Card>
    </div>
  );
}
