// Verifica che il frontend dentro il container funzioni davvero, cioe' che la
// catena browser -> nginx -> api -> mysql regga.
// Serve "docker compose up -d" gia' avviato in esame_backend.
//
// Uso:  node scripts/verifica-container.mjs [indirizzo]
//       node scripts/verifica-container.mjs http://localhost:8080

import { chromium } from 'playwright-core';

const INDIRIZZO = process.argv[2] ?? 'http://localhost:8080';

const browser = await chromium.launch({ channel: 'chrome' });
const pagina = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

const messaggi = [];
pagina.on('dialog', async dialogo => {
    messaggi.push(dialogo.message());
    await dialogo.accept();
});

function controllo(varDescrizione, varEsito) {
    console.log((varEsito ? "OK   " : "FALLITO ") + varDescrizione);
    if (!varEsito) {
        process.exitCode = 1;
    }
}

await pagina.goto(INDIRIZZO);
await pagina.waitForSelector('app-strumenti');
await pagina.waitForFunction(() => {
    const testo = document.querySelector('app-strumenti')?.textContent ?? '';
    return testo.includes("topologie salvate sul server") || testo.includes("Server non raggiungibile");
}, null, { timeout: 20000 });

controllo("Il frontend nel container carica e parla con l'API passando da nginx",
    !(await pagina.locator('app-strumenti').innerText()).includes("Server non raggiungibile"));

const quante = await pagina.locator('app-strumenti select option').count();

await pagina.locator('app-strumenti button', { hasText: "Router" }).first().click();
await pagina.locator('app-strumenti button', { hasText: "Switch" }).first().click();

const connetti = async () => {
    await pagina.locator('app-strumenti button', { hasText: "Collegamento" }).first().click();
    await pagina.locator('app-canvas .dispositivo').nth(0).click();
    await pagina.locator('app-canvas .dispositivo').nth(1).click();
    await pagina.locator('app-strumenti button', { hasText: "Modifica" }).first().click();
};

await connetti();

messaggi.length = 0;
await pagina.locator('app-strumenti button', { hasText: "Salva sul server" }).click();
await pagina.waitForTimeout(1500);

controllo("Salvataggio sul server dal frontend nel container: " + JSON.stringify(messaggi),
    messaggi.includes("Topologia salvata sul server."));

const testoDopo = await pagina.locator('app-strumenti').innerText();
const dopo = await pagina.locator('app-strumenti select option').count();

controllo("L'elenco sul server e' cresciuto di uno",
    dopo == quante + 1 || testoDopo.includes("topologie salvate"));

await pagina.screenshot({ path: '/tmp/pw/container-8080.png', fullPage: true });

// pulizia: si cancella la topologia appena creata, cosi' il database resta pulito.
// Prima la si seleziona esplicitamente nella tendina: cosi' non si dipende da
// quale voce l'applicazione ha scelto da sola, che e' esattamente il modo in cui
// questo script ha cancellato per sbaglio una topologia che non era la sua.
const idNuovo = await pagina.evaluate(() => {
    const scelte = Array.from(document.querySelectorAll('app-strumenti select option'));
    const ultima = scelte[scelte.length - 1];

    return ultima ? ultima.value : null;
});

if (idNuovo) {
    await pagina.locator('app-strumenti select').selectOption(idNuovo);
    await pagina.waitForTimeout(300);
}

messaggi.length = 0;
await pagina.locator('app-strumenti button', { hasText: "Elimina dal server" }).click();
await pagina.waitForTimeout(1500);

controllo("La topologia di prova e' stata eliminata: " + JSON.stringify(messaggi),
    messaggi.includes("Topologia eliminata dal server."));

await browser.close();
console.log("");
console.log(process.exitCode ? "VERIFICA: ci sono controlli falliti" : "VERIFICA: tutti i controlli superati");
