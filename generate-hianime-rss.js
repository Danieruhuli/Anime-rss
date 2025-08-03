const fs = require('fs');
const { JSDOM } = require('jsdom');

// Verificar si el archivo HTML está vacío
const htmlPath = 'simulcast-hianime.html';
if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size === 0) {
  console.log('⚠️ Archivo HTML vacío o no encontrado. RSS no será generado.');
  process.exit(0); // Finaliza sin error
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

// Encuentra todos los .flw-item
const itemsDOM = document.querySelectorAll('.flw-item');

const items = Array.from(itemsDOM).map(el => {
  const titleEl = el.querySelector('h3.film-name a');
  const episodeEl = el.querySelector('.tick-item.tick-sub');
  const imgEl = el.querySelector('img');
  const posterLinkEl = el.querySelector('a.film-poster-ahref');

  const seasonTitle = titleEl?.textContent.trim() || '';
  const episodeNumber = episodeEl?.textContent.trim() || '';
  const partialLink = titleEl?.getAttribute('href') || '';
  const fullLink = `https://hianime.to/watch${partialLink}`;
  const image = imgEl?.getAttribute('data-src') || '';
  const guidId = posterLinkEl?.getAttribute('data-id') || '';
  const pubDate = new Date().toUTCString();

  return {
    title: `${seasonTitle} - Episode ${episodeNumber}`,
    link: fullLink,
    pubDate,
    description: `Episode ${episodeNumber}`,
    image,
    guid: `${guidId}-${episodeNumber}`
  };
});

// Genera el contenido del archivo RSS
const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>HiAnime - Recently Updated</title>
  <link>https://hianime.to/recently-updated</link>
  <description>Lista RSS de episodios actualizados recientemente en HiAnime</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid isPermaLink="false">${item.guid}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[<img src="${item.image}" /><br/>${item.description}]]></description>
    </item>
  `).join('\n')}
</channel>
</rss>`;

// Crea la carpeta docs si no existe y guarda el archivo XML
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/hianime-rss.xml', rss);
console.log('✅ RSS generado: docs/hianime-rss.xml');
