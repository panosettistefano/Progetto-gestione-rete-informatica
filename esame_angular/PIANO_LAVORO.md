# Piano di lavoro — Gestione visuale di una rete informatica

Documento di lavoro del progetto d'esame. Ogni milestone è pensata per essere completata, verificata e
committata da sola: così il lavoro resta sempre in uno stato dimostrabile.

---

## 1. Contesto e obiettivo

Il progetto (consegna in `CLAUDE.md`) è un'applicazione grafica con **canvas** su cui costruire una
topologia di rete: si posizionano dispositivi **PC**, **Switch** e **Router**, li si collega con delle
linee, si consulta il dettaglio di ognuno e si salva il lavoro.

Lo sviluppo è diviso in **due fasi**:

1. **Frontend** in questa cartella (`esame_angular`), con persistenza su **Local Storage** (Soluzione A
   della consegna). Deve funzionare da solo, senza backend.
2. **Backend** in una cartella separata (`../esame_backend`), **Node + Express + MySQL** dentro Docker
   (`Dockerfile` + `docker-compose`), con un'API REST che diventa la seconda modalità di salvataggio
   (Soluzione B). Il frontend viene collegato all'API senza riscrivere la UI.

### Criteri di accettazione (dalla consegna)

- [x] canvas con dispositivi PC, Switch e Router, ognuno con la sua icona
- [x] ogni dispositivo ha `id` univoco, `tipo`, `nome`, `x`, `y`
- [x] aggiunta di più dispositivi, con label visibile sul canvas
- [x] **drag & drop** dei dispositivi con aggiornamento delle coordinate
- [x] **connessioni** create con due click (il primo evidenzia la sorgente), modello `{ id, sourceId, targetId }`
- [x] le linee si aggiornano automaticamente quando un dispositivo viene spostato
- [x] **click destro** su un dispositivo → dettaglio (nome, tipo, IP, hostname, stato) in una **sidebar**
- [x] modalità **Edit / Connect** separate (bonus avanzato)
- [x] **salva / carica / cancella topologia**: su Local Storage (M7) e sul server con REST + MySQL (B4)
- [ ] `README.md` con descrizione, tecnologie, architettura, modello dati, istruzioni di avvio e
      **screenshot reali** in `docs/`

## 2. Scelte tecniche

| Elemento | Scelta | Note |
|---|---|---|
| Versione Angular | **22.2.0** (zoneless) | nessun `zone.js`: lo stato si aggiorna con i signals |
| Stato | **signals** (`signal`, `computed`, `update`) | niente mutazioni in place degli oggetti |
| Service | decoratore **`@Service()`** | come nel progetto della lezione `lez06_service_signal` |
| Dependency injection | **`inject()`** come inizializzatore di campo | niente costruttore, `inject()` mai dentro i metodi |
| UI | **Bootstrap 5** + **Bootstrap Icons** da CDN in `index.html` | classi Bootstrap nei template, zero dipendenze npm |
| Modelli | `src/app/types/<nome>.ts` con `export type` | 4 spazi di indentazione |
| Componenti | `src/app/components/<nome>/<nome>.{ts,html,css}` | nome file e classe in italiano, senza suffisso `Component` |
| Rotte | nessuna: `app.html` monta i tre componenti | la sidebar è una delle tre modalità di dettaglio ammesse |
| Persistenza | `PersistenzaService` su Local Storage | strato isolato, sostituibile dall'API in fase 2 |
| Test | **Vitest** (`npx ng test --watch=false`) | `jsdom` come ambiente |
| Linguaggio | italiano per entità, metodi e campi | |

Extra inclusi: **eliminazione di un dispositivo** e **di una connessione**, più l'**attivazione dello stato
dal pannello di dettaglio**: i dispositivi nascono `Offline` e si accendono dal pulsante nella sidebar;
attivando un **Router** lo stato `Online` si propaga a tutti i dispositivi raggiungibili attraverso le
connessioni (è il router che porta internet).
Esclusi: zoom/pan del canvas, export/import JSON, modifica di nome/IP dal pannello.

## 3. Architettura del frontend

```text
UI (navbar + strumenti + canvas + sidebar di dettaglio)
 |
 v
Canvas  -->  Dispositivi (div posizionati in assoluto)
   |     -->  Connessioni (overlay <svg> con le linee)
   v
TopologiaService   (stato a signals: dispositivi, connessioni, selezione, modalità)
   |
   v
PersistenzaService (Local Storage)      [fase 2]  TopologiaApiService (REST) --> MySQL in Docker
```

```text
src/
  index.html                        Bootstrap 5 e Bootstrap Icons da CDN
  styles.css                        stile di pagina, griglia del canvas
  app/
    costanti.ts                     dimensioni canvas, dimensione dispositivo, soglia click/drag
    types/dispositivo.ts            Dispositivo, TipoDispositivo, StatoDispositivo
    types/connessione.ts            Connessione
    types/collegamento.ts           Collegamento (riga "collegamenti" della sidebar)
    types/topologia.ts              Topologia (payload salvato/caricato, con "versione")
    types/topologia-salvata.ts      TopologiaSalvata (riga dell'elenco del server)
    services/topologia-service.ts   stato a signals + tutta la logica della topologia
    services/persistenza-service.ts unico punto che tocca localStorage
    services/topologia-api-service.ts  unico punto che parla con l'API REST
    components/strumenti/           pulsanti: aggiungi dispositivo, modalità, salva/carica/cancella,
                                    salva sul server / apri dal server / elimina dal server
    components/canvas/              canvas: dispositivi trascinabili + overlay <svg> delle linee
    components/dettaglio/           sidebar di dettaglio (click destro) con eliminazione
    app.ts|html|css                 navbar + i tre componenti
  proxy.conf.json                   in sviluppo "/api" viene girato su http://localhost:3000
```

### Stato del `TopologiaService`

```ts
dispositivi = signal<Dispositivo[]>([])
connessioni = signal<Connessione[]>([])
modalita = signal<"edit" | "connect">("edit")
selezionato = signal<number | null>(null)     // id del dispositivo selezionato per il collegamento
idDettaglio = signal<number | null>(null)     // id del dispositivo mostrato nella sidebar

linee = computed(...)                          // connessioni + dispositivi → { id, x1, y1, x2, y2 }
dispositivoDettaglio = computed(...)           // find() sul signal dei dispositivi
connessioniDettaglio = computed(...)           // connessioni che toccano il dispositivo aperto
```

Metodi principali: `aggiungiDispositivo`, `spostaDispositivo`, `cliccaDispositivo`,
`creaConnessione`, `eliminaDispositivo`, `eliminaConnessione`, `attivaStato`, `disattivaStato`,
`cambiaModalita`, `apriDettaglio`, `chiudiDettaglio`, `salvaTopologia`, `caricaTopologia`,
`cancellaTopologia`.

Regola: **mai mutare gli oggetti in place**, sempre `update(lista => lista.map(...))`, altrimenti i
`computed` non si accorgono del cambiamento e le linee restano ferme.

### Come è disegnato il canvas

- Un piano di dimensione fissa (`LARGHEZZA_CANVAS` × `ALTEZZA_CANVAS`) con sfondo a griglia.
- **Overlay `<svg>`** in `position: absolute; inset: 0; pointer-events: none`, che disegna una `<line>`
  per ogni elemento di `linee()`.
- **Un div per dispositivo**, `position: absolute`, `left`/`top` presi da `x`/`y` con
  `transform: translate(-50%, -50%)`: così `x` e `y` sono il **centro** dell'icona e gli estremi della
  linea sono esattamente le coordinate del dispositivo.
- Icone Bootstrap Icons: `bi-pc-display` (PC, blu), `bi-hdd-network` (Switch, verde), `bi-router`
  (Router, arancione).

### Interazione con il mouse

- **Drag & drop** (solo in modalità `edit`) con eventi pointer: `pointerdown` registra lo scostamento
  fra puntatore e centro del dispositivo, `pointermove` scrive le nuove coordinate (limitate dentro il
  canvas), `pointerup` chiude il trascinamento.
- **Nessun `(click)`** sui dispositivi: la differenza fra click e trascinamento si decide in
  `pointerup` con una soglia di 4 px. Un `click` legato a parte scatterebbe anche dopo un trascinamento.
- **Click destro** (`contextmenu` + `preventDefault()`) apre la sidebar di dettaglio.
- La conversione schermo → coordinate sta in un solo metodo `calcolaPosizione(event)`, che usa il
  `getBoundingClientRect()` del piano.

### Flusso di collegamento (modalità Connect)

Primo click → il dispositivo diventa `selezionato` ed è evidenziato. Secondo click su un altro
dispositivo → nasce la connessione. Con due controlli: **niente collegamento di un dispositivo a sé
stesso** e **niente connessioni duplicate** (verificate in entrambi i versi), con `alert()` di avviso.

### Persistenza locale

I pulsanti **Salva / Carica / Cancella** della toolbar lavorano su un solo oggetto `Topologia`, che è
anche il payload della fase 2:

```ts
{ nome, versione, dispositivi: [...], connessioni: [...] }
```

- `PersistenzaService` è l'**unico** punto che tocca `localStorage` (chiave `topologia-rete`), con
  `try/catch`: se lo storage rifiuta la scrittura (spazio pieno, modalità privata) `salva()` torna
  `false` e il service principale avvisa invece di rompersi.
- `carica()` valida il JSON prima di restituirlo (nome, `dispositivi` e `connessioni` come array): un
  contenuto corrotto o di un'altra applicazione diventa `null`, non un errore a schermo.
- `caricaTopologia()` riporta nello stato nome, dispositivi e connessioni e azzera selezione e
  sidebar, perché gli id caricati potrebbero non esistere più.
- `cancellaTopologia()` chiede `confirm()`, svuota canvas e storage.
- L'esito di ogni comando è un `alert()`: salvato, caricato, cancellato, oppure il motivo del rifiuto.

In fase 2 questo strato resta e gli si affianca `TopologiaApiService`: la toolbar guadagna i pulsanti
del server e canvas, sidebar e logica della topologia non cambiano.

## 4. Modello dati

```ts
export type TipoDispositivo = "PC" | "Switch" | "Router"
export type StatoDispositivo = "Online" | "Offline" | "Manutenzione"

export type Dispositivo = {
    id: number,
    tipo: TipoDispositivo,
    nome: string,
    x: number,
    y: number,
    ip: string,
    hostname: string,
    stato: StatoDispositivo
}

export type Connessione = { id: number, sourceId: number, targetId: number }

export type Collegamento = { id: number, nome: string }   // connessione vista dalla sidebar:
                                                          // id della connessione + nome dell'altro capo

export type Topologia = {
    nome: string,
    versione: number,
    dispositivi: Dispositivo[],
    connessioni: Connessione[]
}
```

Corrispondenza con il database della fase 2: `topologie`, `dispositivi`, `connessioni`.

## 5. Milestone del frontend

Verifica standard di ogni milestone: `npx ng build` senza errori, `npx ng test --watch=false` verde,
prova manuale con `npx ng serve`, poi un commit git con messaggio in italiano.

| # | Stato | Obiettivo | File toccati |
|---|---|---|---|
| **M0** | fatto | Fondamenta: Bootstrap da CDN, pulizia del placeholder, `costanti.ts`, tipi, service con lo stato vuoto (canvas vuoto all'avvio), scheletro dei tre componenti | `PIANO_LAVORO.md`, `index.html`, `styles.css`, `app.*`, `costanti.ts`, `types/*`, `services/topologia-service.ts`, `components/*` |
| **M1** | fatto | Canvas che disegna dispositivi, icone, colori per tipo e linee dal `computed linee()` | `canvas.*`, `styles.css` |
| **M2** | fatto | Pulsanti "Aggiungi PC / Switch / Router": id univoco, nome progressivo, IP di default, posizione a scaletta | `strumenti.*`, `topologia-service.ts` (+ spec) |
| **M3** | fatto | Drag & drop in modalità Edit con aggiornamento di `x`/`y` e limiti del canvas | `canvas.*`, `topologia-service.ts` |
| **M4** | fatto | Modalità Edit / Connect, evidenziazione del selezionato, creazione connessione con i controlli | `strumenti.*`, `canvas.*`, `topologia-service.ts` |
| **M5** | fatto | Dettaglio con click destro: sidebar con nome, tipo, IP, hostname, stato | `dettaglio.*`, `canvas.*`, `topologia-service.ts` |
| **M6** | fatto | Eliminazione dispositivo (con le sue connessioni) e singola connessione | `dettaglio.*`, `topologia-service.ts` |
| **M7** | fatto | Persistenza: salva / carica / cancella topologia su Local Storage | `services/persistenza-service.ts`, `strumenti.*`, `topologia-service.ts` |
| **M8** | da fare | Rifiniture, test del service, screenshot in `docs/`, `README.md` tecnico | spec, `README.md`, `docs/` |

## 6. Fase 2 — Backend REST + MySQL in Docker (`../esame_backend`)

```text
esame_backend/
  docker-compose.yml        servizi: db (mysql:8.4) + api (build dal Dockerfile)
  Dockerfile                node:24-alpine, npm ci --omit=dev
  .dockerignore / .env      configurazione del database
  package.json              express, mysql2, cors, dotenv
  db/init.sql               database, tabelle e dati di esempio
  src/index.js              app Express, rotte, /api/health
  src/db.js                 pool mysql2/promise
  src/routes/topologie.js   router REST
  README.md                 avvio, endpoint, esempi curl
```

Tabelle: `topologie`, `dispositivi` (FK su topologia, `ON DELETE CASCADE`), `connessioni`
(FK su topologia, `ON DELETE CASCADE`).

Endpoint: `GET /api/topologie`, `GET /api/topologie/:id`, `POST /api/topologie`,
`PUT /api/topologie/:id`, `DELETE /api/topologie/:id`, `GET /api/health`.

### Cosa si scambiano frontend e API

Il corpo di `POST` e `PUT` è la topologia del frontend (`nome`, `dispositivi`, `connessioni`); `versione`
e `id` del corpo vengono ignorati. La risposta è la topologia **salvata**, nella forma che il frontend
si aspetta già:

```json
{
    "id": 2,
    "nome": "Rete aula 3",
    "creata_il": "2026-09-25T13:37:27.000Z",
    "dispositivi": [{ "id": 5, "tipo": "Router", "nome": "Router-01", "x": 600, "y": 120,
                      "ip": "192.168.1.201", "hostname": "router-01", "stato": "Online" }],
    "connessioni": [{ "id": 4, "sourceId": 5, "targetId": 6 }]
}
```

Il database tiene le colonne in italiano (`sorgente_id`, `destinazione_id`) e l'API le rinomina in
`sourceId`/`targetId`: la traduzione sta tutta qui, così il modello dati del frontend non cambia.
Gli id dei dispositivi li assegna il database: il server rimappa i collegamenti con una `Map`
(vecchio id → nuovo id) e restituisce la topologia salvata, che il frontend usa per rinfrescare lo
stato — è la contromisura alla trappola "id diversi fra client e database".

### Come il frontend parla con l'API (B4)

```ts
@Service()
export class TopologiaApiService {
    elenco(): Promise<TopologiaSalvata[]>   // GET    /api/topologie
    apri(varId: number): Promise<Topologia> // GET    /api/topologie/:id
    salva(varTopologia): Promise<Topologia> // POST   /api/topologie  (la risposta rimappa gli id)
    elimina(varId: number): Promise<void>   // DELETE /api/topologie/:id
}
```

- `provideHttpClient()` in `app.config.ts`: è l'unica aggiunta all'avvio dell'app.
- In sviluppo la toolbar chiama `/api/topologie` sulla **stessa origine** (porta 4200) e ci pensa
  `proxy.conf.json`, richiamato da `"proxyConfig"` nelle opzioni di `serve` in `angular.json`: niente
  CORS, niente URL assoluto da cambiare fra sviluppo e produzione.
- La toolbar (`components/strumenti`) è **smart**: tiene `elencoServer`, `idScelto`, `serverAttivo` e
  `inCorso` come signals, legge l'elenco in `ngOnInit` e passa ogni lavoro a `esegui()`, che accende
  `inCorso` (disabilita i pulsanti), cattura gli errori e li traduce in un messaggio leggibile
  (`status == 0` → "server non raggiungibile, avvia `docker compose up -d`").
- Dopo un salvataggio il frontend **riapplica la topologia tornata dal server**
  (`service.applicaTopologia(salvata)`): il canvas resta identico a schermo, ma gli id diventano quelli
  del database, quindi salvare due volte di seguito non duplica nulla.

Comandi utili per provare a mano (database e API accesi):

```bash
curl localhost:3000/api/health
curl localhost:3000/api/topologie
curl localhost:3000/api/topologie/1
curl -X POST localhost:3000/api/topologie -H 'Content-Type: application/json' -d @topologia.json
curl -X DELETE localhost:3000/api/topologie/2
```

Esiti previsti: `400` corpo non valido o id non numerico, `404` topologia inesistente, `503` su
`/api/health` se il database è spento, `500` per un errore del database (con `rollback` della
transazione, quindi senza righe a metà).

| # | Stato | Obiettivo |
|---|---|---|
| **B1** | fatto | `docker-compose.yml` con il servizio `db` + `db/init.sql` |
| **B2** | fatto | API Express con pool MySQL e i 6 endpoint (verifica con `curl`) |
| **B3** | fatto | `Dockerfile` dell'API e servizio `api` nel compose con `healthcheck` |
| **B4** | fatto | Integrazione frontend: `provideHttpClient()`, `TopologiaApiService`, pulsanti server, `proxy.conf.json` |
| **B5** | da fare | `README.md` del backend, screenshot del salvataggio sul server, aggiornamento della documentazione |

## 7. Trappole note e contromisure

| Trappola | Contromisura |
|---|---|
| Il `click` scatta anche dopo un trascinamento | nessun `(click)` sui dispositivi: si decide in `pointerup` con soglia di 4 px |
| Il tasto destro avvia un drag | `if (event.button != 0) { return }` in `pointerdown` |
| Drag "incollato" se si rilascia fuori dall'elemento | `setPointerCapture` in `pointerdown`, rilascio in `pointerup` e `pointercancel` |
| `setPointerCapture` è `undefined` in jsdom | chiamata opzionale: `setPointerCapture?.(event.pointerId)` |
| Coordinate sbagliate con scroll o canvas spostato | `clientX/Y − getBoundingClientRect()`, mai `offsetX/offsetY` |
| Le linee non si aggiornano dopo uno spostamento | mutazioni immutabili (`map` + spread) e `computed` per gli estremi |
| Id duplicati dopo un'eliminazione | `Math.max(0, ...ids) + 1`, non `length + 1` |
| `@for` senza `track` | sempre `track d.id`, `track linea.id`, `track c.id` |
| Il menu del browser si apre sopra la sidebar | `(contextmenu)` con `preventDefault()` |
| L'overlay SVG blocca i click | `pointer-events: none` sull'overlay, dispositivi dopo l'SVG nel DOM |
| `[x1]="…"` non funziona sull'SVG | usare `[attr.x1]`, `[attr.y1]`, `[attr.x2]`, `[attr.y2]` |
| Dispositivo trascinato fuori dal canvas | clamp delle coordinate con le costanti |
| `confirm()` non è implementato in jsdom | `vi.spyOn(window, "confirm").mockReturnValue(true)` nella spec |
| `localStorage` che lancia (storage pieno, modalità privata) | `try/catch` dentro `PersistenzaService` |
| Budget CSS dei componenti (4 kB) | palette e stili comuni in `styles.css`, nel componente solo il layout |
| MySQL pronto dopo l'API | `healthcheck` + `depends_on: condition: service_healthy` |
| Id dei dispositivi diversi fra client e database | il server rimappa gli id e **restituisce la topologia salvata**, che il frontend usa per rinfrescare lo stato |
| Il `proxyConfig` non vale per un `ng serve` già avviato | riavviare il dev server dopo aver toccato `angular.json` o `proxy.conf.json` (e svuotare `.angular/cache`) |
| Errore generico "Qualcosa non ha funzionato" quando il server è spento | `status == 0` di `HttpErrorResponse` = server irraggiungibile: messaggio dedicato che dice di avviare `docker compose up -d` |

## 8. Comandi

```bash
cd ~/Desktop/Signals/esame_angular
npx ng build                        # build di produzione
npx ng test --watch=false           # test
npx ng serve                        # prova manuale su http://localhost:4200
npx ng g c components/<nome>        # nuovo componente

cd ~/Desktop/Signals/esame_backend
docker compose up --build -d        # database + API, entrambi in container
docker compose ps                   # stato e "healthy" dei due servizi
docker compose logs -f api          # log dell'API
docker compose down                 # ferma tutto (i dati restano nel volume)
docker compose down -v              # ferma tutto e cancella anche il database
docker compose exec db mysql -uesame -pesame topologie -e "select * from dispositivi;"

# API dal computer invece che dal container (utile per modificarla e riavviarla subito):
# il database resta nel container, l'API usa DB_HOST=127.0.0.1 e DB_PORT=3307 del .env
docker compose up -d db
npm start
```
