import { Card, CardContent } from '@/components/ui/card';
import { Layers } from 'lucide-react';

const Grupos = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Grupos</h2>
        <p className="text-muted-foreground">Organize seus contatos em grupos</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Grupos em redesign
          </h3>
          <p className="text-muted-foreground">
            A integração antiga (Clint) foi descontinuada. Em breve, gerenciamento nativo de grupos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Grupos;
