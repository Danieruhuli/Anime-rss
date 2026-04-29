const fs = require('fs');
const { JSDOM } = require('jsdom');

// Verificar si el archivo HTML está vacío
const htmlPath = 'simulcast-jkanime.html';
if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size === 0) {
  console.log('⚠️ Archivo HTML vacío o no encontrado. RSS no será generado.');
  process.exit(0);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

// Selecciona el contenedor principal y las tarjetas dentro
const container = document.querySelector('.row.mode1.autoimage');
const cards = container
  ? Array.from(container.querySelectorAll('.card'))
  : Array.from(document.querySelectorAll('.row.mode1.autoimage .card'));

const items = cards.map(card => {
  const linkEl = card.querySelector('a');
  const titleEl = card.querySelector('h5.card-title');
  const badgeEp = card.querySelector('.badges .badge.badge-primary, .badges .badge-primary');
  const imgEl = card.querySelector('img');

  const seasonTitle = titleEl?.textContent.trim() || '';
  const episodeNumber = badgeEp?.textContent.trim() || '';
  let link = linkEl?.getAttribute('href') || '';
  if (link && !link.startsWith('http')) {
    link = `https://jkanime.net${link}`;
  }
  const image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-animepic') || '';
  const pubDate = new Date().toUTCString();
  const guid = `${seasonTitle} ${episodeNumber}`.trim();

  return {
    title: `${seasonTitle} - ${episodeNumber}`.trim(),
    link,
    pubDate,
    description: episodeNumber ? `${episodeNumber} disponible` : seasonTitle,
    image,
    guid
  };
}).filter(i => i.title && i.link);

// Genera el contenido del archivo RSS
const rss = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n<channel>\n  <title>JKAnime - Nuevos Anime</title>\n  <link>https://jkanime.net/</link>\n  <description>Lista RSS de episodios de anime actualizados recientemente en JkAnime</description>\n  <language>es</language>\n  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n  ${items.map(item => `\n    <item>\n      <title><![CDATA[${item.title}]]></title>\n      <link>${item.link}</link>\n      <guid isPermaLink="false">${item.guid}</guid>\n      <pubDate>${item.pubDate}</pubDate>\n      <description><![CDATA[<img src="${item.image}" /><br/>${item.description}]]></description>\n    </item>\n  `).join('\n')}\n</channel>\n</rss>`;

// Crea la carpeta docs si no existe y guarda el archivo XML
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/jkanime-rss.xml', rss);
console.log('✅ RSS generado: docs/jkanime-rss.xml');
