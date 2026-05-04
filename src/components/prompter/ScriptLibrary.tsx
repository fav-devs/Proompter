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
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg tracking-tight">Library</h2>
        <div className="flex gap-1">
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
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => fileRef.current?.click()} title="Import">
            <Upload className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onExport} title="Export current">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="default" className="h-8 w-8" onClick={onCreate} title="New">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
        {scripts.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={
                "group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors cursor-pointer " +
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
                  className="h-7 border-none bg-transparent px-1 font-serif text-sm focus-visible:ring-0"
                />
              ) : (
                <span className="truncate font-serif text-sm">{s.title || "Untitled"}</span>
              )}
              <Button
                size="icon" variant="ghost"
                className="ml-auto h-7 w-7 opacity-0 group-hover:opacity-100"
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
