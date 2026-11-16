import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = { session: Session | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setLoading(false); });
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    return () => sub.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export type Role =
  | "superadmin" | "direttivo" | "segreteria" | "tesoriere" | "direttore_sportivo" | "allenatore"
  | "dirigente_accompagnatore" | "ufficio_stampa" | "responsabile_safeguarding" | "responsabile_commerciale"
  | "cassiere" | "steward" | "genitore" | "atleta" | "sponsor";

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadmin", direttivo: "Direttivo", segreteria: "Segreteria", tesoriere: "Tesoriere",
  direttore_sportivo: "Direttore sportivo", allenatore: "Allenatore", dirigente_accompagnatore: "Dirigente accompagnatore",
  ufficio_stampa: "Ufficio stampa", responsabile_safeguarding: "Resp. safeguarding", responsabile_commerciale: "Resp. commerciale",
  cassiere: "Cassiere", steward: "Steward", genitore: "Genitore", atleta: "Atleta", sponsor: "Sponsor",
};

export function useRoles() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const q = useQuery({
    queryKey: ["my-roles", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as Role);
    },
  });
  const roles = q.data ?? [];
  const hasAny = (list?: Role[]) => !list || roles.includes("superadmin") || list.some((r) => roles.includes(r));
  return { roles, hasAny, loading: q.isLoading };
}
