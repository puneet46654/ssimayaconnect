import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/logos/ssilogo.png',
      },
    ],
  },
};

export default nextConfig;
