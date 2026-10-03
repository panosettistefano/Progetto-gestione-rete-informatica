// Genera gli screenshot della documentazione in docs/.
// Serve il dev server acceso (npx ng serve) e, per lo scatto sul server,
// anche il backend (docker compose up -d in esame_backend).
//
// Uso:
//   npm install
//   node scripts/screenshot.mjs
//
// Playwright usa il Chrome installato nel sistema (channel: "chrome"),
// quindi non serve scaricare nessun browser: la dipendenza e' solo
// "playwright-core", che i browser non li porta con se'.
//
// Il percorso segue quello della consegna: prima i dispositivi posizionati,
// poi i collegamenti, poi il dettaglio, poi il salvataggio in locale e infine
// il salvataggio sul server.
//
// Attenzione: l'ultimo passo salva davvero una topologia sul database, quindi
// ogni esecuzione ne aggiunge una all'elenco del server.

import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const INDIRIZZO = 'http://localhost:4200';
const CARTELLA = new URL('../docs/', import.meta.url).pathname;

const browser = await chromium.launch({ channel: 'chrome' });
const pagina = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

pagina.on('dialog', dialogo => dialogo.accept());

await mkdir(CARTELLA, { recursive: true });

async function apri() {
    await pagina.goto(INDIRIZZO);
    await pagina.waitForSelector('app-canvas');
}

function dispositivo(varIndice) {
    return pagina.locator('app-canvas .dispositivo').nth(varIndice);
}

function pulsante(varTesto) {
    return pagina.locator('app-strumenti button').filter({ hasText: new RegExp('^\\s*' + varTesto + '\\s*$') });
}

async function aggiungi(varTipo) {
    await pagina.locator('app-strumenti button', { hasText: varTipo }).first().click();
}

// I dispositivi vengono trascinati dalla posizione iniziale a quella voluta:
// x e y sono il centro dell'icona, quindi basta spostarsi del delta.
async function posiziona(varIndice, varX, varY) {
    const pezzo = dispositivo(varIndice);
    const attuale = await pezzo.evaluate(e => ({
        x: parseFloat(e.style.left),
        y: parseFloat(e.style.top)
    }));
    const riquadro = await pezzo.boundingBox();

    await pagina.mouse.move(riquadro.x + riquadro.width / 2, riquadro.y + riquadro.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(
        riquadro.x + riquadro.width / 2 + (varX - attuale.x),
        riquadro.y + riquadro.height / 2 + (varY - attuale.y),
        { steps: 12 }
    );
    await pagina.mouse.up();
}

async function collega(varPrimo, varSecondo) {
    await pagina.locator('app-strumenti button', { hasText: "Collegamento" }).first().click();
    await dispositivo(varPrimo).click();
    await dispositivo(varSecondo).click();
    await pagina.locator('app-strumenti button', { hasText: "Modifica" }).first().click();
}

async function scatta(varNome) {
    await pagina.waitForTimeout(400);
    await pagina.screenshot({ path: CARTELLA + varNome + '.png', fullPage: true });
    console.log("scritto docs/" + varNome + '.png');
}

await apri();

// --- 1. i dispositivi, posizionati a ventaglio ---
await aggiungi("Router");
await aggiungi("Switch");
await aggiungi("PC");
await aggiungi("PC");

await posiziona(0, 600, 120);
await posiziona(1, 600, 340);
await posiziona(2, 360, 560);
await posiziona(3, 840, 560);

await scatta('canvas');

// --- 2. i collegamenti ---
await collega(0, 1);
await collega(1, 2);
await collega(1, 3);

await scatta('connessioni');

// --- 3. il dettaglio, con il click destro sullo switch ---
await dispositivo(1).click({ button: 'right' });
await pagina.waitForSelector('app-dettaglio aside');

await scatta('dettaglio');

await pagina.locator('app-dettaglio button[aria-label="Chiudi il dettaglio"]').click();
await pagina.waitForTimeout(200);

// --- 4. il salvataggio in locale, riletto dopo un ricaricamento ---
await pulsante("Salva").click();
await pagina.waitForTimeout(400);

await apri();
await pulsante("Carica").click();
await pagina.waitForTimeout(400);

await scatta('salvataggio');

// --- 5. il salvataggio sul server ---
await pagina.locator('app-strumenti button', { hasText: "Salva sul server" }).click();
await pagina.waitForTimeout(1200);

await scatta('salvataggio-server');

await browser.close();
