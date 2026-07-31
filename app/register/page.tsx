import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Crea tu cuenta</h1>
        <p className="text-muted">Empieza a automatizar tu marketing con IA</p>
        <RegisterForm />
        <p className="auth-switch">¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
      </section>
    </main>
  );
}
