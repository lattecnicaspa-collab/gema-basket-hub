import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nuova password – GEMA360" }, { name: "description", content: "Imposta una nuova password." }, { property: "og:title", content: "Nuova password – GEMA360" }, { property: "og:description", content: "Imposta una nuova password." }] }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save() {
    if (pw.length < 8) return toast.error("Almeno 8 caratteri");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password aggiornata");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <h1 className="font-display text-3xl font-bold uppercase text-primary">Nuova password</h1>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nuova password" />
        <Button className="w-full" onClick={save}>Salva</Button>
      </div>
    </div>
  );
}
