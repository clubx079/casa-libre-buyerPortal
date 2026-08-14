/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Images are served through the /api/media proxy (private Backblaze bucket),
  // rendered with plain <img>, so the next/image optimizer stays unconfigured.
};
module.exports = nextConfig;
