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
    serverComponentsExternalPackages: ["ffmpeg-static"],
    // Incluye el binario de FFmpeg y las fuentes en la función que renderiza los Reels
    outputFileTracingIncludes: {
      "/api/publicaciones/[id]/video": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**"],
    },
  },
};

module.exports = nextConfig;
