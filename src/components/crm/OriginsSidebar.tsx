import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Layers } from 'lucide-react';
import { useClintOrigins } from '@/hooks/useClintAPI';
import { cn } from '@/lib/utils';

interface OriginsSidebarProps {
  selectedOriginId: string | null;
  onSelectOrigin: (originId: string | null) => void;
}

export const OriginsSidebar = ({ selectedOriginId, onSelectOrigin }: OriginsSidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: originsData, isLoading } = useClintOrigins();
  const origins = originsData?.data || [];
  
  const filteredOrigins = origins.filter((origin: any) =>
    origin.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="w-64 border-r bg-muted/10 flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">
          Origens
        </h3>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          <Button
            variant={selectedOriginId === null ? "secondary" : "ghost"}
            className="w-full justify-start mb-1"
            onClick={() => onSelectOrigin(null)}
          >
            <Layers className="h-4 w-4 mr-2" />
            Todas as Origens
          </Button>
          
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-4">Carregando...</div>
          ) : filteredOrigins.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4">Nenhuma origem encontrada</div>
          ) : (
            filteredOrigins.map((origin: any) => (
              <Button
                key={origin.id}
                variant={selectedOriginId === origin.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-between mb-1",
                  selectedOriginId === origin.id && "bg-primary/10"
                )}
                onClick={() => onSelectOrigin(origin.id)}
              >
                <span className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mr-2" />
                  <span className="truncate">{origin.name}</span>
                </span>
                {origin.contact_count !== undefined && (
                  <Badge variant="secondary" className="ml-2">
                    {origin.contact_count}
                  </Badge>
                )}
              </Button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
