/** @type {import('tailwindcss').Config} */
export default {
  // Toggle dark mode by adding/removing the 'dark' class on <html>
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Montserrat for all headings, Inter for body (loaded in index.html)
        heading: ['Montserrat', 'sans-serif'],
        body: ['Inter', 'system-ui'],
      },
      colors: {
        // ── Brand palette ──────────────────────────────────────
        // Light mode primaries
        cocoa: '#1C1A17',           // body text, input borders
        'off-white': '#F6F1E7',     // left card bg, page bg base
        surface: '#FFFFFF',         // right form card bg
        pawpaw: '#E8623C',          // accents, focus ring, CTA fill
        moringa: '#2F5D4B',         // primary button fill, bold heading text on left panel
        'moringa-faded': '#7FB096', // dark mode button + landing cards at 50% opacity

        // Dark mode counterparts
        'black-surface': '#221E18', // left card overlay in dark
        'black-box': '#121212',     // right form card in dark
        'black-pawpaw': '#F08959',  // accent/focus ring in dark
        'dark-white': '#E5E7EB',    // all text in dark
        'dark-bg': '#171410',       // dark background base (joins green gradient)
        'dark-sec': '#9CA3AF' // faded texts
      },
      screens: {
        // Mobile-first. 320px is the floor.
        xs: '320px',
      },
      backgroundImage: {
        // Landing page hero gradient: off-white to moringa, 160deg
        'brand-gradient': 'linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)',
        // Dark variant: dark-bg to moringa-faded
        'brand-gradient-dark': 'linear-gradient(170deg, #405245 10%, #2A3129 45%, #2A3129 10%, #171410 100%)',
      },
      keyframes: {
        // Conveyor belt text animation (auth page left panel)
        // Items scroll vertically. Each item is one row height (1/3 of visible area).
        // Three items visible at once. Deferred to animation phase but keyframe defined now.
        conveyorItem: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '10%':  { transform: 'translateY(0)',    opacity: '1' },
          '33%':  { transform: 'translateY(0)',    opacity: '1' },
          '43%':  { transform: 'translateY(-100%)',opacity: '0' },
          '100%': { transform: 'translateY(-100%)',opacity: '0' },
        },
        // Typing cursor blink for hero headline animation
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        // Image crossfade for auth left panel background
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.8s ease forwards',
        'fade-out': 'fadeOut 0.8s ease forwards',
      },
    },
  },
  plugins: [],
}