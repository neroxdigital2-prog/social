/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // ffmpeg-static resuelve la ruta de su binario con __dirname: no debe empaquetarse
    serverComponentsExternalPackages: ["ffmpeg-static", "pdfkit"],
    // Incluye el binario de FFmpeg y las fuentes en la función que renderiza los Reels
    outputFileTracingIncludes: {
      "/api/publicaciones/[id]/video": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**"],
      // pdfkit lee sus fuentes (Helvetica.afm…) del disco: hay que incluirlas en la función
      "/api/crecimiento/pdf": ["./node_modules/pdfkit/js/data/**"],
    },
  },
};

module.exports = nextConfig;
