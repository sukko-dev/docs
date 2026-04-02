import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'quickstart',
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/architecture',
        'concepts/multi-tenancy',
        'concepts/channels',
        'concepts/authentication',
        'concepts/message-backends',
        'concepts/gateway',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        {
          type: 'category',
          label: 'SDK Integration',
          items: [
            'guides/sdk/react',
            'guides/sdk/vue',
            'guides/sdk/svelte',
            'guides/sdk/vanilla-ts',
            'guides/sdk/react-native',
          ],
        },
        {
          type: 'category',
          label: 'Deployment',
          items: [
            'guides/deploy/local',
            'guides/deploy/kubernetes',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/cli',
        'reference/rest-api',
        'reference/configuration',
        {
          type: 'category',
          label: 'SDK',
          items: [
            'reference/sdk/core',
            'reference/sdk/websocket',
            'reference/sdk/react',
            'reference/sdk/vue',
            'reference/sdk/svelte',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Editions',
      items: [
        'editions/comparison',
        'editions/upgrade',
        'editions/pricing',
      ],
    },
    'roadmap',
  ],
};

export default sidebars;
