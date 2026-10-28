// Voz en off en español con Gemini TTS (misma GEMINI_API_KEY gratuita de AI Studio).
// Devuelve un WAV mono 24 kHz listo para FFmpeg, o null si no hay voz disponible
// (el Reel se genera igualmente, solo con música).

const MODELOS_TTS = (process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts,gemini-2.5-flash-tts")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Voces de Gemini: Kore (femenina firme), Puck (masculina enérgica), Charon (masculina grave), Aoede (femenina cálida)
const VOZ = process.env.REEL_VOZ || "Kore";
const FRECUENCIA = 24000;

function pcmAWav(pcm: Buffer, frecuencia = FRECUENCIA): Buffer {
  const cabecera = Buffer.alloc(44);
  cabecera.write("RIFF", 0);
  cabecera.writeUInt32LE(36 + pcm.length, 4);
  cabecera.write("WAVE", 8);
  cabecera.write("fmt ", 12);
  cabecera.writeUInt32LE(16, 16);
  cabecera.writeUInt16LE(1, 20); // PCM
  cabecera.writeUInt16LE(1, 22); // mono
  cabecera.writeUInt32LE(frecuencia, 24);
  cabecera.writeUInt32LE(frecuencia * 2, 28);
  cabecera.writeUInt16LE(2, 32);
  cabecera.writeUInt16LE(16, 34);
  cabecera.write("data", 36);
  cabecera.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([cabecera, pcm]);
}

export interface VozGenerada {
  wav: Buffer;
  segundos: number;
}

export async function generarVoz(texto: string, apiKey = process.env.GEMINI_API_KEY): Promise<VozGenerada | null> {
  if (!apiKey || !texto.trim()) return null;

  const prompt = `Lee este texto en español de España, con voz cercana, enérgica y profesional, ritmo ágil de anuncio para redes sociales:\n\n${texto}`;

  for (const modelo of MODELOS_TTS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } },
            },
          }),
        }
      );
      if (!res.ok) {
        console.error(`generarVoz: ${modelo} respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
        continue;
      }
      const data = await res.json();
      const b64: string | undefined = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string } }) => p.inlineData?.data
      )?.inlineData?.data;
      if (!b64) continue;
      const pcm = Buffer.from(b64, "base64");
      return { wav: pcmAWav(pcm), segundos: pcm.length / 2 / FRECUENCIA };
    } catch (error) {
      console.error(`generarVoz: fallo con ${modelo}:`, error);
    }
  }
  return null;
}
