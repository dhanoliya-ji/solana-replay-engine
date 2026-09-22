import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07111f',
        panel: '#0c1727',
        panelSoft: '#101f33',
        line: '#1f3554',
        accent: '#38bdf8',
        success: '#22c55e',
        warn: '#f59e0b',
        danger: '#f87171'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56, 189, 248, 0.08), 0 20px 60px rgba(2, 8, 23, 0.45)'
      },
      backgroundImage: {
        grid: 'radial-gradient(circle at top, rgba(56,189,248,0.12), transparent 35%)'
      }
    }
  },
  // tailwind-motionkit was removed: it is no longer published to the npm
  // registry (404 on install), so the project could not build anywhere. None of
  // its utilities were used -- the only animation classes in src/ are
  // animate-ping and animate-pulse, which Tailwind provides itself.
  plugins: []
};

export default config;
