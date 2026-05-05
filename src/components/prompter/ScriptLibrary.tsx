import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Script } from "@/lib/teleprompter-store";
import { FileText, Plus, Trash2, Download, Upload } from "lucide-react";
import { useRef } from "react";

interface Props {
  scripts: Script[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onImport: (file: File) => void;
  onExport: () => void;
}

export function ScriptLibrary({
  scripts, activeId, onSelect, onCreate, onDelete, onRename, onImport, onExport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-serif text-lg tracking-tight">Library</h2>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-1">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <Button size="icon" variant="ghost" className="h-9 w-full sm:h-8 sm:w-8" onClick={() => fileRef.current?.click()} title="Import">
            <Upload className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-full sm:h-8 sm:w-8" onClick={onExport} title="Export current">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="default" className="h-9 w-full sm:h-8 sm:w-8" onClick={onCreate} title="New">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {scripts.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={
                "group flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 transition-colors " +
                (active
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/40 hover:bg-muted/40")
              }
              onClick={() => onSelect(s.id)}
            >
              <FileText className={"h-4 w-4 shrink-0 " + (active ? "text-primary" : "text-muted-foreground")} />
              {active ? (
                <Input
                  value={s.title}
                  onChange={(e) => onRename(s.id, e.target.value)}
                  className="h-8 border-none bg-transparent px-1 font-serif text-base focus-visible:ring-0 sm:h-7 sm:text-sm"
                />
              ) : (
                <span className="truncate font-serif text-base sm:text-sm">{s.title || "Untitled"}</span>
              )}
              <Button
                size="icon" variant="ghost"
                className="ml-auto h-8 w-8 opacity-100 md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
