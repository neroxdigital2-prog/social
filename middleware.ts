export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/empresas/:path*",
    "/generador/:path*",
    "/calendario/:path*",
    "/crm/:path*",
    "/whatsapp/:path*",
    "/agenda/:path*",
    "/configuracion/:path*",
    "/suscripcion/:path*",
    "/agencia/:path*",
    "/seo/:path*",
    "/ads/:path*",
    "/facturacion/:path*",
    "/biblioteca/:path*",
    "/redes-sociales/:path*",
    "/resenas/:path*",
    "/email-marketing/:path*",
  ],
  runtime: "nodejs",
};
