// Avisos por email (SMTP de IONOS u otro). Variables en Vercel:
//   SMTP_USER, SMTP_PASS            → buzón que envía (p. ej. avisos@nerox.es)
//   AVISOS_EMAIL_PARA               → destinatarios, separados por comas
//   SMTP_HOST (smtp.ionos.es), SMTP_PORT (587) → opcionales
import nodemailer from "nodemailer";

export function destinatariosEmail(): string[] {
  return (process.env.AVISOS_EMAIL_PARA || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function emailConfigurado(): boolean {
  return !!process.env.SMTP_USER && !!process.env.SMTP_PASS && destinatariosEmail().length > 0;
}

export interface EntregaEmail {
  para: string;
  ok: boolean;
  error?: string;
}

/** Convierte el HTML de Telegram (b, i, code) en un email sencillo. */
export function htmlEmail(htmlTelegram: string, pie?: string): string {
  const cuerpo = htmlTelegram.replace(/\n/g, "<br>");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:640px">
${cuerpo}
<hr style="border:0;border-top:1px solid #e4e4e7;margin:20px 0">
<p style="font-size:12px;color:#71717a">${pie || "Vigilante de Nerox Social IA · <a href=\"https://social.nerox.es/centro-control\">Centro de control</a>"}</p>
</div>`;
}

export async function enviarEmail(asunto: string, html: string): Promise<{ entregas: EntregaEmail[]; error?: string }> {
  const para = destinatariosEmail();
  if (!emailConfigurado()) {
    return { entregas: [{ para: para[0] || "—", ok: false, error: "Email sin configurar (SMTP_USER, SMTP_PASS, AVISOS_EMAIL_PARA)" }], error: "Email sin configurar" };
  }
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ionos.es",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const entregas = await Promise.all(
    para.map(async (d) => {
      try {
        await transporte.sendMail({ from: `"Nerox Vigilante" <${process.env.SMTP_USER}>`, to: d, subject: asunto, html });
        return { para: d, ok: true };
      } catch (e) {
        return { para: d, ok: false, error: e instanceof Error ? e.message.slice(0, 200) : String(e) };
      }
    })
  );
  return { entregas, error: entregas.find((e) => !e.ok)?.error };
}
