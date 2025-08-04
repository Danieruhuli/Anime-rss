const fs = require('fs');
const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

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
const containerIndices = [3, 5, 1];

let allItems = [];

async function fetchExtraGuidPart(url, browser) {
  let page;
  try {
    console.log(`🌐 Intentando acceder con Puppeteer a: ${url}`);
    page = await browser.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await page.waitForTimeout(1000); // esperar 1 segundo

    const h4Text = await page.$eval('h4', el => el.textContent.trim()).catch(() => null);

    if (h4Text) {
      console.log(`✅ Se encontró <h4>: "${h4Text}" en ${url}`);
      return h4Text;
    } else {
      console.log(`⚠️ No se encontró ningún <h4> en ${url}`);
    }
  } catch (err) {
    console.log(`❌ Error de Puppeteer al acceder a ${url}: ${err.message}`);
  } finally {
    if (page) await page.close();
  }

  return null;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

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

    const items = await Promise.all(slideElements.map(async slide => {
      const titleEl = slide.querySelector('h6.title.mb-1');
      const aTag = slide.querySelector('a.clickDetails');
      const imgTag = slide.querySelector('img');

      if (!titleEl || !aTag || !imgTag) return null;

      const originalTitle = titleEl.textContent.trim();
      const href = aTag.getAttribute('href');
      const link = baseUrl + href;
      const image = imgTag.getAttribute('src');

      let guid = link + `#${index}`;

      if (index === 3) {
        const extra = await fetchExtraGuidPart(link, browser);
        if (extra) {
          guid = `${link}#${extra}`;
        }
      }

      let titlePrefix = '';
      let description = '';

      if (index === 5) {
        titlePrefix = '[SE VA PRONTO] ';
        description = `Se va pronto: ${originalTitle}`;
      } else if (index === 1) {
        titlePrefix = '[ESTRENO] ';
        description = `Nuevo estreno: ${originalTitle}`;
      } else {
        description = `Nuevo Episodio de ${originalTitle}`;
      }

      const title = `${titlePrefix}${originalTitle}`;

      return { title, link, guid, description, image, pubDate };
    }));

    allItems.push(...items.filter(Boolean));
  }

  await browser.close();

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>Anime Onegai</title>
  <link>${baseUrl}</link>
  <description>Últimas novedades en Anime Onegai</description>
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
  console.log('✅ RSS generado: docs/animeonegai-rss.xml');
})();
