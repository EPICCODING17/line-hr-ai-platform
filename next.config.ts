import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost }]
      : [],
  },
  // The single LIFF app is registered with endpoint `/liff/leave`, so LINE only
  // grants LIFF/login scope to paths UNDER /liff/leave. Other forms are opened
  // via `liff.line.me/{id}/<form>` → LINE concatenates onto the endpoint path
  // (`/liff/leave/<form>`), keeping them in-scope; these rewrites map them back
  // to their real routes. Lets new forms ship without re-registering the LIFF.
  async rewrites() {
    return [
      { source: "/liff/leave/ot", destination: "/liff/ot" },
      { source: "/liff/leave/document", destination: "/liff/document" },
      { source: "/liff/leave/checkin", destination: "/liff/checkin" },
    ];
  },
};

export default nextConfig;
