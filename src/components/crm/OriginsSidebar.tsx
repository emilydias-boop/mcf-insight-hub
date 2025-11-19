import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAllClintOrigins } from '@/hooks/useClintAPI';
import { cn } from '@/lib/utils';

interface OriginsSidebarProps {
  selectedOriginId: string | null;
  onSelectOrigin: (originId: string | null) => void;
}

interface Group {
  id: string;
  name: string;
  children: Origin[];
}

interface Origin {
  id: string;
  name: string;
  group_id?: string | null;
  contact_count?: number;
}

// Função para construir árvore de origens agrupadas
const buildOriginTree = (data: any[]): (Group | Origin)[] => {
  // Grupos são identificados por terem 'children' já definidos do hook
  return data;
};

// Componente recursivo para renderizar árvore
const OriginTreeItem = ({ 
  item, 
  level = 0,
  selectedId,
  onSelect 
}: { 
  item: Group | Origin; 
  level?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isGroup = 'children' in item && Array.isArray(item.children);
  const hasChildren = isGroup && item.children.length > 0;
  
  return (
    <div>
      <Button
        variant={!isGroup && selectedId === item.id ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-between mb-1 h-auto py-2",
          !isGroup && selectedId === item.id && "bg-primary/10",
          isGroup && "font-semibold"
        )}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={() => !isGroup && onSelect(item.id)}
        disabled={isGroup}
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
          {isGroup ? (
            <Layers className="h-3 w-3 flex-shrink-0" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          )}
          <span className="truncate text-xs">{item.name}</span>
        </span>
        {!isGroup && 'contact_count' in item && item.contact_count !== undefined && (
          <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
            {item.contact_count}
          </Badge>
        )}
      </Button>
      
      {hasChildren && isExpanded && isGroup && (
        <div>
          {item.children.map(child => (
            <OriginTreeItem
              key={child.id}
              item={child}
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
  
  const { data: originsData, isLoading } = useAllClintOrigins();
  const origins = originsData?.data || [];
  
  // Construir árvore de origens
  const originTree = buildOriginTree(origins);
  
  // Filtrar origens por busca (busca em grupos e origens)
  const filteredTree = searchTerm 
    ? originTree.filter((item: any) => {
        const isGroup = 'children' in item && Array.isArray(item.children);
        if (isGroup) {
          // Se o grupo match ou algum filho match
          if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
          return item.children.some((child: Origin) => 
            child.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        } else {
          return item.name.toLowerCase().includes(searchTerm.toLowerCase());
        }
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
                filteredTree.map((item: any) => (
                  <OriginTreeItem
                    key={item.id}
                    item={item}
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
