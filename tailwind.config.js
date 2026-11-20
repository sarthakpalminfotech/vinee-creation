import animate from 'tailwindcss-animate';

// Vinee Creations "Emerald Heritage" palette (client brand sheet, Oct 2026).
//   Deep forest #123D32 (structure / sidebar) · Emerald #16785B (interaction) · Sage #A9C8B4 (hover / highlights)
//   Soft mint #EAF4ED (selected rows) · Warm ivory #F8F9F4 (app background) · Champagne gold #C3A56A (brand accent only)
//   Text #1C3029 · Muted #687B71 · Border #DCE8DF · Success #16785B · Warning #A66A22 · Error #B65D48
// The screens were written with Tailwind's stock colour names (slate, emerald, amber, red, sky, violet…), so those
// scales are redefined here from the brand tokens: every existing class follows the theme without touching each screen.
const emeraldScale = {
  50: '#EAF4ED', 100: '#D6EADD', 200: '#A9C8B4', 300: '#7FB497', 400: '#4C9A7A', 500: '#23896A',
  600: '#16785B', 700: '#11644B', 800: '#0F523E', 900: '#123D32', 950: '#0B2720',
};
// green-tinted neutrals: 50 = ivory, 200 = border, 500 = muted text, 900 = primary text
const neutral = {
  50: '#F8F9F4', 100: '#EEF3EE', 200: '#DCE8DF', 300: '#C2D3C7', 400: '#93A69B', 500: '#687B71',
  600: '#50635A', 700: '#3A4C43', 800: '#283A32', 900: '#1C3029', 950: '#12221C',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: neutral,
        gray: neutral,
        zinc: neutral,
        emerald: emeraldScale,
        green: emeraldScale,
        amber: {
          50: '#FAF1E4', 100: '#F3E2C6', 200: '#E8C995', 300: '#D9AB63', 400: '#C58F42', 500: '#B47A2E',
          600: '#A66A22', 700: '#87551B', 800: '#6C4418', 900: '#573814', 950: '#311E09',
        },
        yellow: {
          50: '#FAF1E4', 100: '#F3E2C6', 200: '#E8C995', 300: '#D9AB63', 400: '#C58F42', 500: '#B47A2E',
          600: '#A66A22', 700: '#87551B', 800: '#6C4418', 900: '#573814', 950: '#311E09',
        },
        red: {
          50: '#FAEFEC', 100: '#F4DCD6', 200: '#E9BCB1', 300: '#DB9A8A', 400: '#CB7C68', 500: '#BF6A55',
          600: '#B65D48', 700: '#954837', 800: '#78392C', 900: '#612F25', 950: '#351611',
        },
        rose: {
          50: '#FAEFEC', 100: '#F4DCD6', 200: '#E9BCB1', 300: '#DB9A8A', 400: '#CB7C68', 500: '#BF6A55',
          600: '#B65D48', 700: '#954837', 800: '#78392C', 900: '#612F25', 950: '#351611',
        },
        // categorical stage colours (mill / dyeing / job work), muted so they sit with the greens
        sky: {
          50: '#ECF4F6', 100: '#D5E7EC', 200: '#AED0DA', 300: '#80B3C2', 400: '#5394A8', 500: '#3A7D92',
          600: '#2D6A7D', 700: '#265868', 800: '#224956', 900: '#1E3D48', 950: '#11262E',
        },
        blue: {
          50: '#ECF4F6', 100: '#D5E7EC', 200: '#AED0DA', 300: '#80B3C2', 400: '#5394A8', 500: '#3A7D92',
          600: '#2D6A7D', 700: '#265868', 800: '#224956', 900: '#1E3D48', 950: '#11262E',
        },
        violet: {
          50: '#F3EFF5', 100: '#E6DDEA', 200: '#CEBDD6', 300: '#B297BD', 400: '#9575A3', 500: '#7E5D8C',
          600: '#6A4B77', 700: '#583E63', 800: '#483452', 900: '#3C2C44', 950: '#241A29',
        },
        indigo: {
          50: '#F3EFF5', 100: '#E6DDEA', 200: '#CEBDD6', 300: '#B297BD', 400: '#9575A3', 500: '#7E5D8C',
          600: '#6A4B77', 700: '#583E63', 800: '#483452', 900: '#3C2C44', 950: '#241A29',
        },
        orange: {
          50: '#FBF0E9', 100: '#F5DDCD', 200: '#EBBB9C', 300: '#DE9669', 400: '#CF7745', 500: '#BE6331',
          600: '#A65229', 700: '#874324', 800: '#6D3820', 900: '#592F1C', 950: '#31170C',
        },
        forest: { DEFAULT: '#123D32', light: '#1E5244', lighter: '#2A6353', dark: '#0C2D24' },
        sage: '#A9C8B4',
        mint: '#EAF4ED',
        ivory: '#F8F9F4',
        gold: { DEFAULT: '#C3A56A', light: '#D9C394', dark: '#8F7440' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          ...emeraldScale,
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          active: 'hsl(var(--primary-active))',
          soft: 'hsl(var(--primary-soft))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          soft: 'hsl(var(--accent-soft))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          soft: 'hsl(var(--destructive-soft))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px rgb(18 61 50 / 0.05)',
        soft: '0 1px 2px rgb(18 61 50 / 0.04), 0 2px 8px rgb(18 61 50 / 0.05)',
        md: '0 2px 6px rgb(18 61 50 / 0.06), 0 6px 16px rgb(18 61 50 / 0.07)',
        lg: '0 4px 12px rgb(18 61 50 / 0.08), 0 12px 28px rgb(18 61 50 / 0.10)',
        pop: '0 4px 12px rgb(18 61 50 / 0.08), 0 12px 32px rgb(18 61 50 / 0.12)',
        bar: '0 -1px 0 rgb(18 61 50 / 0.06), 0 -6px 16px rgb(18 61 50 / 0.06)',
      },
    },
  },
  plugins: [animate],
}
