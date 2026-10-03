# API della topologia di rete — backend

API REST che salva e rilegge le topologie di rete costruite con il frontend Angular
(`../esame_angular`). È la **Soluzione B** prevista dalla consegna d'esame: il frontend
resta utilizzabile da solo con il Local Storage, questa API aggiunge la persistenza
su un database vero.

Il `docker-compose.yml` di questa cartella avvia **tutta l'infrastruttura del progetto**, non
solo il backend: sono **tre container** che partono in fila, ognuno aspettando che il
precedente sia pronto.

```text
   docker compose up -d

   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │    db        │ ───► │     api      │ ───► │   frontend   │
   │  MySQL 8.4   │      │ Node/Express │      │    nginx     │
   └──────────────┘      └──────────────┘      └──────────────┘
     esame_db              esame_api            esame_frontend
      porta 3307            porta 3000            porta 8080
```

Il frontend si costruisce dalla cartella accanto: `build: ../esame_angular`.

## Tecnologie

| Pezzo | Scelta |
|---|---|
| Runtime | Node.js 24 (`node:24-alpine` nel container) |
| Framework | Express 5.2 |
| Driver database | `mysql2/promise` con pool di connessioni |
| Database | MySQL 8.4 in container |
| Web server del frontend | nginx (`nginx:alpine`), con l'applicazione Angular compilata dentro |
| Container | due Dockerfile (API e frontend) + docker compose (volume nominato per i dati) |
| Altro | `cors`, `dotenv`, moduli ES (`"type": "module"`) |

## Struttura

```
esame_backend/
├── docker-compose.yml      db + api + frontend, healthcheck e dipendenze
├── Dockerfile              immagine dell'API (node:24-alpine)
├── .dockerignore           node_modules, .env, ... fuori dal contesto di build
├── .env                    credenziali e porte (solo per lo sviluppo locale)
├── package.json            express, mysql2, cors, dotenv
├── db/
│   └── init.sql            schema delle 3 tabelle + dati di esempio
└── src/
    ├── index.js            app Express, /api/health, gestione errori
    ├── db.js              pool di connessioni MySQL
    └── routes/
        └── topologie.js   i 5 endpoint REST
```

Il `Dockerfile` e la `nginx.conf` del frontend stanno invece in `../esame_angular`.

## Avvio

Dalla cartella `esame_backend`:

```bash
docker compose up --build -d      # costruisce le immagini e avvia i tre container
docker compose ps                 # tutti e tre devono risultare "running (healthy)"
curl localhost:3000/api/health    # {"stato":"ok","database":"connesso"}
```

Poi l'applicazione si apre in due modi:

| Indirizzo | Cos'è |
|---|---|
| **http://localhost:8080** | il frontend servito da nginx, compilato nell'immagine |
| **http://localhost:4200** | il frontend in sviluppo, con `npm start` in `esame_angular` |

L'API risponde su `http://localhost:3000`, MySQL è esposto sulla porta **3307** del
computer (la 3306 resterebbe occupata da un eventuale MySQL già installato; dentro la
rete di docker l'API usa comunque `db:3306`).

⚠️ La prima costruzione richiede qualche minuto, perché il frontend viene compilato dentro
Docker. Dopo una modifica al codice del frontend va ricostruita solo la sua immagine:

```bash
docker compose up -d --build frontend
```

Per fermare tutto:

```bash
docker compose down               # ferma i container, i dati restano nel volume
docker compose down -v            # ferma tutto e cancella anche i dati
```

Al primo avvio MySQL esegue `db/init.sql`, che crea le tabelle e inserisce la topologia
di esempio "Rete laboratorio" (4 dispositivi, 3 collegamenti). Lo script gira **solo se
il volume dati è vuoto**: dopo un `down -v` viene rieseguito, dopo un semplice `down` no.

### Avviare l'API dal computer invece che dal container

Utile per modificarla e riavviarla subito, lasciando il database nel container.
Il `.env` ha già `DB_HOST=127.0.0.1` e `DB_PORT=3307` per questo caso:

```bash
docker compose up -d db           # solo il database
npm install
npm run dev                       # node --watch src/index.js
```

Dentro docker compose, invece, il servizio `api` riceve `DB_HOST=db` e `DB_PORT=3306`
(scritti nel `docker-compose.yml`, che hanno la precedenza sul `.env`).

## Endpoint

| Metodo | Rotta | Cosa fa | Esito |
|---|---|---|---|
| `GET` | `/api/health` | verifica API + database | `200` `{stato, database}` / `503` se il DB non risponde |
| `GET` | `/api/topologie` | elenco delle topologie salvate | `200` `[{id, nome, creata_il}]` |
| `GET` | `/api/topologie/:id` | una topologia completa | `200` topologia / `404` se non esiste |
| `POST` | `/api/topologie` | salva una **nuova** topologia | `201` topologia salvata / `400` corpo non valido |
| `PUT` | `/api/topologie/:id` | **sostituisce** il contenuto di una topologia | `200` topologia salvata / `400`, `404` |
| `DELETE` | `/api/topologie/:id` | elimina una topologia | `200` `{eliminata: id}` / `404` |

Gli id non numerici (`/api/topologie/abc`) rispondono `400`. Gli errori del database
finiscono nel middleware finale: `500` con `{errore, dettaglio}`, e la transazione
viene annullata con un `rollback`, quindi non restano righe a metà.

### Forma dei dati

```json
{
    "id": 1,
    "nome": "Rete laboratorio",
    "creata_il": "2026-09-25T13:37:27.000Z",
    "dispositivi": [
        { "id": 1, "tipo": "Router", "nome": "Router-01", "x": 600, "y": 120,
          "ip": "192.168.1.101", "hostname": "router-01", "stato": "Online" }
    ],
    "connessioni": [{ "id": 1, "sourceId": 1, "targetId": 2 }]
}
```

Nel database le colonne dei collegamenti si chiamano `sorgente_id` e `destinazione_id`,
ma l'API le rinomina in `sourceId` e `targetId`: la traduzione sta tutta qui, così il
frontend usa lo stesso modello dati del Local Storage e della consegna.

In `POST` e `PUT` il campo `versione` e l'`id` di ogni dispositivo **nel corpo** vengono
ignorati: gli id li assegna il database con `AUTO_INCREMENT`. Il server tiene una `Map`
vecchio id → nuovo id e la usa per riscrivere `sourceId`/`targetId` prima di inserire i
collegamenti. La risposta è la topologia **salvata**, con gli id definitivi: il frontend
la riapplica e resta coerente.

Il corpo viene controllato prima di toccare il database: nome obbligatorio, `dispositivi`
e `connessioni` come elenchi, id numerici e diversi fra loro, `tipo` e `stato` fra quelli
ammessi, coordinate intere, niente collegamenti di un dispositivo con sé stesso e niente
collegamenti verso un dispositivo che non compare nell'elenco.

## Esempi con curl

```bash
# elenco delle topologie salvate
curl localhost:3000/api/topologie

# una topologia completa
curl localhost:3000/api/topologie/1

# salvare una nuova topologia
curl -X POST localhost:3000/api/topologie \
     -H 'Content-Type: application/json' \
     -d @topologia.json

# sostituire il contenuto della topologia 2
curl -X PUT localhost:3000/api/topologie/2 \
     -H 'Content-Type: application/json' \
     -d @topologia.json

# eliminare la topologia 2
curl -X DELETE localhost:3000/api/topologie/2
```

Un `topologia.json` minimo da cui partire:

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

## Schema del database

```
topologie     id, nome, creata_il
dispositivi   id, topologia_id → topologie.id, tipo ENUM('PC','Switch','Router'),
              nome, x, y, ip, hostname, stato ENUM('Online','Offline','Manutenzione')
connessioni   id, topologia_id → topologie.id, sorgente_id → dispositivi.id,
              destinazione_id → dispositivi.id
```

Tutte e tre le chiavi esterne sono `ON DELETE CASCADE`: eliminando una topologia
spariscono i suoi dispositivi e i suoi collegamenti, ed eliminando un dispositivo
spariscono i collegamenti che lo toccavano. È la stessa cascata che il frontend fa
sui propri signals.

## Comandi utili

```bash
docker compose logs -f api                                    # log dell'API
docker compose logs -f db                                     # log di MySQL
docker compose exec db mysql -uroot -pesame_root              # shell del database
docker compose exec api sh                                    # shell dentro il container dell'API

# contare le righe delle tre tabelle
docker compose exec -T db mysql -uroot -pesame_root -N -e \
  "use topologie; select (select count(*) from topologie), (select count(*) from dispositivi), (select count(*) from connessioni);"
```

## Nota sulle credenziali

Il file `.env` contiene utente e password del database (`esame` / `esame`, root
`esame_root`). Sono credenziali **di sviluppo**, valide solo per il container di questo
progetto sulla macchina locale: in un ambiente reale andrebbero tenute fuori dal
repository e scelte diverse.
