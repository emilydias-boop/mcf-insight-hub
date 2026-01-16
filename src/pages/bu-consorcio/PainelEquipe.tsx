import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users2 } from 'lucide-react';

export default function ConsorcioPainelEquipe() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Painel da Equipe - Consórcio</h1>
          <p className="text-muted-foreground">
            Acompanhamento de performance e metas das equipes de consórcio
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
