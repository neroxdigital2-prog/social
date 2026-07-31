"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const payload = { name: formData.get("name"), email: formData.get("email"), password: formData.get("password") };

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "Email ya registrado" ? "Este email ya está registrado" : "Revisa los datos ingresados");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email: payload.email, password: payload.password, redirect: false });
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="field"><label htmlFor="name">Nombre</label><input id="name" name="name" type="text" required minLength={2} autoComplete="name" /></div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading} aria-busy={loading}>{loading ? "Creando cuenta..." : "Crear cuenta"}</button>
    </form>
  );
}
