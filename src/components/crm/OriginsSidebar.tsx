import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Layers, ChevronLeft, ChevronRight, ChevronDown, Star,
  Store, Users, Building2, Briefcase, Package, Megaphone, Globe, 
  ShoppingCart, Target, Handshake, MoreVertical, Settings, Archive, Trash2,
  type LucideIcon
} from 'lucide-react';
import { useCRMOriginsByPipeline } from '@/hooks/useCRMOriginsByPipeline';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PipelineSelector } from './PipelineSelector';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PipelineContextMenu } from './PipelineContextMenu';
import { PipelineConfigModal } from './PipelineConfigModal';

interface OriginsSidebarProps {
  pipelineId?: string | null;
  selectedOriginId: string | null;
  onSelectOrigin: (originId: string | null) => void;
  onSelectPipeline: (pipelineId: string | null) => void;
}

interface Group {
  id: string;
  name: string;
  display_name?: string | null;
  children: Origin[];
}

interface Origin {
  id: string;
  name: string;
  display_name?: string | null;
  group_id?: string | null;
  groupId?: string | null;
  contact_count?: number;
  deal_count?: number;
}

// Mapear ícones baseado no nome do grupo/origem
const getGroupIcon = (name: string): LucideIcon => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('hubla')) return Store;
  if (lowerName.includes('inside') || lowerName.includes('sales')) return Users;
  if (lowerName.includes('capital') || lowerName.includes('mcf')) return Building2;
  if (lowerName.includes('contrato')) return Briefcase;
  if (lowerName.includes('pós venda') || lowerName.includes('pos venda')) return Package;
  if (lowerName.includes('dmg') || lowerName.includes('ads') || lowerName.includes('tráfego')) return Megaphone;
  if (lowerName.includes('bu') || lowerName.includes('produto')) return Globe;
  if (lowerName.includes('parceria') || lowerName.includes('indicação')) return Handshake;
  if (lowerName.includes('lead') || lowerName.includes('captação')) return Target;
  if (lowerName.includes('loja') || lowerName.includes('ecommerce')) return ShoppingCart;
  
  return Layers; // Ícone padrão
};

// Hook para gerenciar favoritos com localStorage
const useFavorites = () => {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('crm-origin-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem('crm-origin-favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.has(id);

  return { favorites, toggleFavorite, isFavorite };
};

export const OriginsSidebar = ({ pipelineId, selectedOriginId, onSelectOrigin, onSelectPipeline }: OriginsSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [configTarget, setConfigTarget] = useState<{ type: 'origin' | 'group'; id: string; name: string } | null>(null);
  
  const { data: originData, isLoading } = useCRMOriginsByPipeline(pipelineId);
  
  // Query separada para buscar grupos (para o modo collapsed)
  const { data: allGroups } = useQuery({
    queryKey: ['crm-groups-for-collapsed-sidebar'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_groups')
        .select('id, name, display_name')
        .order('name');
      return data || [];
    },
  });
  
  // Verificar se é uma lista flat (pipeline específico) ou árvore (todos os funis)
  const isGroupedTree = originData && Array.isArray(originData) && originData.length > 0 && 'children' in originData[0];
  
  // Filtrar origens por busca
  const filterBySearch = (items: any[]) => {
    if (!searchTerm) return items;
    
    return items.filter((item: any) => {
      const displayName = item.display_name || item.name;
      const nameMatch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if ('children' in item && Array.isArray(item.children)) {
        const childMatch = item.children.some((child: Origin) => {
          const childDisplay = child.display_name || child.name;
          return childDisplay.toLowerCase().includes(searchTerm.toLowerCase());
        });
        return nameMatch || childMatch;
      }
      
      return nameMatch;
    });
  };
  
  const filteredData = filterBySearch(originData || []);
  
  // Obter lista flat de todas as origens para favoritos
  const getAllOrigins = (): Origin[] => {
    if (!originData) return [];
    
    if (isGroupedTree) {
      return (originData as Group[]).flatMap(group => group.children);
    }
    return originData as Origin[];
  };
  
  // Origens favoritas
  const favoriteOrigins = getAllOrigins().filter(origin => isFavorite(origin.id));
  
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  
  // Renderizar origem individual
  const renderOriginItem = (origin: Origin, indented = false, showFavorite = true) => {
    const displayName = origin.display_name || origin.name;
    const dealCount = origin.deal_count || 0;
    const favorited = isFavorite(origin.id);
    
    return (
      <div 
        key={origin.id} 
        className={cn(
          "group flex items-center gap-1 min-w-0",
          indented && "pl-6"
        )}
      >
        {/* Botão de favorito */}
        {showFavorite && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 flex-shrink-0 transition-opacity",
              favorited ? "opacity-100" : "opacity-0 group-hover:opacity-70"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(origin.id);
            }}
            title={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star 
              className={cn(
                "h-3 w-3",
                favorited 
                  ? "fill-yellow-400 text-yellow-400" 
                  : "text-muted-foreground"
              )}
            />
          </Button>
        )}
        
        <Button
          variant={selectedOriginId === origin.id ? "secondary" : "ghost"}
          className={cn(
            "flex-1 min-w-0 justify-between h-auto py-2 text-left overflow-hidden pr-1",
            selectedOriginId === origin.id && "bg-primary/10"
          )}
          onClick={() => onSelectOrigin(origin.id)}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="truncate text-xs">{displayName}</span>
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            {dealCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {dealCount}
              </Badge>
            )}
            {/* Menu de 3 pontos - dentro do botão */}
            <span onClick={(e) => e.stopPropagation()}>
              <PipelineContextMenu
                targetType="origin"
                targetId={origin.id}
                targetName={displayName}
                onConfigure={() => setConfigTarget({ type: 'origin', id: origin.id, name: displayName })}
                onSelect={() => onSelectOrigin(origin.id)}
              />
            </span>
          </span>
        </Button>
      </div>
    );
  };
  
  // Renderizar grupo colapsável
  const renderGroup = (group: Group) => {
    const displayName = group.display_name || group.name;
    const isExpanded = expandedGroups.has(group.id);
    const totalDeals = group.children.reduce((sum, c) => sum + (c.deal_count || 0), 0);
    const Icon = getGroupIcon(group.name);
    
    return (
      <Collapsible
        key={group.id}
        open={isExpanded}
        onOpenChange={() => toggleGroup(group.id)}
      >
        <div className="group flex items-center">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-between h-auto py-2 font-medium pr-1"
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <ChevronDown 
                  className={cn(
                    "h-3 w-3 transition-transform flex-shrink-0",
                    !isExpanded && "-rotate-90"
                  )}
                />
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-xs">{displayName}</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {totalDeals > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {totalDeals}
                  </Badge>
                )}
                {/* Menu de 3 pontos - dentro do botão */}
                <span onClick={(e) => e.stopPropagation()}>
                  <PipelineContextMenu
                    targetType="group"
                    targetId={group.id}
                    targetName={displayName}
                    onConfigure={() => setConfigTarget({ type: 'group', id: group.id, name: displayName })}
                    onSelect={() => {
                      setExpandedGroups(prev => new Set([...prev, group.id]));
                    }}
                  />
                </span>
              </span>
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="space-y-1">
          {group.children.map(child => renderOriginItem(child, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  return (
    <div className={cn(
      "border-r bg-muted/10 flex flex-col h-full transition-all duration-300",
      isCollapsed ? "w-12" : "w-72"
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
      
      {/* Conteúdo expandido */}
      {!isCollapsed && (
        <>
          {/* Seletor de Pipeline */}
          <div className="p-3 border-b">
            <PipelineSelector
              selectedPipelineId={pipelineId || null}
              onSelectPipeline={onSelectPipeline}
            />
          </div>
          
          {/* Busca */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar origem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Seção de favoritos */}
              {favoriteOrigins.length > 0 && !searchTerm && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    Favoritos
                  </h4>
                  <div className="space-y-1">
                    {favoriteOrigins.map(origin => renderOriginItem(origin, false, true))}
                  </div>
                  <div className="border-b my-3" />
                </div>
              )}
              
              {isLoading ? (
                <div className="text-sm text-muted-foreground p-4">Carregando...</div>
              ) : filteredData.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4">
                  {searchTerm ? 'Nenhuma origem encontrada' : 'Nenhuma origem cadastrada'}
                </div>
              ) : isGroupedTree ? (
                // Modo árvore (todos os funis)
                filteredData.map((item: any) => renderGroup(item))
              ) : (
                // Modo lista flat (pipeline específico)
                filteredData.map((item: any) => renderOriginItem(item))
              )}
            </div>
          </ScrollArea>
        </>
      )}
      
      {/* Versão mini quando collapsed - mostrar ícones dos grupos */}
      {isCollapsed && (
        <ScrollArea className="flex-1">
          <div className="flex flex-col items-center py-2 gap-1">
            {/* Favoritos no modo collapsed */}
            {favoriteOrigins.length > 0 && (
              <>
                {favoriteOrigins.map(origin => {
                  const Icon = getGroupIcon(origin.name);
                  const displayName = origin.display_name || origin.name;
                  return (
                    <Button
                      key={`fav-${origin.id}`}
                      variant={selectedOriginId === origin.id ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => onSelectOrigin(origin.id)}
                      title={`⭐ ${displayName}`}
                      className="h-8 w-8 relative"
                    >
                      <Icon className="h-4 w-4" />
                      <Star className="h-2 w-2 absolute -top-0.5 -right-0.5 fill-yellow-400 text-yellow-400" />
                    </Button>
                  );
                })}
                <div className="w-6 border-b my-1" />
              </>
            )}
            
            {/* Sempre mostrar ícones dos grupos principais */}
            {allGroups?.map((group) => {
              const Icon = getGroupIcon(group.name);
              const displayName = group.display_name || group.name;
              
              return (
                <Button
                  key={group.id}
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCollapsed(false)}
                  title={displayName}
                  className="h-8 w-8"
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Modal de configurações */}
      {configTarget && (
        <PipelineConfigModal
          open={!!configTarget}
          onOpenChange={(open) => !open && setConfigTarget(null)}
          targetType={configTarget.type}
          targetId={configTarget.id}
        />
      )}
    </div>
  );
};
