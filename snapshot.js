const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Activar el plugin de evasión
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
   headless: 'new',
   args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
  await page.goto('https://hianime.to/recently-updated', {
  waitUntil: 'networkidle0',
  timeout: 120000 // espera hasta 2 minutos
});

    const content = await page.content();
    fs.writeFileSync('simulcast.html', content);
    console.log('✅ HTML guardado como simulcast.html');
  } catch (error) {
    console.error('❌ Error al cargar la página:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
