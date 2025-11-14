import i18next from '../../i18n';

const {t} = i18next;

const relay = [
  {
    name: 'relay_enabled',
    type: 'radio',
    title: 'Enable Relay Server',
    description:
      'Forward Xbox gameplay stream to a remote relay server in real-time via WebRTC for rebroadcasting',
    data: [
      {value: false, text: t('Disable')},
      {value: true, text: t('Enable')},
    ],
  },
  {
    name: 'relay_server_url',
    type: 'text',
    title: 'Cloudflare Worker URL',
    description:
      'Cloudflare Worker URL for relay server (e.g., https://xbox-relay.yourdomain.workers.dev)',
    placeholder: 'https://xbox-relay.yourdomain.workers.dev',
  },
  {
    name: 'relay_stun_servers',
    type: 'text',
    title: 'Custom STUN Servers',
    description:
      'Comma-separated list of additional STUN server URLs for relay connection (e.g., stun:stun.example.com:3478)',
    placeholder: 'stun:stun.example.com:3478',
  },
];

export default relay;
