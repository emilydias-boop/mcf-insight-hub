import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClintOrigins } from '@/hooks/useClintAPI';
import { cn } from '@/lib/utils';

interface OriginsSidebarProps {
  selectedOriginId: string | null;
  onSelectOrigin: (originId: string | null) => void;
}

interface Origin {
  id: string;
  name: string;
  parent_id?: string | null;
  contact_count?: number;
  children?: Origin[];
}

// Função para construir árvore de origens
const buildOriginTree = (origins: any[]): Origin[] => {
  const originMap = new Map<string, Origin>();
  const roots: Origin[] = [];
  
  // Criar map e adicionar array de children
  origins.forEach((origin: any) => {
    originMap.set(origin.id, { ...origin, children: [] });
  });
  
  // Construir árvore
  origins.forEach((origin: any) => {
    const node = originMap.get(origin.id)!;
    if (origin.parent_id && originMap.has(origin.parent_id)) {
      const parent = originMap.get(origin.parent_id)!;
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
};

// Componente recursivo para renderizar árvore
const OriginTreeItem = ({ 
  origin, 
  level = 0,
  selectedId,
  onSelect 
}: { 
  origin: Origin; 
  level?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = origin.children && origin.children.length > 0;
  
  return (
    <div>
      <Button
        variant={selectedId === origin.id ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-between mb-1 h-auto py-2",
          selectedId === origin.id && "bg-primary/10"
        )}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={() => onSelect(origin.id)}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren && (
            <ChevronRight 
              className={cn(
                "h-3 w-3 transition-transform flex-shrink-0",
                isExpanded && "rotate-90"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            />
          )}
          {!hasChildren && <div className="w-3" />}
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <span className="truncate text-xs">{origin.name}</span>
        </span>
        {origin.contact_count !== undefined && (
          <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
            {origin.contact_count}
          </Badge>
        )}
      </Button>
      
      {hasChildren && isExpanded && (
        <div>
          {origin.children!.map(child => (
            <OriginTreeItem
              key={child.id}
              origin={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const OriginsSidebar = ({ selectedOriginId, onSelectOrigin }: OriginsSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: originsData, isLoading } = useClintOrigins();
  const origins = originsData?.data || [];
  
  // Construir árvore de origens
  const originTree = buildOriginTree(origins);
  
  // Filtrar origens por busca (busca em toda a árvore)
  const filteredTree = searchTerm 
    ? originTree.filter((origin: Origin) => {
        const matchesSearch = (o: Origin): boolean => {
          if (o.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
          return o.children?.some(matchesSearch) || false;
        };
        return matchesSearch(origin);
      })
    : originTree;
  
  return (
    <div className={cn(
      "border-r bg-muted/10 flex flex-col h-full transition-all duration-300",
      isCollapsed ? "w-12" : "w-64"
    )}>
      {/* Header com toggle */}
      <div className="p-4 border-b flex items-center justify-between">
        {!isCollapsed && (
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">
            Origens
          </h3>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 flex-shrink-0"
          title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Conteúdo (esconder quando collapsed) */}
      {!isCollapsed && (
        <>
          <div className="p-4 border-b">
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
                className="w-full justify-start mb-2"
                onClick={() => onSelectOrigin(null)}
              >
                <Layers className="h-4 w-4 mr-2" />
                Todas as Origens
              </Button>
              
              {isLoading ? (
                <div className="text-sm text-muted-foreground p-4">Carregando...</div>
              ) : filteredTree.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4">
                  {searchTerm ? 'Nenhuma origem encontrada' : 'Nenhuma origem cadastrada'}
                </div>
              ) : (
                filteredTree.map((origin: Origin) => (
                  <OriginTreeItem
                    key={origin.id}
                    origin={origin}
                    selectedId={selectedOriginId}
                    onSelect={onSelectOrigin}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
      
      {/* Versão mini quando collapsed */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-2 gap-2">
          <Button
            variant={selectedOriginId === null ? "secondary" : "ghost"}
            size="icon"
            onClick={() => onSelectOrigin(null)}
            title="Todas as Origens"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
