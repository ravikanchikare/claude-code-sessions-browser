const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new'
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:4000', { waitUntil: 'networkidle0' });
  
  const outDir = '/Users/ravi/Documents/case-study-template/public/images/session-browser';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Capturing main view...');
  await page.screenshot({ path: path.join(outDir, 'main-view-snapshot.png') });
  
  const html = await page.content();
  fs.writeFileSync(path.join(outDir, 'main-view-snapshot.html'), html);
  
  // Create copies for the other images mentioned in the mdx
  const placeholders = [
    'subagent-tree.png',
    'token-breakdown.png',
    'sidebar-tree.png',
    'checkpoint-view.png',
    'compare-sessions.png'
  ];
  
  for (const p of placeholders) {
    await page.screenshot({ path: path.join(outDir, p) });
  }

  console.log('Done!');
  await browser.close();
})();
