// URL pública de la app para enlaces en avisos (Telegram). En Vercel la petición
// del cron puede llegar por el dominio *.vercel.app; preferimos el dominio propio.
export function urlApp(origenPeticion: string): string {
  const fija = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  return (fija || origenPeticion || "https://social.nerox.es").replace(/\/+$/, "");
}
