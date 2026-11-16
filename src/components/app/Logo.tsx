import { useClub } from "@/hooks/useClub";
import { cn } from "@/lib/utils";

export function Shield({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <path d="M32 2 60 10v24c0 18-12 30-28 36C16 64 4 52 4 34V10Z" fill="var(--color-primary)" stroke="var(--color-brand-red)" strokeWidth="4" />
      <path d="M32 8v58C19 60 10 50 10 34V14Z" fill="var(--color-brand-red)" opacity="0.9" />
      <text x="32" y="44" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="20" fill="var(--color-primary-foreground)">LTG</text>
    </svg>
  );
}

export function ClubLogo({ className }: { className?: string }) {
  const { data } = useClub();
  if (data?.logo_url) return <img src={data.logo_url} alt={data.name} className={cn("object-contain", className)} />;
  return <Shield className={className} />;
}
