/**
 * Design tokens — see README "Design direction" for the reasoning.
 * Subject: outreach = the moment a message leaves your hands and becomes visible to someone
 * else. Signature element: a postmark/stamp motif marks the moment a message is generated.
 */
const tailwindConfig = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}', './state/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16241F',       // near-black pine ink — headings, primary text
        paper: '#EFF1E4',     // pale sage paper — page background
        paperRaised: '#FFFFFF',
        flare: '#E2A33D',     // signal amber — primary CTA, the "sent" moment
        flareDark: '#B97C1F',
        rust: '#B5573A',      // warnings / duplicate flags
        moss: '#3F5B4D',      // secondary accents, links, borders
        mossLight: '#C9D3C6',
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        stamp: '2px',
      },
    },
  },
  plugins: [],
};

export default tailwindConfig;
