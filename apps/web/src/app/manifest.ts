import type { MetadataRoute } from 'next';

/**
 * Manifest da aplicação instalável.
 *
 * Existe porque a aplicação é usada de pé, no supermercado, para lançar um
 * gasto: uma PWA instalada no ecrã inicial é a diferença entre abrir uma app e
 * procurar um separador do browser.
 *
 * Cores: o `theme_color` é a cor da marca (verdigris, o `--primary` do tema
 * claro, `oklch(0.47 0.09 190)` = `#006a66`) e o `background_color` é o fundo do
 * tema claro (`#fcfcf9`), que é o que aparece no ecrã de arranque. O `<meta
 * name="theme-color">` do layout continua a mandar quando está presente e
 * acompanha o tema claro/escuro; o manifest só tem um valor possível, por isso
 * escolhe-se o do tema claro (o predefinido do sistema).
 *
 * Ícones: 192 e 512 para o Android, 512 `maskable` para o Android recortar sem
 * cortar o símbolo, e 180/152/167 (definidos no layout) para o iOS, que não lê
 * ícones do manifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Finanças Pessoais',
    short_name: 'Finanças',
    description:
      'Contas, orçamento e objetivos num só sítio, sem ligar ao banco. Instalável no telemóvel para lançar um gasto em segundos.',
    lang: 'pt-PT',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fcfcf9',
    theme_color: '#006a66',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // O Android recorta o ícone num círculo, num quadrado arredondado ou numa
        // gota: a versão `maskable` tem o símbolo dentro da zona segura.
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Lançar um gasto',
        short_name: 'Lançar',
        description: 'Abrir o extrato para registar um movimento',
        url: '/transacoes',
      },
      {
        name: 'Ver o painel',
        short_name: 'Painel',
        description: 'Saldo, previsão e o que falta fechar',
        url: '/',
      },
    ],
  };
}
