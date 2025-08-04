const fs = require('fs');
const { JSDOM } = require('jsdom');

const htmlPath = 'simulcast-animeonegai.html';
if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size === 0) {
  console.log('⚠️ Archivo HTML vacío o no encontrado. RSS no será generado.');
  process.exit(0);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

const baseUrl = 'https://www.animeonegai.com';
const pubDate = new Date().toUTCString();
const containerIndices = [3, 5, 1]; // Orden deseado: Nuevos episodios, Se van pronto, Estrenos

let allItems = [];

for (const index of containerIndices) {
  const containers = document.querySelectorAll('.container-fluid-slide');
  const container = containers[index];

  if (!container) {
    console.log(`⚠️ No se encontró el contenedor en el índice ${index} (.container-fluid-slide)`);
    continue;
  }

  const slideElements = [...container.querySelectorAll('.item-slide')];

  if (slideElements.length === 0) {
    console.log(`⚠️ No se encontraron elementos .item-slide en el contenedor índice ${index}`);
    continue;
  }

  const items = slideElements.map(slide => {
    const titleEl = slide.querySelector('h6.title.mb-1');
    const aTag = slide.querySelector('a.clickDetails');
    const imgTag = slide.querySelector('img');

    if (!titleEl || !aTag || !imgTag) return null;

    const originalTitle = titleEl.textContent.trim();
    const href = aTag.getAttribute('href');
    const link = baseUrl + href;
    const guid = link + `#${index}`; // Agrega índice al guid
    const image = imgTag.getAttribute('src');

    let titlePrefix = '';
    let description = '';

    if (index === 5) {
      titlePrefix = '[SE VA PRONTO] ';
      description = `Se va pronto: ${originalTitle}`;
    } else if (index === 1) {
      titlePrefix = '[ESTRENO] ';
      description = `Nuevo estreno: ${originalTitle}`;
    } else {
      titlePrefix = '';
      description = `Nuevo Episodio de ${originalTitle}`;
    }

    const title = `${titlePrefix}${originalTitle}`;

    return { title, link, guid, description, image, pubDate };
  }).filter(Boolean);

  allItems.push(...items);
}

// Generar el RSS
const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>Anime Onegai</title>
  <link>${baseUrl}</link>
  <description>Últimos novedades en Anime Onegai</description>
  <language>es</language>
  <lastBuildDate>${pubDate}</lastBuildDate>
  ${allItems.map(item => `
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

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/animeonegai-rss.xml', rss);
console.log('✅ RSS generado con múltiples secciones y etiquetas personalizadas: docs/animeonegai-rss.xml');
