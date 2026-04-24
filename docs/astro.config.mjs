import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  output: 'static',

  integrations: [
    starlight({
      title: 'Brise Docs',
      description: 'Documentation for Brise',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/cedricmarcellin/brise' },
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Getting Started', slug: 'getting-started' },
            { label: 'Configuration', slug: 'configuration' },
            { label: 'Deployment', slug: 'deployment' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'Overview', slug: 'api-overview' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Architecture', slug: 'architecture' },
          ],
        },
      ],
    }),
  ],

  redirects: {
    '/': '/getting-started',
  },
});
