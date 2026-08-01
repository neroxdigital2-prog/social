import { signOut } from "@/auth";

export function CerrarSesionBoton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="app-nav-logout">
        Cerrar sesión
      </button>
    </form>
  );
}
