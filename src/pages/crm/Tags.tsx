import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClintTags } from '@/hooks/useClintAPI';
import { Search, Plus, Tag } from 'lucide-react';

const Tags = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: tags, isLoading } = useClintTags();

  const tagsData = tags?.data || [];
  const filteredTags = tagsData.filter((tag: any) =>
    tag.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tags</h2>
          <p className="text-muted-foreground">Gerencie as tags dos seus contatos</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Nova Tag
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      ) : filteredTags.length > 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3">
              {filteredTags.map((tag: any) => (
                <Badge
                  key={tag.id}
                  className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-0 hover:bg-primary/20 cursor-pointer transition-colors"
                  style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : {}}
                >
                  <Tag className="h-3 w-3 mr-2" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'Nenhuma tag encontrada' : 'Nenhuma tag cadastrada'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Crie tags para categorizar seus contatos'}
            </p>
            {!searchTerm && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Criar Tag
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Tags;
