// Costruisce una topologia fitta di dispositivi e collegamenti e ne scatta una foto:
// serve a controllare a occhio che le linee siano disegnate lisce, senza sbavature.
//
// Uso:  node scripts/verifica-linee.mjs [indirizzo]

import { chromium } from 'playwright-core';

const INDIRIZZO = process.argv[2] ?? 'http://localhost:4200';
const USCITA = process.argv[3] ?? '/tmp/pw/linee.png';

const browser = await chromium.launch({ channel: 'chrome' });
const pagina = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2 });

pagina.on('dialog', dialogo => dialogo.accept());

await pagina.goto(INDIRIZZO);
await pagina.waitForSelector('app-canvas');

const pezzo = indice => pagina.locator('app-canvas .dispositivo').nth(indice);

// 4 router, 4 switch e 8 PC: abbastanza da far incrociare molte linee
for (let i = 0; i < 4; i++) {
    await pagina.locator('app-strumenti button', { hasText: 'Router' }).first().click();
}
for (let i = 0; i < 4; i++) {
    await pagina.locator('app-strumenti button', { hasText: 'Switch' }).first().click();
}
for (let i = 0; i < 8; i++) {
    await pagina.locator('app-strumenti button', { hasText: 'PC' }).first().click();
}

async function posiziona(varIndice, varX, varY) {
    const elemento = pezzo(varIndice);
    const attuale = await elemento.evaluate(e => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top) }));
    const riquadro = await elemento.boundingBox();

    await pagina.mouse.move(riquadro.x + riquadro.width / 2, riquadro.y + riquadro.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(
        riquadro.x + riquadro.width / 2 + (varX - attuale.x),
        riquadro.y + riquadro.height / 2 + (varY - attuale.y),
        { steps: 8 }
    );
    await pagina.mouse.up();
}

// li sparpaglio su tutto il piano, come in una topologia disegnata a mano
const posizioni = [
    [200, 100], [500, 100], [800, 100], [1050, 150],
    [150, 300], [450, 320], [750, 340], [1000, 380],
    [250, 480], [550, 500], [850, 520], [1050, 550],
    [350, 250], [650, 200], [900, 250], [500, 620]
];

for (let i = 0; i < posizioni.length; i++) {
    await posiziona(i, posizioni[i][0], posizioni[i][1]);
}

// collego a raggiera: ogni dispositivo si lega a due o tre altri, così le linee si incrociano
const coppie = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 0], [4, 5], [5, 1], [5, 13],
    [6, 2], [6, 7], [7, 3], [7, 14],
    [8, 4], [8, 9], [9, 5], [9, 15],
    [10, 6], [10, 11], [11, 7], [11, 12],
    [12, 8], [13, 14], [14, 15], [15, 12]
];

for (const [primo, secondo] of coppie) {
    await pagina.locator('app-strumenti button', { hasText: 'Collegamento' }).first().click();
    await pezzo(primo).click();
    await pezzo(secondo).click();
    await pagina.locator('app-strumenti button', { hasText: 'Modifica' }).first().click();
}

// accendo il primo router: si accende tutta la rete raggiungibile
await pezzo(0).click({ button: 'right' });
await pagina.waitForSelector('app-dettaglio aside');
await pagina.locator('app-dettaglio button', { hasText: 'Attiva stato' }).click();
await pagina.waitForTimeout(300);
await pagina.locator('app-dettaglio button[aria-label="Chiudi il dettaglio"]').click();
await pagina.waitForTimeout(400);

await pagina.screenshot({ path: USCITA, clip: { x: 20, y: 420, width: 1300, height: 620 } });

const quante = await pagina.locator('app-canvas .linee line').count();
console.log('linee disegnate: ' + quante + ' — immagine in ' + USCITA);

await browser.close();
