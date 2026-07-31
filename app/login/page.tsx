import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Bienvenido de nuevo</h1>
        <p className="text-muted">Accede a tu panel de Nerox Social IA</p>
        <LoginForm />
        <p className="auth-switch">¿No tienes cuenta? <a href="/register">Regístrate</a></p>
      </section>
    </main>
  );
}
