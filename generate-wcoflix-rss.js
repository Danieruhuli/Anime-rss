const fs = require('fs');
const { JSDOM } = require('jsdom');

const htmlPath = 'simulcast-wcoflix.html';
if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size === 0) {
  console.log('⚠️ Archivo HTML vacío o no encontrado. RSS no será generado.');
  process.exit(0);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

// Buscar <a name="cartoon">
const cartoonAnchor = document.querySelector('a[name="cartoon"]');
if (!cartoonAnchor) {
  console.log('❌ No se encontró el ancla <a name="cartoon">');
  process.exit(0);
}

// Buscar el siguiente <ul class="items"> en los siguientes elementos hermanos
let sibling = cartoonAnchor.parentElement.nextElementSibling;
let itemsList = null;

while (sibling) {
  if (sibling.matches('div#sidebar_right')) {
    itemsList = sibling.querySelector('ul.items');
    break;
  }
  sibling = sibling.nextElementSibling;
}

if (!itemsList) {
  console.log('❌ No se encontró la lista de episodios en <ul class="items">');
  process.exit(0);
}

const items = [];

itemsList.querySelectorAll('li').forEach(li => {
  const a = li.querySelector('.recent-release-episodes a');
  const img = li.querySelector('.img img');

  if (!a || !img) return;

  const title = a.textContent.trim();
  const href = a.getAttribute('href');
  const link = 'https://www.wcoflix.tv' + href;
  const guid = link; // Es único
  const description = title;
  let image = img.getAttribute('src') || '';
  if (image.startsWith('//')) image = 'https:' + image;

  const pubDate = new Date().toUTCString();

  items.push({
    title,
    link,
    guid,
    description,
    image,
    pubDate
  });
});

// Generar el RSS
const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>Watch Cartoon Online - New Cartoons</title>
  <link>https://www.wcoflix.tv/</link>
  <description>Últimos episodios en WCOFlix</description>
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

// Guardar en docs
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/wco-rss.xml', rss);
console.log('✅ RSS generado: docs/wco-rss.xml');
