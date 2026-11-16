import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Shield } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Accedi – GEMA360" },
      { name: "description", content: "Accedi al gestionale della La T Tecnica Gema Montecatini." },
      { property: "og:title", content: "Accedi – GEMA360" },
      { property: "og:description", content: "Area riservata a società, famiglie e sponsor." },
    ],
  }),
  component: AuthPage,
});

const cred = z.object({
  email: z.string().trim().email("Email non valida"),
  password: z.string().min(8, "Almeno 8 caratteri"),
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const p = cred.safeParse({ email, password });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(p.data);
    setBusy(false);
    if (error) toast.error("Credenziali non corrette");
  }
  async function signup(e: React.FormEvent) {
    e.preventDefault();
    const p = cred.safeParse({ email, password });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      ...p.data,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Controlla la tua email per confermare la registrazione.");
  }
  async function magic() {
    if (!z.string().email().safeParse(email).success)
      return toast.error("Inserisci un'email valida");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/dashboard", shouldCreateUser: false },
    });
    if (error) toast.error(error.message);
    else toast.success("Ti abbiamo inviato il link di accesso via email.");
  }
  async function forgot() {
    if (!z.string().email().safeParse(email).success) return toast.error("Inserisci la tua email");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Email per reimpostare la password inviata.");
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error("Accesso con Google non riuscito");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-hero p-10 text-primary-foreground lg:flex">
        <Shield className="h-16 w-16" />
        <div>
          <h1 className="font-display text-6xl font-extrabold uppercase">
            GEMA<span className="text-brand-red">360</span>
          </h1>
          <p className="mt-2 max-w-sm opacity-85">
            La T Tecnica Gema Montecatini · PalaTerme · Serie A2
          </p>
        </div>
        <p className="text-xs opacity-70">Main sponsor La T Tecnica S.p.A.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Shield className="mb-6 h-14 w-14 lg:hidden" />
          <h2 className="font-display text-3xl font-bold uppercase text-primary">Area riservata</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Il primo utente registrato diventa superadmin.
          </p>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Registrati</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={login} className="space-y-3">
                <div>
                  <Label htmlFor="e">Email</Label>
                  <Input
                    id="e"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="p">Password</Label>
                  <Input
                    id="p"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  Accedi
                </Button>
                <div className="flex justify-between text-xs">
                  <button type="button" onClick={magic} className="text-accent underline">
                    Accedi senza password (link via email)
                  </button>
                  <button
                    type="button"
                    onClick={forgot}
                    className="text-muted-foreground underline"
                  >
                    Password dimenticata?
                  </button>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signup} className="space-y-3">
                <div>
                  <Label htmlFor="n">Nome e cognome</Label>
                  <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="e2">Email</Label>
                  <Input
                    id="e2"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="p2">Password</Label>
                  <Input
                    id="p2"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  Crea account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            oppure
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={google}
            className="flex h-10 w-full items-center justify-center gap-[10px] rounded-md border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.160-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.490-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.750c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continua con Google
          </button>
        </div>
      </div>
    </div>
  );
}
