// Verifica che gli stati dei dispositivi si comportino come in una rete vera
// e che l'applicazione funzioni senza internet.
// Serve il dev server acceso (npm start) oppure il container (http://localhost:8080).
//
// Uso:  node scripts/verifica-rete.mjs [indirizzo]

import { chromium } from 'playwright-core';

const INDIRIZZO = process.argv[2] ?? 'http://localhost:4200';

const browser = await chromium.launch({ channel: 'chrome' });
const pagina = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

pagina.on('dialog', dialogo => dialogo.accept());

const esterni = [];
await pagina.route('**/*', richiesta => {
    const indirizzo = new URL(richiesta.request().url());

    if (indirizzo.hostname != 'localhost' && indirizzo.hostname != '127.0.0.1') {
        esterni.push(richiesta.url());
        richiesta.abort();
        return;
    }

    richiesta.continue();
});

function controllo(varDescrizione, varEsito) {
    console.log((varEsito ? "OK   " : "FALLITO ") + varDescrizione);
    if (!varEsito) {
        process.exitCode = 1;
    }
}

const stato = async varIndice => pagina.evaluate(
    varI => document.querySelectorAll('app-canvas .dispositivo')[varI].className,
    varIndice
);

const online = async () => pagina.evaluate(() =>
    Array.from(document.querySelectorAll('app-canvas .dispositivo'))
        .map(d => !d.className.includes('dispositivo-offline')));

async function accendi(varIndice, varTesto) {
    await pagina.locator('app-canvas .dispositivo').nth(varIndice).click({ button: 'right' });
    await pagina.waitForSelector('app-dettaglio aside');
    await pagina.locator('app-dettaglio button', { hasText: varTesto }).click();
    await pagina.waitForTimeout(250);
    await pagina.locator('app-dettaglio button[aria-label="Chiudi il dettaglio"]').click();
    await pagina.waitForTimeout(250);
}

await pagina.goto(INDIRIZZO);
await pagina.waitForSelector('app-canvas');

// --- senza internet: nessuna risorsa esterna ---
controllo("L'applicazione non chiede niente a internet (" + esterni.length + " richieste esterne)",
    esterni.length === 0);

const font = await pagina.evaluate(() => document.fonts.check('1rem "bootstrap-icons"'));
controllo("Il font delle icone è caricato dal progetto", font === true);

// --- costruisco la rete: router - switch - pc ---
await pagina.locator('app-strumenti button', { hasText: 'Router' }).first().click();
await pagina.locator('app-strumenti button', { hasText: 'Switch' }).first().click();
await pagina.locator('app-strumenti button', { hasText: 'PC' }).first().click();

const connetti = async (varPrimo, varSecondo) => {
    await pagina.locator('app-strumenti button', { hasText: 'Collegamento' }).first().click();
    await pagina.locator('app-canvas .dispositivo').nth(varPrimo).click();
    await pagina.locator('app-canvas .dispositivo').nth(varSecondo).click();
    await pagina.locator('app-strumenti button', { hasText: 'Modifica' }).first().click();
};

await connetti(0, 1);
await connetti(1, 2);

controllo("Senza il router acceso è tutto spento: " + JSON.stringify(await online()),
    (await online()).every(acceso => acceso === false));

// --- accendo il router: si accende la rete ---
await accendi(0, 'Attiva stato');
controllo("Accendendo il router si accende tutta la rete: " + JSON.stringify(await online()),
    (await online()).every(acceso => acceso === true));

// --- attacco un PC spento a un router acceso: deve accendersi da solo ---
await pagina.locator('app-strumenti button', { hasText: 'PC' }).first().click();
await pagina.waitForTimeout(300);
controllo("Il PC appena aggiunto è spento: " + JSON.stringify(await online()),
    (await online())[3] === false);

await connetti(1, 3);
controllo("Collegandolo al router acceso si accende da solo: " + JSON.stringify(await online()),
    (await online())[3] === true);

// --- spengo il router: si spegne tutto ---
await accendi(0, 'Disattiva stato');
controllo("Spegnendo il router si spegne tutta la rete: " + JSON.stringify(await online()),
    (await online()).every(acceso => acceso === false));

// --- riaccendo: torna su tutto ---
await accendi(0, 'Attiva stato');
controllo("Riaccendendolo torna su tutta la rete: " + JSON.stringify(await online()),
    (await online()).every(acceso => acceso === true));

// --- stacco il collegamento dello switch dal router: il ramo cade ---
await pagina.locator('app-canvas .dispositivo').nth(1).click({ button: 'right' });
await pagina.waitForSelector('app-dettaglio aside');
await pagina.locator('app-dettaglio button[aria-label="Elimina il collegamento con Router-01"]').click();
await pagina.waitForTimeout(300);
await pagina.locator('app-dettaglio button[aria-label="Chiudi il dettaglio"]').click();
await pagina.waitForTimeout(300);

const dopo = await online();
controllo("Staccando lo switch dal router restano accesi solo i router: " + JSON.stringify(dopo),
    dopo[0] === true && dopo.slice(1).every(acceso => acceso === false));

await pagina.screenshot({ path: '/tmp/pw/rete.png', clip: { x: 0, y: 380, width: 1400, height: 620 } });

await browser.close();
console.log("");
console.log(process.exitCode ? "VERIFICA: ci sono controlli falliti" : "VERIFICA: tutti i controlli superati");
