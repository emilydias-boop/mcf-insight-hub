import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, EyeOff } from "lucide-react";
import { ReactNode } from "react";

interface WidgetWrapperProps {
  id: string;
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  showControls?: boolean;
}

export function WidgetWrapper({ 
  title, 
  children, 
  onRemove, 
  showControls = false 
}: WidgetWrapperProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{title}</CardTitle>
        {showControls && onRemove && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRemove} className="text-destructive">
                <EyeOff className="mr-2 h-4 w-4" />
                Ocultar widget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
