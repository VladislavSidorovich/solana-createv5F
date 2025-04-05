/** @type {import('next').NextConfig} */
const nextConfig = {
  // Включите strict mode для отлова потенциальных проблем
  reactStrictMode: true,

  // Настройки для Wallet Standard и Phantom
  async headers() {
    return [
      {
        source: '/', // Применяется к корневому пути
        headers: [
          // Wallet-Standard метаданные для идентификации dApp
          {
            key: 'Wallet-Standard',
            value: JSON.stringify({
              name: "TOkenTol", // Замените на название проекта
              icon: "https://yourdomain.com/icon.png", // URL иконки (обязательно HTTPS)
              description: "Secure Solana dApp for token management", // Описание
              links: {
                twitter: "x.com/thetokentol", // Соцсети
                telegram: "t.me/tokentol"
              },
            }),
          },
          // CORS для безопасного подключения кошельков
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Для продакшена укажите конкретные домены (не '*')
          },
        ],
      },
    ];
  },

  // Редирект с HTTP на HTTPS (актуально для собственного домена)
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'http://' }],
        destination: 'https://yourdomain.com/:path*', // Замените на ваш домен
        permanent: true,
      },
    ];
  },

  // Дополнительные настройки для Solana
  env: {
    NEXT_PUBLIC_SOLANA_NETWORK: "devnet", // Или "devnet" для тестов
    NEXT_PUBLIC_DAPP_URL: "https://yourdomain.com", // Полный URL вашего dApp
  },
};

module.exports = nextConfig;