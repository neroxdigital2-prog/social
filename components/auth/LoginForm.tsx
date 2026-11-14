"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const auto = useRef(false);

  async function entrarPortal(silencioso = false) {
    setPortalLoading(true);
    if (!silencioso) setError("");
    const res = await signIn("portal", { redirect: false });
    setPortalLoading(false);
    if (res?.error || !res?.ok) {
      if (!silencioso) setError("No hay sesión en el acceso único. Entra primero en acceso.nerox.es");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  // Llegando desde el portal (?portal=1) entra automáticamente.
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    if (new URLSearchParams(window.location.search).get("portal") === "1") void entrarPortal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) { setError("Email o contraseña incorrectos"); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <button type="button" className="btn-primary" onClick={() => entrarPortal(false)} disabled={portalLoading} aria-busy={portalLoading}>
        {portalLoading ? "Comprobando acceso..." : "Entrar con acceso único NEROX"}
      </button>
      <p className="text-muted" style={{ textAlign: "center", margin: "12px 0" }}>o con tu clave</p>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input id="password" name="password" type={showPass ? "text" : "password"} required autoComplete="current-password" minLength={8} style={{ flex: 1 }} />
          <button type="button" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPass} style={{ width: 48, fontSize: 18, cursor: "pointer" }}>
            {showPass ? "🙈" : "👁"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading} aria-busy={loading}>{loading ? "Accediendo..." : "Entrar"}</button>
    </form>
  );
}
