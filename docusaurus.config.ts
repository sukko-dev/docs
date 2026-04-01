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

  organizationName: 'klurvio',
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
          editUrl: 'https://github.com/klurvio/sukko-docs/edit/main/',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
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
          to: '/reference/cli',
          label: 'CLI',
          position: 'left',
        },
        {
          to: '/reference/rest-api',
          label: 'API',
          position: 'left',
        },
        {
          to: '/editions/comparison',
          label: 'Editions',
          position: 'left',
        },
        {
          href: 'https://github.com/klurvio/sukko-cli',
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
            {label: 'Quickstart', to: '/quickstart'},
            {label: 'Concepts', to: '/concepts/architecture'},
            {label: 'SDK Guides', to: '/guides/sdk/react'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'CLI', to: '/reference/cli'},
            {label: 'REST API', to: '/reference/rest-api'},
            {label: 'Configuration', to: '/reference/configuration'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/klurvio/sukko-cli'},
            {label: 'Issues', href: 'https://github.com/klurvio/sukko-issues/issues'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Klurvio. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'go', 'tsx'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
