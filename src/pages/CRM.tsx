import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Users, Building2, Briefcase, Tag, UserCircle, Settings } from 'lucide-react';
import {
  useClintContacts,
  useClintOrganizations,
  useClintDeals,
  useClintGroups,
  useClintTags,
  useClintUsers,
} from '@/hooks/useClintAPI';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: contacts, isLoading: loadingContacts } = useClintContacts();
  const { data: organizations, isLoading: loadingOrgs } = useClintOrganizations();
  const { data: deals, isLoading: loadingDeals } = useClintDeals();
  const { data: groups, isLoading: loadingGroups } = useClintGroups();
  const { data: tags, isLoading: loadingTags } = useClintTags();
  const { data: users, isLoading: loadingUsers } = useClintUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Clint</h1>
          <p className="text-muted-foreground">Gerencie contatos, negócios e organizações</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Contato
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-2" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="organizations">
            <Building2 className="h-4 w-4 mr-2" />
            Organizações
          </TabsTrigger>
          <TabsTrigger value="deals">
            <Briefcase className="h-4 w-4 mr-2" />
            Negócios
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Tag className="h-4 w-4 mr-2" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="tags">
            <Tag className="h-4 w-4 mr-2" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="users">
            <UserCircle className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contatos</CardTitle>
              <CardDescription>
                Lista de todos os contatos do CRM
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingContacts ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : contacts?.data ? (
                <div className="space-y-4">
                  {Array.isArray(contacts.data) ? (
                    contacts.data.map((contact: any) => (
                      <Card key={contact.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{contact.name}</h3>
                              {contact.email && (
                                <p className="text-sm text-muted-foreground">{contact.email}</p>
                              )}
                              {contact.phone && (
                                <p className="text-sm text-muted-foreground">{contact.phone}</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {Array.isArray(contact.tags) && contact.tags.map((tag: any) => (
                                <Badge key={typeof tag === 'string' ? tag : tag.id} variant="secondary">
                                  {typeof tag === 'string' ? tag : tag.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum contato encontrado
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum contato encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizações</CardTitle>
              <CardDescription>
                Lista de todas as organizações (empresas)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrgs ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (organizations as any)?.data && Array.isArray((organizations as any).data) && (organizations as any).data.length > 0 ? (
                <div className="space-y-4">
                  {(organizations as any).data.map((org: any) => (
                    <Card key={org.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{org.name}</h3>
                            {org.domain && (
                              <p className="text-sm text-muted-foreground">{org.domain}</p>
                            )}
                            {org.industry && (
                              <Badge variant="outline" className="mt-2">
                                {org.industry}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {organizations ? 'Nenhuma organização encontrada' : 'Erro ao carregar organizações - verifique se o endpoint está correto na API Clint'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Negócios</CardTitle>
              <CardDescription>
                Lista de todos os negócios em andamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDeals ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : deals?.data && Array.isArray(deals.data) ? (
                <div className="space-y-4">
                  {deals.data.map((deal: any) => (
                    <Card key={deal.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{deal.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Valor: R$ {deal.value?.toLocaleString('pt-BR')}
                            </p>
                            <Badge className="mt-2">{deal.stage}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum negócio encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grupos</CardTitle>
              <CardDescription>
                Grupos de contatos organizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGroups ? (
                <Skeleton className="h-40 w-full" />
              ) : groups?.data && Array.isArray(groups.data) ? (
                <div className="grid gap-4">
                  {groups.data.map((group: any) => (
                    <Card key={group.id}>
                      <CardContent className="pt-6">
                        <h3 className="font-semibold">{group.name}</h3>
                        {group.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {group.description}
                          </p>
                        )}
                        {group.contact_count && (
                          <Badge variant="secondary" className="mt-2">
                            {group.contact_count} contatos
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum grupo encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>
                Tags disponíveis para organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTags ? (
                <Skeleton className="h-40 w-full" />
              ) : tags?.data && Array.isArray(tags.data) ? (
                <div className="flex flex-wrap gap-2">
                  {tags.data.map((tag: any) => (
                    <Badge key={tag.id || tag.name} variant="secondary">
                      {typeof tag === 'string' ? tag : (tag.name || JSON.stringify(tag))}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma tag encontrada
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>
                Usuários da conta Clint
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <Skeleton className="h-40 w-full" />
              ) : users?.data && Array.isArray(users.data) ? (
                <div className="space-y-4">
                  {users.data.map((user: any) => (
                    <Card key={user.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={user.is_active ? 'default' : 'secondary'}>
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                            <Badge variant="outline">{user.role}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum usuário encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
