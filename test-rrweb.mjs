import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.addScriptTag({ path: './node_modules/rrweb-snapshot/dist/rrweb-snapshot.umd.min.cjs' });
  
  const globals = await page.evaluate(() => {
    return Object.keys(window).filter(k => k.toLowerCase().includes('rrweb'));
  });
  console.log('Available rrweb globals:', globals);
  
  await browser.close();
}
run();