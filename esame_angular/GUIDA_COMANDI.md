# Guida ai comandi

Tutti i comandi del progetto, cosa fa ognuno e cosa aspettarsi. Ogni comando scritto qui è
stato eseguito davvero su questa macchina, quindi quello che c'è scritto è quello che succede.

Le altre guide del progetto:

| File | Cosa contiene |
|---|---|
| `GUIDA_COMANDI.md` | questo file: come si avvia, si ferma e si controlla |
| `GUIDA_LOGICA.md` | come è fatto dentro e come si muovono i dati |
| `PIANO_LAVORO.md` | il piano di lavoro a milestone e le scelte tecniche |
| `README.md` | la documentazione di consegna (le 6 sezioni richieste) |
| `../esame_backend/README.md` | documentazione del backend: endpoint e schema del database |

## 0. Le due cartelle, i tre container e le quattro porte

Il progetto è diviso in due cartelle sorelle dentro `~/Desktop/Signals`:

```text
~/Desktop/Signals/
├── esame_angular/        il frontend Angular (+ il suo Dockerfile)
└── esame_backend/        l'API Node/Express, e il docker-compose.yml che avvia TUTTO
```

**Un solo `docker compose up` accende l'infrastruttura completa**: database, API e frontend.
Sono tre container che partono in fila, ognuno aspettando che il precedente sia pronto.

```text
   docker compose up -d   (da esame_backend)

   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │  esame_db    │ ───► │  esame_api   │ ───► │esame_frontend│
   │  MySQL 8.4   │      │ Node/Express │      │    nginx     │
   └──────────────┘      └──────────────┘      └──────────────┘
     aspetta: -            aspetta: db           aspetta: api
```

Le porte da tenere a mente:

| Porta | Chi l'ascolta | Serve a |
|---|---|---|
| **8080** | il frontend **nel container** (nginx) | aprire l'app "come in produzione" |
| **4200** | il frontend in **sviluppo** (`ng serve`) | aprire l'app mentre si lavora al codice |
| **3000** | l'API Express | il frontend ci manda i dati |
| **3307** | MySQL sul computer | guardare il database dall'esterno |

Due porte per il frontend non sono un errore: sono **due modi diversi di servire la stessa
applicazione**, e si possono tenere accesi insieme perché non si danno fastidio.

| | `ng serve` (4200) | container (8080) |
|---|---|---|
| A cosa serve | **sviluppare**: ricompila da solo a ogni salvataggio | **far vedere** l'applicazione finita |
| Cosa serve avere acceso | Node sul computer | solo Docker |
| I file serviti | compilati al volo | compilati **una volta** nell'immagine, ottimizzati |
| Il proxy verso l'API | lo fa `proxy.conf.json` | lo fa nginx (`nginx.conf`) |

La 3307 è solo la porta "di casa" del database: **dentro** Docker, MySQL ascolta sulla 3306
standard. Si usa la 3307 fuori per non litigare con un MySQL già installato sul computer.

## 1. Cosa serve avere installato

| Strumento | A cosa serve | Quando serve |
|---|---|---|
| **Node.js 24** e npm | compilare ed eseguire il frontend e l'API dal computer | sviluppo (V1, V3, V4) |
| **Docker** con Compose | far girare database, API e frontend in container | Soluzione B (V2) |
| **Google Chrome** | solo per rigenerare gli screenshot | facoltativo |

Vale la pena notare una cosa: per far vedere il progetto finito **basta Docker**. Node serve
solo per sviluppare — cioè per modificare il codice e vederlo subito senza ricompilare.

Controllo rapido che ci sia tutto:

```bash
node -v                  # v24.x
npm -v                   # 11.x
docker -v                # Docker version 29.x
docker compose version   # Docker Compose version v5.x
```

Se `docker compose version` dà errore, Docker Compose non è installato: è una parte di Docker
che ormai è inclusa, quindi va aggiornato Docker.

## 2. Avvio rapido — solo frontend (Soluzione A)

È il modo più veloce per far vedere l'applicazione: non serve né Docker né il database.

```bash
cd ~/Desktop/Signals/esame_angular
npm install                # solo la prima volta, scarica le librerie
npm start
```

Attendere qualche secondo, finché non compare:

```text
➜  Local:   http://localhost:4200/
```

Poi aprire **http://localhost:4200** nel browser.

**Cosa funziona:** tutto quello che riguarda il canvas — aggiungere dispositivi, trascinarli,
collegarli, il dettaglio con il click destro, eliminare, e i tre pulsanti **Salva**, **Carica**,
**Cancella** che usano il Local Storage del browser.

**Cosa non funziona:** i pulsanti della riga **Server**. Compare la scritta rossa
"Server non raggiungibile: avvia docker compose up -d in esame_backend" ed è normale: senza il
backend acceso non c'è nessun server a cui parlare. È la dimostrazione che il frontend è
autonomo e il backend è un'aggiunta.

**Come si ferma:** `Ctrl+C` nel terminale dove sta girando.

## 3. Avvio completo — tutto con un comando (Soluzione B)

Con **un solo comando** si accende tutta l'architettura: database, API e frontend.

```bash
cd ~/Desktop/Signals/esame_backend
docker compose up --build -d
```

Cosa succede, in ordine: Docker scarica le immagini di MySQL 8.4 e di nginx, costruisce
l'immagine dell'API dal suo `Dockerfile`, costruisce l'immagine del frontend (compila
l'applicazione Angular e la copia dentro nginx), crea il volume per i dati, e infine avvia i
tre container **in fila**: il database, poi l'API quando il database è pronto, poi il frontend
quando l'API è pronta. Il `-d` ("detached") lascia il terminale libero.

⚠️ La **prima** volta ci mette qualche minuto, perché deve compilare l'applicazione Angular
dentro Docker. Le volte successive, se non è cambiato niente, è questione di secondi.

Controllo che sia andata bene:

```bash
docker compose ps
```

Si devono vedere **tre** container, tutti `running`:

```text
esame_db         ...   Up (healthy)
esame_api        ...   Up (healthy)
esame_frontend   ...   Up (healthy)
```

E poi:

```bash
curl localhost:3000/api/health
```

Risposta attesa:

```json
{"stato":"ok","database":"connesso"}
```

Se arriva questa, l'API è viva **e** sta parlando con il database. È il controllo più utile di
tutti.

A questo punto si può aprire l'applicazione in **due modi**, e si può scegliere:

### Modo 1 — il frontend dal container (http://localhost:8080)

Non serve altro: nginx sta già servendo l'applicazione compilata.

```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:8080     # 200
```

e nel browser **http://localhost:8080**. Qui il frontend parla con l'API passando da nginx,
che gli gira le chiamate `/api` (è la stessa cosa che fa l'API con il database, che chiama
`db` per nome). È il modo che serve per **far vedere l'applicazione finita**: non c'è Node di
mezzo, non c'è niente da avviare a mano.

### Modo 2 — il frontend in sviluppo (http://localhost:4200)

Serve quando si **modifica** il codice del frontend, perché ricompila da solo a ogni
salvataggio. In un altro terminale:

```bash
cd ~/Desktop/Signals/esame_angular
npm start
```

e nel browser **http://localhost:4200**. Il resto è identico: la riga **Server** della toolbar
mostra quante topologie ci sono sul database e i tre pulsanti `Salva sul server`,
`Apri dal server`, `Elimina dal server`.

Le due versioni possono stare accese insieme, perché ascoltano su porte diverse.

### Quando serve `--build` e quando no

```bash
docker compose up -d            # avvio normale: NON ricostruisce le immagini
docker compose up --build -d    # ricostruisce le immagini, poi avvia
```

Si ricostruisce quando **cambia il codice**:

| Cosa hai cambiato | Cosa fare |
|---|---|
| Codice del backend (`esame_backend/src/`) | `docker compose up -d --build api` |
| Codice del frontend (`esame_angular/src/`) | `docker compose up -d --build frontend` |
| Niente, vuoi solo riaccendere | `docker compose up -d` |

⚠️ Attenzione: nella versione dentro il container il frontend è compilato **una volta sola**,
quindi una modifica al codice non si vede finché non si ricostruisce l'immagine. È il motivo
per cui, mentre si sviluppa, si usa `ng serve` sulla 4200.

## 4. Le varianti di avvio

### Riepilogo

| # | Cosa si vuole fare | Comandi | Porte accese |
|---|---|---|---|
| V1 | Solo il frontend (Local Storage) | `npm start` | 4200 |
| V2 | **Tutta l'architettura in un comando** | `docker compose up -d` | **8080**, 3000, 3307 |
| V3 | Sviluppare il frontend con il backend acceso | `docker compose up -d` + `npm start` | 8080, **4200**, 3000, 3307 |
| V4 | Modificare l'API e riavviarla subito | `docker compose up -d db` + `npm run dev` + `npm start` | 4200, 3000, 3307 |
| V5 | Frontend su una porta diversa | `npm start -- --port 4300` | 4300, ... |
| V6 | Fermare solo un pezzo | `docker compose stop api` / `start api` | — |
| V7 | Rimettere tutto come appena scaricato | `docker compose down -v` + `up -d` | — |

### V2 — Tutta l'architettura, frontend compreso

```bash
cd ~/Desktop/Signals/esame_backend
docker compose up --build -d
```

poi aprire **http://localhost:8080**. È il modo più comodo per far vedere il progetto finito a
qualcun altro: non serve avere Node installato, serve solo Docker. Per il dettaglio di cosa
succede si veda la sezione 3.

### V3 — Sviluppare il frontend tenendo su tutto il resto

È la combinazione che si usa mentre si lavora al frontend: il backend e il database stanno nei
container, il frontend lo serve `ng serve` per avere il ricaricamento automatico.

```bash
cd ~/Desktop/Signals/esame_backend
docker compose up -d                  # accende db, api e frontend

cd ~/Desktop/Signals/esame_angular
npm start                             # in un altro terminale, per sviluppare
```

Si lavora sulla **4200** e intanto la **8080** continua a servire l'ultima versione compilata.

### V4 — Solo il database in Docker, l'API dal computer

Serve quando si modifica il codice dell'API: dentro un container bisognerebbe ricostruire
l'immagine ogni volta, sul computer basta un riavvio.

```bash
cd ~/Desktop/Signals/esame_backend
docker compose up -d db        # avvia SOLO il database
npm run dev                    # avvia l'API dal computer, con riavvio automatico
```

`npm run dev` esegue `node --watch src/index.js`: quando si salva un file dentro `src/`, l'API
si riavvia da sola. Il comando senza riavvio automatico è `npm start` (che esegue
`node src/index.js`).

Funziona perché nel file `.env` ci sono già:

```bash
DB_HOST=127.0.0.1
DB_PORT=3307
```

cioè "il database è sul computer, sulla porta che il container espone". Quando invece l'API
gira **dentro** Docker, il `docker-compose.yml` le sostituisce con `db` e `3306`: quella è
l'unica differenza fra i due modi di avviare la stessa API.

⚠️ Non si possono avere insieme l'API nel container e l'API sul computer: userebbero
entrambe la porta 3000. Prima si ferma una, poi si avvia l'altra:

```bash
docker compose stop api        # libera la porta 3000
npm run dev                    # ora l'API può partire dal computer
```

### V5 — Se la porta 4200 è occupata

```bash
cd ~/Desktop/Signals/esame_angular
npm start -- --port 4300
```

Il doppio `--` serve a passare l'opzione a `ng serve` invece che a npm. Tutto il resto
funziona uguale, **compreso il proxy verso l'API**: il proxy è configurato nel dev server,
quindi vale su qualunque porta.

### V7 — Ripartire da zero

```bash
cd ~/Desktop/Signals/esame_backend
docker compose down -v         # ferma tutto e cancella anche il volume dei dati
docker compose up -d           # ricrea il database e riesegue db/init.sql
```

Dopo questo il database contiene di nuovo solo la topologia di esempio "Rete laboratorio".
⚠️ `-v` cancella i dati in modo definitivo.

## 5. Fermare, riavviare, cancellare

| Comando | Container | Rete Docker | **Dati** |
|---|---|---|---|
| `Ctrl+C` (nel terminale del frontend) | — | — | — |
| `docker compose stop` | fermati, restano lì | resta | **restano** |
| `docker compose start` | riavviati | — | restano |
| `docker compose restart api` | riavvia solo l'API | resta | restano |
| `docker compose down` | **rimossi** | rimossa | **restano** (stanno nel volume) |
| `docker compose down -v` | rimossi | rimossa | **cancellati** |

La cosa importante da sapere: **i dati non stanno dentro il container**, stanno in un *volume*
Docker che si chiama `esame_backend_dati_db`. Per questo `docker compose down` li lascia intatti
e si ritrovano tutti al `up` successivo. Solo `-v` (`--volumes`) li cancella.

Dopo un `docker compose stop` o `down`, per riaccendere basta:

```bash
cd ~/Desktop/Signals/esame_backend
docker compose up -d
```

## 6. Diagnostica — quando qualcosa non va

### I controlli, in ordine

**1. I container sono accesi?**

```bash
cd ~/Desktop/Signals/esame_backend
docker compose ps
```

Devono esserci `esame_db`, `esame_api` e `esame_frontend`, tutti `Up (...) (healthy)`. Se un
container manca o dice `Restarting`, si va al punto 4 (i log).

**2. L'API risponde?**

```bash
curl localhost:3000/api/health
```

| Risposta | Significato |
|---|---|
| `{"stato":"ok","database":"connesso"}` | tutto a posto |
| `{"stato":"ko","database":"non raggiungibile", ...}` | l'API è viva ma non parla con MySQL |
| `curl: (7) Failed to connect` | l'API è spenta: non è avviata, o è crashatta |

**3. Il frontend nel container si vede?**

```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:8080        # 200
curl localhost:8080/api/health                                     # la risposta dell'API
```

La seconda riga è la più utile delle due: se risponde, vuol dire che nginx sta servendo la
pagina **e** girando correttamente le chiamate all'API. È la catena completa in un comando.

**4. Cosa dicono i log?**

```bash
docker compose logs -f api          # log dell'API, in diretta (Ctrl+C per uscire)
docker compose logs -f db           # log di MySQL
docker compose logs -f frontend     # log di nginx
docker compose logs --tail=50 api   # solo le ultime 50 righe, senza -f
```

**5. Chi sta occupando le porte?**

```bash
ss -ltnp | grep -E ':(4200|8080|3000|3307)'
```

Mostra quali processi ascoltano su quelle porte. Serve quando qualcosa "non parte" perché la
porta è già presa da un altro programma.

**6. Cosa c'è dentro il database?**

```bash
# aprire una shell MySQL interattiva dentro il container
docker compose exec db mysql -uroot -pesame_root

# oppure, senza entrare: contare le righe delle tre tabelle
docker compose exec -T db mysql -uroot -pesame_root -N -e \
  "use topologie; select (select count(*) from topologie), (select count(*) from dispositivi), (select count(*) from connessioni);"

# vedere l'elenco delle topologie salvate
docker compose exec -T db mysql -uroot -pesame_root -e \
  "use topologie; select id, nome, creata_il from topologie;"
```

Dentro la shell interattiva si scrivono le query normalmente (`use topologie;`, `show tables;`,
`select * from dispositivi;`) e si esce con `exit`.

Su ogni comando `mysql` compare la riga `mysql: [Warning] Using a password on the command line
interface can be insecure.`: è un avviso normale, non un errore. MySQL segnala che la password
è scritta dentro il comando invece che in un file di configurazione protetto — per un database
di sviluppo in locale va benissimo. Se dà fastidio, basta aggiungere `2>/dev/null` in fondo al
comando per non vedere gli avvisi.

Nella shell interattiva si può anche scrivere `docker compose exec db mysql -uroot -p` (la `-p`
senza password): così la password viene chiesta a parte e non resta nella cronologia. ⚠️ Funziona
**solo** nella shell interattiva: nella forma con `-T` e `-e`, che non ha un terminale vero, MySQL
non riesce a chiederla e risponde `Access denied ... (using password: NO)`.

### Errori tipici e rimedio

| Sintomo | Causa | Cosa fare |
|---|---|---|
| Nel frontend: "Server non raggiungibile" | il backend non è acceso | `docker compose up -d` in `esame_backend` |
| Nel frontend: "Errore del server (500)" | l'API ha risposto ma con un errore | `docker compose logs --tail=50 api` |
| `curl (7) Failed to connect` sulla 3000 | l'API è spenta | `docker compose ps`, poi i log |
| `bind: address already in use` | la porta è già occupata da altro | cambiare `MYSQL_PORT`, `API_PORT` o `FRONTEND_PORT` nel `.env`, oppure fermare chi la occupa |
| Il container `esame_api` continua a riavviarsi | di solito il database non è pronto o le credenziali non tornano | `docker compose logs api` |
| I dati sono spariti | è stato eseguito `down -v` | ripartire con `up -d`: si torna ai dati di esempio |
| Il browser mostra un overlay rosso d'errore ma `npm run build` passa | la cache del dev server si è incastrata | fermare, `rm -rf .angular/cache`, riavviare `npm start` |
| `ng serve` non vede le modifiche | watcher incastrato | come sopra |
| Sulla 8080 non si vedono le ultime modifiche al frontend | nel container il frontend è compilato nell'immagine, non si aggiorna da solo | `docker compose up -d --build frontend` |
| La 8080 non risponde | il container del frontend non è partito | `docker compose ps`, poi `docker compose logs --tail=50 frontend` |
| Il frontend nel container dà "Server non raggiungibile" | l'API non è pronta, o nginx non la trova | `docker compose logs --tail=50 api` e controllare che `esame_api` sia `(healthy)` |
| `docker compose up` si ferma su "Building frontend" per minuti | sta compilando Angular dentro Docker | aspettare: la prima volta è normale, le successive è veloce |

## 7. Comandi di sviluppo e verifica

### I test

```bash
cd ~/Desktop/Signals/esame_angular
npx ng test --watch=false
```

Esegue tutti i test una volta sola e esce. Risultato atteso:

```text
Test Files  7 passed (7)
     Tests  101 passed (101)
```

Il comando `npm test` fa la stessa cosa ma resta in ascolto e riesegue i test a ogni
salvataggio (comodo mentre si lavora, scomodo per una presentazione: non esce mai).

### La build di produzione

```bash
npm run build
```

Crea i file ottimizzati in `dist/esame_angular/browser/`. È esattamente quello che fa il
`Dockerfile` del frontend come primo passo, prima di copiarli dentro nginx.

**Il punto importante da sapere.** L'applicazione chiama l'API su `/api/topologie` **della
propria origine**: non c'è nessun `localhost:3000` scritto da nessuna parte nel codice. Vuol
dire che qualcuno, davanti ai file compilati, deve **girare `/api` verso l'API vera**. Lo fanno
in due, in due situazioni diverse:

| | Chi fa da proxy | Configurazione |
|---|---|---|
| in sviluppo (4200) | il dev server di Angular | `proxy.conf.json` |
| nel container (8080) | nginx | `nginx.conf` |

Il vantaggio di questa scelta è che **lo stesso identico codice compilato funziona in tutti e
due i casi**, e non c'è nessun indirizzo da cambiare fra la macchina di sviluppo e il
container. Il rovescio della medaglia: se si prendessero i file di `dist/` e li si aprisse con
un server statico qualunque (o direttamente con il browser come `file://`), i pulsanti della
riga Server non funzionerebbero, perché `/api` non porterebbe da nessuna parte. Per questo
esiste il `Dockerfile`.

### Gli screenshot della documentazione

```bash
# servono il frontend acceso (npm start) e, per l'ultimo scatto, anche il backend
node scripts/screenshot.mjs
```

Apre il Chrome di sistema, costruisce la topologia d'esempio trascinando e collegando davvero,
e riscrive le cinque immagini in `docs/`. ⚠️ L'ultimo passo salva una topologia sul database,
quindi ogni esecuzione ne aggiunge una all'elenco.

### Aggiungere un componente o un service

```bash
npx ng g c components/nome-componente
npx ng g s services/nome-service
```

Genera i file vuoti; poi vanno adattati allo stile del progetto (4 spazi di indentazione nei
service, `@Service()`, `inject()`).

## 8. L'API, provata con curl

Tutti gli endpoint, con la risposta attesa. Da eseguire con il backend acceso.

```bash
# 1. lo stato di API e database
curl localhost:3000/api/health
# {"stato":"ok","database":"connesso"}

# 2. l'elenco delle topologie salvate (solo id, nome e data)
curl localhost:3000/api/topologie
# [{"id":1,"nome":"Rete laboratorio","creata_il":"2026-09-25T15:37:27.000Z"}]

# 3. una topologia completa, con dispositivi e connessioni
curl localhost:3000/api/topologie/1

# 4. salvare una topologia nuova (201 Created)
curl -X POST localhost:3000/api/topologie \
     -H 'Content-Type: application/json' \
     -d @topologia.json

# 5. sostituire il contenuto di una topologia esistente
curl -X PUT localhost:3000/api/topologie/2 \
     -H 'Content-Type: application/json' \
     -d @topologia.json

# 6. eliminare una topologia (e con lei dispositivi e connessioni)
curl -X DELETE localhost:3000/api/topologie/2
# {"eliminata":2}
```

Un file `topologia.json` da cui partire (i file di esempio sono anche nel README del backend):

```json
{
    "nome": "Rete aula 3",
    "dispositivi": [
        { "id": 1, "tipo": "Router", "nome": "Router-01", "x": 600, "y": 120,
          "ip": "192.168.1.101", "hostname": "router-01", "stato": "Online" },
        { "id": 2, "tipo": "Switch", "nome": "Switch-01", "x": 600, "y": 340,
          "ip": "192.168.1.102", "hostname": "switch-01", "stato": "Offline" }
    ],
    "connessioni": [{ "id": 1, "sourceId": 1, "targetId": 2 }]
}
```

Gli esiti di errore, per non farsi trovare impreparati:

| Cosa si manda | Risposta |
|---|---|
| `GET /api/topologie/999` (non esiste) | `404` `{"errore":"Topologia 999 non trovata."}` |
| `GET /api/topologie/abc` (id non numerico) | `400` `{"errore":"Id non valido: abc"}` |
| `POST` con un corpo incompleto | `400` con il motivo (es. "Serve il nome della topologia.") |
| `DELETE` su una topologia già cancellata | `404` |
| una rotta che non esiste | `404` `{"errore":"Rotta non trovata: ..."}` |
| il database spento | `503` su `/api/health`, `500` sulle altre |

## 9. Scaletta per la presentazione

Un ordine possibile per far vedere tutto senza intoppi. La demo si fa sulla versione
**dentro i container** (`http://localhost:8080`), perché è quella che mostra l'architettura
completa. **Provare la sequenza a casa prima.**

**Prima di entrare in aula** (con calma, non davanti alla classe):

```bash
cd ~/Desktop/Signals/esame_backend
docker compose up -d
```

Un comando solo. Poi aprire `http://localhost:8080` nel browser e **lasciarlo già caricato**,
con un terminale aperto nella cartella `esame_backend` per i comandi.

**In classe:**

1. **L'architettura** — aprire con `docker compose ps` e commentare i tre container
   `esame_db`, `esame_api`, `esame_frontend`, tutti `(healthy)`. Dire che sono partiti con
   **un solo comando** e che ognuno aspetta che il precedente sia pronto. È il modo migliore
   per iniziare, perché inquadra tutto il resto.
2. **Il canvas vuoto** — tornare al browser su `http://localhost:8080` e mostrare che all'avvio
   non c'è niente: la topologia si costruisce da zero.
3. **Aggiungere i dispositivi** — un Router, uno Switch, due PC. Far notare che ognuno ha
   icona e colore diversi e che il nome è progressivo (`PC-01`, `PC-02`).
4. **Trascinarli** — spiegare che sono liberi di muoversi e che non escono dal canvas.
5. **Collegarli** — premere **Collegamento**, cliccare il primo e poi il secondo dispositivo:
   la linea compare. Provare a collegare due volte gli stessi due: arriva l'avviso che sono
   già collegati. Provare un dispositivo con sé stesso: avviso anche lì.
6. **Spostare un dispositivo collegato** — è il momento migliore della demo: le linee seguono
   il dispositivo da sole, senza che nessuno ridisegni niente a mano.
7. **Il dettaglio** — click **destro** su un dispositivo: si apre la sidebar con IP, hostname
   e stato.
8. **Attivare lo stato** — premere **Attiva stato** su un **Router** e far notare che si
   accendono anche lo switch e i PC collegati: "arriva internet".
9. **Salvare in locale** — premere **Salva**, poi **ricaricare la pagina** (F5): il canvas
   torna vuoto. Premere **Carica** e la topologia ritorna identica. È l'effetto migliore della
   presentazione.
10. **Salvare sul server** — premere **Salva sul server**. Far notare la tendina che si popola
    e il conteggio. Poi mostrare che è finito davvero nel database:
    ```bash
    cd ~/Desktop/Signals/esame_backend
    docker compose exec -T db mysql -uroot -pesame_root -e \
      "use topologie; select id, nome from topologie;"
    ```
11. **Il proxy** — se qualcuno chiede come fa il frontend a parlare con l'API senza problemi di
    CORS: nel container ci pensa nginx (`nginx.conf`), in sviluppo ci pensa `proxy.conf.json`.
    In tutti e due i casi il browser vede una sola origine.
12. **Chiusura** — dire che le due soluzioni di persistenza (Local Storage e REST API) sono
    indipendenti e che il frontend funziona anche da solo: basta non accendere il backend.

**Se qualcosa non va durante la demo:** `curl localhost:3000/api/health` è il primo comando da
digitare, `docker compose ps` il secondo e `docker compose logs --tail=50 api` il terzo.

**Se l'aula non ha internet:** l'applicazione non si rompe, ma **perde l'aspetto grafico**,
perché Bootstrap e le icone arrivano da una CDN (`index.html`). Se si vuole essere sicuri,
conviene provarla prima senza rete: in quel caso si vedono i riquadri senza stile.

## 10. Tutti i comandi in una tabella

| Comando | Dove | Cosa fa |
|---|---|---|
| `npm install` | `esame_angular` | scarica le librerie (la prima volta) |
| `npm start` | `esame_angular` | avvia il frontend su http://localhost:4200 |
| `npm start -- --port 4300` | `esame_angular` | avvia il frontend su un'altra porta |
| `npx ng test --watch=false` | `esame_angular` | esegue i test una volta e esce |
| `npm test` | `esame_angular` | esegue i test e resta in ascolto |
| `npm run build` | `esame_angular` | build di produzione in `dist/` |
| `node scripts/screenshot.mjs` | `esame_angular` | rigenera gli screenshot in `docs/` |
| `node scripts/verifica-container.mjs` | `esame_angular` | verifica il frontend dentro il container |
| `npx ng g c components/nome` | `esame_angular` | genera un componente vuoto |
| `docker compose up --build -d` | `esame_backend` | **costruisce e avvia tutta l'infrastruttura** (db + api + frontend) |
| `docker compose up -d` | `esame_backend` | avvia i tre container senza ricostruire |
| `docker compose up -d --build frontend` | `esame_backend` | ricostruisce solo il frontend (dopo una modifica al codice) |
| `docker compose up -d --build api` | `esame_backend` | ricostruisce solo l'API |
| `docker compose up -d db` | `esame_backend` | avvia **solo** il database |
| `docker compose ps` | `esame_backend` | mostra lo stato dei tre container |
| `docker compose logs -f api` | `esame_backend` | log dell'API in diretta |
| `docker compose logs -f frontend` | `esame_backend` | log di nginx in diretta |
| `docker compose logs -f db` | `esame_backend` | log del database in diretta |
| `docker compose stop` / `start` | `esame_backend` | ferma / riavvia i container (dati salvi) |
| `docker compose restart api` | `esame_backend` | riavvia solo l'API |
| `docker compose down` | `esame_backend` | rimuove i container (**i dati restano**) |
| `docker compose down -v` | `esame_backend` | rimuove tutto, **dati compresi** |
| `npm install` | `esame_backend` | scarica le librerie, per l'API dal computer |
| `npm start` | `esame_backend` | avvia l'API dal computer |
| `npm run dev` | `esame_backend` | avvia l'API dal computer con riavvio automatico |
| `docker compose exec db mysql -uroot -pesame_root` | `esame_backend` | shell MySQL dentro il container |
| `curl localhost:3000/api/health` | ovunque | controlla se API e database rispondono |
| `curl localhost:8080/api/health` | ovunque | lo stesso, ma passando da nginx come fa il browser |
| `ss -ltnp \| grep -E ':(4200\|8080\|3000\|3307)'` | ovunque | mostra chi occupa le porte |
