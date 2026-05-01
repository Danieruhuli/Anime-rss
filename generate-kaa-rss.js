const fs = require('fs');
const { JSDOM } = require('jsdom');

// Verificar si el archivo HTML está vacío
const htmlPath = 'simulcast-kaa.html';
if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size === 0) {
  console.log('⚠️ Archivo HTML vacío o no encontrado. RSS no será generado.');
  process.exit(0);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

// ============================================================
// EXTRAER MAPA DE POSTERS: nombre base -> código poster
// Buscar en el HTML los datos con poster:{hq:"xxx-hq"} y slug:"xxx"
// ============================================================
const posterMap = {};

// Buscar todos los patrones poster:{hq:"xxx-hq"} en el HTML
const posterMatches = html.match(/poster:\{[^}]+hq:"([^"]+)-hq"[^}]*\}/g) || [];
const slugMatches = html.match(/slug:"([^"]+)"/g) || [];

// Crear mapa: slug completo -> poster ID (sin -hq)
posterMatches.forEach(match => {
  const hqMatch = match.match(/hq:"([^"]+)-hq"/);
  if (hqMatch) {
    const posterId = hqMatch[1]; // ej: "ganbare-nakamura-kun-20f3"
    // Guardar el código final del poster
    const parts = posterId.split('-');
    const code = parts[parts.length - 1];
    const baseName = parts.slice(0, -1).join('-');
    
    // Guardar en el mapa: nombre base -> código del poster
    if (baseName && code) {
      posterMap[baseName] = code;
    }
  }
});

// También extraer slugs para tener referencia
const slugList = [];
slugMatches.forEach(match => {
  const slugMatch = match.match(/slug:"([^"]+)"/);
  if (slugMatch) {
    slugList.push(slugMatch[1]);
  }
});

console.log(`📸 Se mapearon ${Object.keys(posterMap).length} posters`);

// ============================================================
// BUSCAR EPISODIOS EN LA SECCIÓN "Latest Update"
// ============================================================
const latestUpdate = document.querySelector('.latest-update');
const rows = latestUpdate?.querySelectorAll('.row.mt-0');
const rowWithItems = rows?.[1];
const itemsDOM = rowWithItems ? rowWithItems.querySelectorAll('.show-item') : [];

console.log(`📺 Se encontraron ${itemsDOM.length} episodios`);

const items = Array.from(itemsDOM).map((el) => {
  // Link: del anchor del v-card
  const linkEl = el.querySelector('a.v-card');
  const partialLink = linkEl?.getAttribute('href') || '';
  
  // Solo procesar si es un link válido de kaa
  if (!partialLink || !partialLink.startsWith('/')) {
    return null;
  }
  
  const fullLink = `https://kaa.lt${partialLink}`;
  
  // Title: .show-title a span
  const titleEl = el.querySelector('.show-title a span');
  const title = titleEl?.textContent.trim() || '';
  
  // Extraer el slug del link: /ganbare-nakamura-kun-1d6e/ep-6-1fb1cc
  const pathParts = partialLink.split('/');
  const fullSlug = pathParts[1] || ''; // "ganbare-nakamura-kun-1d6e"
  
  // Separar el código final del slug del link
  const slugParts = fullSlug.split('-');
  const linkCode = slugParts[slugParts.length - 1]; // "1d6e"
  const baseName = slugParts.slice(0, -1).join('-'); // "ganbare-nakamura-kun"
  
  // Buscar el código correcto del poster en el mapa
  const posterCode = posterMap[baseName] || linkCode;
  const posterId = `${baseName}-${posterCode}`;
  
  // Image: construir URL de imagen
  const image = `https://kaa.lt/image/poster/${posterId}-hq.webp`;
  
  // Episode: buscar en los chips
  const typeChips = el.querySelectorAll('.d-flex.align-center .v-chip__content');
  const episode = typeChips[1]?.textContent.trim() || '';
  
  const pubDate = new Date().toUTCString();
  
  // GUID: title + episode
  const guid = `${title}-${episode}`;

  return {
    title: title ? `${title}${episode ? ' - ' + episode : ''}` : '',
    link: fullLink,
    pubDate,
    description: episode ? `EP: ${episode}` : '',
    image,
    guid
  };
});

// Filtra items nulos y vacíos
const validItems = items.filter(item => item && item.title && item.title.length > 0);

console.log(`✅ Se procesaron ${validItems.length} episodios válidos`);

// Genera el contenido del archivo RSS
const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>KickAssAnime - Recently Updated</title>
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