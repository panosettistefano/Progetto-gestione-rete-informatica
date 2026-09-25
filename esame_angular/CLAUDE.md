## Obiettivo

Realizzare una piccola applicazione grafica per la **gestione visuale di una rete informatica**.

L'applicazione dovrà mettere a disposizione un **canvas**, cioè un'area grafica all'interno della quale l'utente potrà costruire una semplice topologia di rete posizionando e collegando diversi dispositivi.

## Requisiti funzionali

L'applicazione deve permettere di gestire almeno le seguenti tipologie di dispositivi:

- PC
- Switch
- Router

Ogni dispositivo deve essere rappresentato tramite una relativa **icona grafica**.

### 1. Inserimento dei dispositivi

L'utente deve poter aggiungere uno o più dispositivi all'interno del canvas.

Ogni elemento dovrà avere almeno:

- un identificativo univoco;
- una tipologia (`PC`, `Switch`, `Router`);
- una posizione sul canvas, identificata dalle coordinate `x` e `y`;
- un nome o una label visualizzata graficamente.

Esempio concettuale:

```text
Dispositivo
├── id
├── tipo
├── nome
├── x
└── y
```

### 2. Posizionamento sul canvas

I dispositivi devono essere posizionabili liberamente all'interno del sistema di coordinate del canvas.

È preferibile implementare il **drag & drop**, in modo che l'utente possa trascinare un dispositivo e modificarne la posizione.

Quando un elemento viene spostato, le sue coordinate devono essere aggiornate.

### 3. Connessione tra dispositivi

L'utente deve poter creare una connessione tra due dispositivi.

Una possibile modalità di interazione è:

1. click sul primo dispositivo;
2. il dispositivo viene evidenziato come elemento selezionato;
3. click sul secondo dispositivo;
4. viene creata una connessione grafica tra i due elementi.

La connessione può essere rappresentata mediante una linea.

Esempio:

```text
[PC-01] -------- [Switch-01] -------- [Router-01]
```

Le linee di connessione devono aggiornarsi automaticamente nel caso in cui uno dei due dispositivi venga spostato.

### 4. Gestione delle connessioni

Ogni collegamento dovrebbe essere rappresentato da una struttura dati contenente almeno:

```text
Connessione
├── id
├── sourceId
└── targetId
```

dove `sourceId` e `targetId` rappresentano gli identificativi dei dispositivi collegati.

## Dettaglio del dispositivo

Implementare, se possibile, una schermata di dettaglio del dispositivo.

Con il **click destro** su un dispositivo deve essere possibile visualizzarne le informazioni.

La visualizzazione può essere implementata in uno dei seguenti modi:

- apertura di una **sidebar laterale**;
- apertura di una finestra/modale;
- navigazione verso una pagina dedicata al dispositivo.

Il dettaglio potrebbe mostrare informazioni come:

```text
Nome: Router principale
Tipo: Router
IP: 192.168.1.1
Hostname: router-main
Stato: Online
```

## Persistenza dei dati – Bonus

Come funzionalità bonus, implementare il salvataggio della topologia creata.

Sono ammesse due possibili soluzioni.

### Soluzione A – Local Storage

Salvare la configurazione della rete nel **Local Storage del browser**.

Devono essere salvati almeno:

- dispositivi;
- coordinate;
- collegamenti;
- eventuali proprietà aggiuntive dei dispositivi.

Alla riapertura dell'applicazione, la topologia deve poter essere ripristinata automaticamente oppure attraverso un pulsante dedicato.

Esempio:

```text
Salva topologia
Carica topologia
Cancella topologia
```

### Soluzione B – REST API

In alternativa, è possibile realizzare una semplice **REST API** per la persistenza dei dati.

Esempi di endpoint:

```http
GET /api/topologies

GET /api/topologies/{id}

POST /api/topologies

PUT /api/topologies/{id}

DELETE /api/topologies/{id}
```

La topologia può essere rappresentata tramite una struttura JSON simile alla seguente:

```json
{
  "id": 1,
  "name": "Rete laboratorio",
  "devices": [
    {
      "id": 1,
      "type": "router",
      "name": "Router-01",
      "x": 420,
      "y": 120,
      "ip": "192.168.1.1"
    },
    {
      "id": 2,
      "type": "switch",
      "name": "Switch-01",
      "x": 420,
      "y": 300
    }
  ],
  "connections": [
    {
      "id": 1,
      "sourceId": 1,
      "targetId": 2
    }
  ]
}
```

L'implementazione della REST API è considerata un'estensione rispetto ai requisiti principali.

## Estensioni facoltative

Gli studenti che completano le funzionalità principali possono aggiungere una o più delle seguenti funzionalità:

- eliminazione di un dispositivo;
- eliminazione di una connessione;
- modifica del nome del dispositivo;
- modifica dell'indirizzo IP;
- colori diversi per PC, switch e router;
- evidenziazione del dispositivo selezionato;
- zoom del canvas;
- spostamento/panning del canvas;
- salvataggio in Local Storage;
- persistenza tramite REST API;
- caricamento di una topologia precedentemente salvata;
- esportazione della configurazione in JSON;
- importazione della configurazione da JSON;
- verifica che un dispositivo non possa essere collegato a sé stesso;
- verifica della presenza di connessioni duplicate.

## Documentazione obbligatoria

Il progetto deve essere accompagnato da una breve **documentazione tecnica**.

La documentazione può essere realizzata in formato:

- Markdown (`README.md`);
- PDF;
- documento Word.

Deve contenere almeno le seguenti sezioni.

### 1. Descrizione del progetto

Descrivere brevemente:

- obiettivo dell'applicazione;
- funzionalità implementate;
- eventuali funzionalità bonus.

### 2. Tecnologie utilizzate

Indicare le principali tecnologie utilizzate, ad esempio:

```text
Frontend: Angular / React / JavaScript
Backend: Node.js / Spring Boot / .NET
Database: SQLite / altro
Persistenza: Local Storage / REST API
```

Naturalmente devono essere indicate soltanto le tecnologie effettivamente utilizzate.

### 3. Architettura del progetto

Descrivere brevemente come è organizzata l'applicazione.

Ad esempio:

```text
UI
 |
 v
Canvas
 |
 +--> Devices
 |
 +--> Connections
 |
 v
Storage
```

Nel caso venga realizzata una REST API:

```text
Frontend
   |
   | HTTP / JSON
   v
REST API
   |
   v
Database
```

### 4. Modello dati

Descrivere le principali entità utilizzate.

Ad esempio:

```text
Device
- id
- name
- type
- x
- y
- ip

Connection
- id
- sourceId
- targetId
```

### 5. Istruzioni di avvio

Indicare chiaramente come eseguire il progetto.

Ad esempio:

```bash
npm install
npm start
```

oppure, nel caso di frontend e backend separati:

```text
1. Avviare il backend
2. Avviare il frontend
3. Aprire il browser all'indirizzo indicato
```

### 6. Screenshot di funzionamento

La documentazione deve contenere **screenshot reali dell'applicazione funzionante**.

Devono essere mostrati almeno:

1. canvas con alcuni dispositivi inseriti;
2. almeno una connessione tra dispositivi;
3. dispositivi posizionati in punti differenti del canvas;
4. dettaglio di un dispositivo tramite sidebar, finestra o pagina;
5. eventuale funzionalità di salvataggio/caricamento.

Esempio di documentazione:

```markdown
## Inserimento dispositivi

Nell'immagine seguente sono presenti un router,
uno switch e due PC.

![Canvas con dispositivi](docs/canvas.png)

## Connessioni

La seguente schermata mostra i dispositivi collegati.

![Connessioni](docs/connections.png)

## Dettaglio dispositivo

Il click destro permette di aprire il pannello
con le informazioni del dispositivo.

![Dettaglio dispositivo](docs/device-detail.png)
```

Gli screenshot devono essere salvati preferibilmente in una cartella dedicata:

```text
project/
├── src/
├── docs/
│   ├── canvas.png
│   ├── connections.png
│   └── device-detail.png
└── README.md
```

## Risultato atteso

Al termine dell'esercitazione l'utente dovrebbe poter costruire graficamente una semplice topologia di rete, ad esempio:

```text
             [Router]
                |
             [Switch]
             /      \
          [PC-01]  [PC-02]
```

Gli elementi devono poter essere spostati liberamente mantenendo aggiornate le relative connessioni.

Il progetto consegnato dovrà quindi comprendere:

- codice sorgente;
- applicazione funzionante;
- documentazione tecnica;
- screenshot delle principali funzionalità.

## Bonus avanzato

Come funzionalità avanzata, implementare una modalità **Edit / Connect**:

- in modalità **Edit** è possibile spostare i dispositivi;
- in modalità **Connect** il primo click seleziona il dispositivo sorgente e il secondo click crea il collegamento con il dispositivo destinazione.

In questo modo le due tipologie di interazione risultano chiaramente separate.





-----------------------------------------------
## RICHIESTA SPECIFICA per CLAUDE
Questo è il progetto di esame da fare. Io personalmente vorrei realizzarlo con un DB collegato con docker compose e dockerfile per avere un db veloce e contanerizzabile.
###
Per quando riguarda la realizzazione bisogna fare prima il front end (in questa cartella) e poi creare successivamente il backend in un altra folder sempre dentro la cartella "Signals". La cosa importante è che adesso che hai tutti i requisiti e l'obbiettivo del progetto non è realizzare tutto in un unico ciclo ma strutturare il lavoro per step, Infatti l'output di questo promprt deve essere proprio un file .md dove Strutturi tu tutto il lavoro step by step e mi scrivi tutto quello che ne viene fuori ora da questo planning mode. 

claude --resume 4e0c8d58-7616-4986-b28b-f67cbecebc50