import { defineConfig, markdown } from 'sourcey'

export default defineConfig({
  name: 'platform-achievements',
  siteUrl: 'https://jonbogaty.com',
  baseUrl: '/platform-achievements',
  theme: {
    preset: 'default',
    colors: {
      primary: '#1c3a52',
      light: '#377eb7',
      dark: '#0d1b26',
    },
    fonts: {
      sans: 'system-ui, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    layout: {
      sidebar: '17rem',
      toc: '18rem',
      content: '46rem',
    },
    css: ['./brand.css'],
  },
  favicon: './assets/favicon.svg',
  repo: 'https://github.com/jbcom/platform-achievements',
  editBranch: 'main',
  editBasePath: 'docs',
  prettyUrls: 'slash',
  navbar: {
    links: [
      { type: 'github', href: 'https://github.com/jbcom/platform-achievements' },
      { type: 'npm', href: 'https://www.npmjs.com/package/platform-achievements' },
    ],
  },
  footer: {
    links: [
      {
        type: 'link',
        label: 'MIT License',
        href: 'https://github.com/jbcom/platform-achievements/blob/main/LICENSE',
      },
      {
        type: 'link',
        label: 'Security',
        href: 'https://github.com/jbcom/platform-achievements/security/policy',
      },
    ],
  },
  navigation: {
    tabs: [
      {
        tab: 'Documentation',
        slug: '',
        source: markdown({
          groups: [
            {
              group: 'Getting Started',
              pages: ['introduction', 'getting-started'],
            },
            {
              group: 'Reference',
              pages: ['platforms', 'API', 'ARCHITECTURE'],
            },
            {
              group: 'Project',
              pages: ['decisions', 'contributing', 'release-history'],
            },
          ],
        }),
      },
    ],
  },
})
