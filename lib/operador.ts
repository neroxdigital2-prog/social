// Quién puede ver y operar el Centro de control.
// VIGILANTE_ADMINS (emails separados por comas) en Vercel limita el acceso;
// si no existe, cualquier usuario con sesión puede verlo.
export function esOperador(email?: string | null): boolean {
  const lista = (process.env.VIGILANTE_ADMINS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.length === 0 || (!!email && lista.includes(email.toLowerCase()));
}

export function nombreActor(user?: { name?: string | null; email?: string | null } | null): string {
  if (!user) return "Usuario";
  if (user.name && user.email) return `${user.name} (${user.email})`;
  return user.name || user.email || "Usuario";
}
