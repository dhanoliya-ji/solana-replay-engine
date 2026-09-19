import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  /**
   * The results report is a self-contained page rendered by Quarto from
   * report/report.qmd into public/report/index.html. Next does not serve
   * directory indexes from public/, so /report would otherwise 404.
   */
  async rewrites() {
    return [{ source: '/report', destination: '/report/index.html' }];
  }
};

export default nextConfig;
