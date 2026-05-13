import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type RemoteRole, type RemoteState, genCode } from "@/lib/remote-sync";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  remote: RemoteState;
  onConnect: (state: RemoteState) => void;
  onDisconnect: () => void;
}

export function RemoteModal({ open, onOpenChange, remote, onConnect, onDisconnect }: Props) {
  const [hostCode] = useState(() => genCode());
  const [clientInput, setClientInput] = useState("");
  const [tab, setTab] = useState<RemoteRole>("host");

  const connect = (role: RemoteRole, code: string) => {
    onConnect({ role, code: code.toUpperCase() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-widest">Remote Sync</DialogTitle>
        </DialogHeader>

        {remote ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Connected as {remote.role}
              </p>
              <p className="mt-2 font-mono text-3xl tracking-[0.3em] text-primary">{remote.code}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onDisconnect}>Disconnect</Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as RemoteRole)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="host" className="font-mono text-[11px] uppercase tracking-wider">Host</TabsTrigger>
              <TabsTrigger value="client" className="font-mono text-[11px] uppercase tracking-wider">Join</TabsTrigger>
            </TabsList>

            <TabsContent value="host" className="flex flex-col items-center gap-4 pt-4">
              <p className="text-center font-mono text-[10px] text-muted-foreground">
                Share this code. The other device joins and mirrors your script.
              </p>
              <p className="font-mono text-4xl tracking-[0.35em] text-primary">{hostCode}</p>
              <Button onClick={() => connect("host", hostCode)}>Start hosting</Button>
            </TabsContent>

            <TabsContent value="client" className="flex flex-col items-center gap-4 pt-4">
              <p className="text-center font-mono text-[10px] text-muted-foreground">
                Enter the 6-character code from the host device.
              </p>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-2xl uppercase tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary"
                maxLength={6}
                placeholder="XXXXXX"
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && clientInput.length === 6) connect("client", clientInput); }}
              />
              <Button
                disabled={clientInput.length !== 6}
                onClick={() => connect("client", clientInput)}
              >
                Join
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
