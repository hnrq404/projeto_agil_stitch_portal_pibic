import colors from 'tailwindcss/colors';

/**
 * Tokens do design system (institutional_scientific_portal/DESIGN.md).
 * Nenhuma cor/fonte é escrita "na mão" nos componentes: use estas classes.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ruby — navegação, ações principais, cabeçalhos de tabela.
        primary: {
          DEFAULT: '#9B1C31',
          strong: '#741629',
          hover: '#83172C',
          soft: '#FCE8EB',
          muted: '#B75B6B',
        },
        // Dourado — destaques e ações secundárias.
        secondary: {
          DEFAULT: '#8A6412',
          strong: '#6E4D08',
          soft: '#FAF0D5',
          light: '#F2C14E',
        },
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          subtle: '#64748B',
        },
        line: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        focus: '#93C5FD',
        // Estados semânticos (DESIGN.md › Semantic Status Signals). Use `success-50`,
        // `danger-700` etc. em vez de emerald/rose/amber/sky direto: trocar o tom
        // (ou criar um tema escuro) passa a ser uma mudança só aqui.
        success: colors.emerald,
        warning: colors.amber,
        danger: colors.rose,
        info: colors.sky,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
        raised: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        overlay: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
      },
      maxWidth: {
        layout: '1280px',
      },
    },
  },
  plugins: [],
};
