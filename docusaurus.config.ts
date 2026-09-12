import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Sukko Docs',
  tagline: 'Multi-Tenant WebSocket Infrastructure',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.sukko.dev',
  baseUrl: '/',

  organizationName: 'sukko-dev',
  projectName: 'sukko-docs',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/sukko-dev/docs/edit/main/',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  // Diagrams are authored as mermaid rather than ASCII art or hand-written HTML:
  // the source stays diffable in review, and the rendered diagram follows the
  // site's light/dark colour mode instead of being fixed to one theme.
  markdown: {
    mermaid: true,
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexBlog: false,
      },
    ],
  ],

  themeConfig: {
    image: 'img/sukko-social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    // Mermaid follows the site's colour mode; without the pair, diagrams render
    // light-on-light in dark mode.
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
    navbar: {
      title: 'Sukko',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/reference/cli',
          label: 'CLI',
          position: 'left',
        },
        {
          to: '/docs/reference/rest-api',
          label: 'API',
          position: 'left',
        },
        {
          to: '/docs/editions/comparison',
          label: 'Editions',
          position: 'left',
        },
        {
          href: 'https://github.com/sukko-dev/cli',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Quickstart', to: '/docs/quickstart'},
            {label: 'Concepts', to: '/docs/concepts/architecture'},
            {label: 'SDK Guides', to: '/docs/guides/sdk/react'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'CLI', to: '/docs/reference/cli'},
            {label: 'REST API', to: '/docs/reference/rest-api'},
            {label: 'Configuration', to: '/docs/reference/configuration'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/sukko-dev/cli'},
            {label: 'Issues', href: 'https://github.com/sukko-dev/sukko-issues/issues'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Sukko Pty Ltd. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'go', 'tsx'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
