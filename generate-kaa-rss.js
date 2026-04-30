const fs = require('fs');
const { JSDOM } = require('jsdom');

// Verificar si el archivo HTML está vacío
const htmlPath = 'simulcast-kaa.html';
if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size === 0) {
  console.log('⚠️ Archivo HTML vacío o no encontrado. RSS no será generado.');
  process.exit(0); // Finaliza sin error
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

// Extraer todos los poster IDs del HTML
const posterMatches = html.match(/poster:\{[^}]+\}/g) || [];
const posterIds = posterMatches.map(p => {
  const hqMatch = p.match(/hq:"([^"]+)-hq"/);
  if (hqMatch) {
    return hqMatch[1]; 
  }
  return null;
}).filter(Boolean);

console.log(`📸 Se encontraron ${posterIds.length} posters`);

// Encuentra todos los .show-item dentro de .latest-update
const latestUpdate = document.querySelector('.latest-update');
const rows = latestUpdate?.querySelectorAll('.row.mt-0');
const rowWithItems = rows?.[1];
const itemsDOM = rowWithItems ? rowWithItems.querySelectorAll('.show-item') : [];

const items = Array.from(itemsDOM).map((el, index) => {
  // Title: .show-title a span
  const titleEl = el.querySelector('.show-title a span');
  const title = titleEl?.textContent.trim() || '';
  
  // Link: del anchor del v-card
  const linkEl = el.querySelector('a.v-card');
  const partialLink = linkEl?.getAttribute('href') || '';
  
  // Solo procesar si es un link válido de kaa (no externo)
  if (!partialLink || !partialLink.startsWith('/')) {
    return null;
  }
  
  const fullLink = `https://kaa.lt${partialLink}`;
  
  // Type: el primer v-chip__content en .d-flex.align-center (TV, ONA, etc)
  const typeChips = el.querySelectorAll('.d-flex.align-center .v-chip__content');
  const type = typeChips[0]?.textContent.trim() || '';
  
  // Episode: el segundo v-chip__content (EP XX)
  const episodeNumber = typeChips[1]?.textContent.trim() || '';
  
  // Sub/Dub: el tercer v-chip__content
  const subDub = typeChips[2]?.textContent.trim() || '';
  
  const pubDate = new Date().toUTCString();
  
  // Extraer el slug del link para construir la imagen
  const pathParts = partialLink.split('/');
  const slug = pathParts[1] || '';
  
  // Usar el poster ID correspondiente al índice
  // El orden de los posterIds debe coincidir con el orden de los show-items
  const posterId = posterIds[index] || slug;
  
  // Image: construir URL de imagen
  // Patrón: https://kaa.lt/image/poster/{posterId}-hq.webp
  const image = `https://kaa.lt/image/poster/${posterId}-hq.webp`;
  
  // GUID: title + episodeNumber
  const guid = `${title}-${episodeNumber}`;

  return {
    title: `${title} - ${episodeNumber}`,
    link: fullLink,
    pubDate,
    description: `${type} - ${episodeNumber} - ${subDub}`,
    image,
    guid
  };
});

// Filtra items nulos y vacíos (sin excluir los que tienen " - ")
const validItems = items.filter(item => item && item.title && item.title.length > 0);

console.log(`📺 Se encontraron ${validItems.length} episodios`);

// Genera el contenido del archivo RSS
const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>KickAssAnime (KAA) - Recently Updated</title>
  <link>https://kaa.lt</link>
  <description>Lista RSS de episodios actualizados recientemente en KickAssAnime</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${validItems.map(item => `
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
fs.writeFileSync('docs/kaa-rss.xml', rss);
console.log('✅ RSS generado: docs/kaa-rss.xml');