/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The widget page is meant to be framed by other sites.
        source: "/widget",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/((?!widget).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
