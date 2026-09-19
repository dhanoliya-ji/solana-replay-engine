import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  /**
   * The results report is a static Observable notebook in public/report/.
   * Next does not serve directory indexes from public/, so /report would 404;
   * this maps it to the report's entry page. The page resolves its own asset
   * paths, so /report, /report/ and /report/index.html all work.
   */
  async rewrites() {
    return [{ source: '/report', destination: '/report/index.html' }];
  }
};

export default nextConfig;
