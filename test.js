import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    await page.goto('http://localhost:8081/test.html');

    await new Promise(r => setTimeout(r, 1000));

    console.log('Triggering lag...');
    await page.click('#btn-lag');

    await new Promise(r => setTimeout(r, 600));

    await page.keyboard.press('p');
    await new Promise(r => setTimeout(r, 500));
    await page.click('#card-2');
    await new Promise(r => setTimeout(r, 1000));
    console.log('Dropping pin on card-2...');
    const evaluateResult = await page.evaluate(async () => {
        const overlay = window.pinmarkOverlay;
        if (!overlay) return { error: 'no overlay' };
        const sr = overlay.shadowRoot;
        const btn = sr.querySelector('.pinmark-modal-btn.submit');
        if (btn) btn.click();
        else return { error: 'no btn', html: sr.innerHTML };
        
        await new Promise(r => setTimeout(r, 100));
        return { list: overlay.feedbackManager.getAll() };
    });
    console.log('Result:', evaluateResult);
    console.log('Feedback length:', evaluateResult?.list?.length);
    console.log('Metrics array:', JSON.stringify(evaluateResult?.list?.[0]?.performanceMetrics, null, 2));
    await browser.close();
})();
