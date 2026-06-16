import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

const modules = import.meta.glob("/docs/qa/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

type Doc = { path: string; slug: string; title: string; date: string; content: string };

function parseDoc(path: string, content: string): Doc {
  const file = path.split("/").pop() || path;
  const slug = file.replace(/\.md$/, "");
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const date = match?.[1] ?? "";
  const rest = match?.[2] ?? slug;
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = h1 || rest.replace(/-/g, " ");
  return { path, slug, title, date, content };
}

export default function QaDocsViewer() {
  const docs = useMemo<Doc[]>(
    () =>
      Object.entries(modules)
        .map(([p, c]) => parseDoc(p, c))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [],
  );

  const [selected, setSelected] = useState<string | null>(docs[0]?.slug ?? null);
  const current = docs.find((d) => d.slug === selected) ?? null;

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Documentação QA</h1>
        <p className="text-sm text-muted-foreground">
          Roadmaps de testes e documentos de qualidade gerados para novas features.
        </p>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum documento encontrado em <code>docs/qa/</code>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documentos ({docs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[70vh]">
                <div className="flex flex-col gap-1">
                  {docs.map((d) => (
                    <Button
                      key={d.slug}
                      variant={d.slug === selected ? "secondary" : "ghost"}
                      className="justify-start h-auto py-2 px-2 text-left"
                      onClick={() => setSelected(d.slug)}
                    >
                      <FileText className="h-4 w-4 mr-2 shrink-0" />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-xs text-muted-foreground">{d.date}</span>
                        <span className="text-sm truncate w-full">{d.title}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {current ? (
                <ScrollArea className="h-[70vh] pr-4">
                  <article className="qa-doc max-w-none text-sm leading-relaxed space-y-3
                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-3
                    [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2
                    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                    [&_p]:my-2
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                    [&_li]:my-1
                    [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-xs
                    [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto
                    [&_pre_code]:bg-transparent [&_pre_code]:p-0
                    [&_a]:text-primary [&_a]:underline
                    [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
                    [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_th]:bg-muted
                    [&_td]:border [&_td]:border-border [&_td]:p-2
                    [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                    [&_hr]:my-4 [&_hr]:border-border">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {current.content}
                    </ReactMarkdown>
                  </article>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">Selecione um documento.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}