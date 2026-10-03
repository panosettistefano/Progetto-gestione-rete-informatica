# Guida alla logica dell'applicazione

Come è fatta l'applicazione dentro e come si muovono i dati, per poterla spiegare in classe.
È divisa in tre parti: **il frontend** (come funziona l'app), **la persistenza** (dove vanno i
dati quando si salva) e **il backend** (l'API e il database). In fondo c'è una sezione di
domande probabili con le risposte.

Gli altri file del progetto: `GUIDA_COMANDI.md` (come si avvia), `PIANO_LAVORO.md` (le scelte
fatte strada facendo), `README.md` (la documentazione di consegna).

---

# Parte 1 — Il frontend

## 1. L'idea di fondo

L'applicazione ha un solo posto dove vive lo stato della topologia: un **service** chiamato
`TopologiaService`. Dentro ci sono i **signals**, cioè delle variabili che quando cambiano
avvisano da sole chi le sta guardando.

I tre componenti (la toolbar, il canvas, la sidebar) **non si parlano fra loro** e non si
passano dati. Ognuno prende lo stesso service e:

- **chiama i suoi metodi** per fare qualcosa (aggiungi un dispositivo, spostalo, collegalo);
- **legge i suoi signals** per disegnare quello che deve mostrare.

```text
        ┌──────────────────────────────────────────────────┐
        │                   TopologiaService               │
        │                                                  │
        │   signals:    nome, dispositivi, connessioni,    │
        │               modalita, selezionato, idDettaglio │
        │                                                  │
        │   computed:   linee, dispositivoDettaglio,       │
        │               connessioniDettaglio               │
        └───────▲──────────────▲───────────────▲───────────┘
                │              │               │
        leggono │  chiamano    │  leggono      │  leggono
         e      │  metodi      │   e chiamano  │   e chiamano
                │              │               │
        ┌───────┴────┐  ┌──────┴──────┐  ┌─────┴────────┐
        │  Strumenti │  │   Canvas    │  │  Dettaglio   │
        │  (toolbar) │  │             │  │  (sidebar)   │
        └────────────┘  └─────────────┘  └──────────────┘
```

Il vantaggio si vede subito: siccome tutti guardano gli stessi signals, **quando cambia un dato
si aggiorna tutto quello che lo usa**, senza che nessuno debba avvisare nessun altro.

## 2. Struttura delle cartelle

```text
src/app/
├── costanti.ts                    i numeri fissi: 1200×700 di canvas, icona 72 px, soglia 4 px
├── types/                         i tipi di dato, uno per file
│   ├── dispositivo.ts             Dispositivo, TipoDispositivo, StatoDispositivo
│   ├── connessione.ts             Connessione { id, sourceId, targetId }
│   ├── collegamento.ts            Collegamento { id, nome } — una riga dell'elenco in sidebar
│   ├── topologia.ts               Topologia { nome, versione, dispositivi, connessioni }
│   └── topologia-salvata.ts       TopologiaSalvata { id, nome, creata_il } — una riga dell'elenco server
├── services/
│   ├── topologia-service.ts       TUTTO lo stato e TUTTA la logica della topologia
│   ├── persistenza-service.ts     l'unico punto che tocca il Local Storage
│   └── topologia-api-service.ts   l'unico punto che parla con l'API REST
└── components/
    ├── strumenti/                 la toolbar in alto
    ├── canvas/                    l'area di disegno
    └── dettaglio/                 la sidebar che si apre col click destro
```

I tre service hanno tre compiti ben distinti: uno **tiene lo stato**, uno **salva in locale**,
uno **parla con il server**. Nessuno dei tre sa cosa fanno gli altri.

## 3. Lo stato: i signals

Ecco tutto quello che c'è dentro `TopologiaService`. Sono le variabili da sapere a memoria,
perché ogni domanda sul funzionamento passa da qui.

### I signals — i dati che cambiano

| Signal | Tipo | Cosa contiene |
|---|---|---|
| `nome` | `string` | il nome della topologia ("Rete laboratorio") |
| `dispositivi` | `Dispositivo[]` | l'elenco dei dispositivi sul canvas |
| `connessioni` | `Connessione[]` | l'elenco dei collegamenti |
| `modalita` | `'edit' \| 'connect'` | la modalità attiva |
| `selezionato` | `number \| null` | l'**id** del dispositivo scelto come primo capo di un collegamento |
| `idDettaglio` | `number \| null` | l'**id** del dispositivo di cui è aperta la sidebar |

Un dettaglio importante: `selezionato` e `idDettaglio` contengono **id, non oggetti**. È una
scelta voluta: se contenessero l'oggetto del dispositivo, dopo una modifica (uno spostamento)
punterebbero a una copia vecchia. Con l'id, ogni volta si cerca il dispositivo attuale
nell'elenco e si è sempre sicuri di mostrare i dati freschi.

### I computed — i dati calcolati

I `computed` non si scrivono: si **ricavano** da un signal e si ricalcolano da soli quando quello
cambia. Sono tre:

| Computed | Ricava | Serve a |
|---|---|---|
| `linee` | dai due elenchi → `{ id, x1, y1, x2, y2 }[]` | disegnare le linee del canvas |
| `dispositivoDettaglio` | da `dispositivi` + `idDettaglio` | mostrare i dati nella sidebar |
| `connessioniDettaglio` | da `connessioni` + `dispositivi` + `idDettaglio` | l'elenco "Collegamenti" della sidebar |

Il più interessante è `linee`. Non esiste da nessuna parte un posto dove sono memorizzate le
coordinate delle linee: si ricavano **ogni volta** dalle coordinate dei due dispositivi
collegati.

```ts
linee = computed(() => this.connessioni()
    .map(connessione => this.creaLinea(connessione))
    .filter((linea): linea is Linea => linea != null))
```

Ed è **questo** il motivo per cui le linee seguono i dispositivi mentre li trascini. Nessuno
ridisegna niente a mano: si sposta un dispositivo → cambia il signal `dispositivi` → il computed
`linee` capisce che dipende da quel signal → lo ricalcola → il canvas ridisegna. Tutto da solo.

### Perché tutto in un service solo

Perché i dati sono **condivisi** fra i tre componenti. Se lo stato stesse dentro il canvas, la
toolbar non potrebbe aggiungere dispositivi e la sidebar non saprebbe cosa mostrare. Mettendolo
in un service, ognuno prende quello che gli serve senza doverli passare come parametri.

## 4. Come si aggiorna lo stato — la regola d'oro

Questa è la regola più importante di tutta l'applicazione:

> **Non si modifica mai un oggetto esistente. Si crea sempre un oggetto nuovo.**

Sbagliato (e infatti non è mai fatto così):

```ts
dispositivo.x = varX          // ❌ modifica l'oggetto esistente
```

Giusto, come è scritto davvero nel service:

```ts
this.dispositivi.update(lista => lista.map(d => d.id == varId
    ? { ...d, x: varX, y: varY }    // ✅ crea una copia con i valori nuovi
    : d))
```

`update` prende l'elenco attuale e ne restituisce uno nuovo. `map` ricrea l'elenco e, per il
dispositivo da spostare, `{ ...d, x, y }` crea un **oggetto nuovo** con dentro tutti i valori
vecchi e solo `x` e `y` cambiati.

**Perché è obbligatorio farlo così:** i signals capiscono che qualcosa è cambiato confrontando
la **referenza** (cioè "è un oggetto diverso da prima?"), non confrontando i valori dentro. Se
si modificasse l'oggetto esistente, la referenza resterebbe la stessa, il signal non se ne
accorgerebbe e **i `computed` non si ricalcolerebbero**: le linee non seguirebbero più i
dispositivi. C'è un test apposta che verifica che dopo uno spostamento l'oggetto sia nuovo.

Lo stesso vale per aggiungere (`[...lista, nuovo]`) e per togliere (`lista.filter(...)`).

## 5. Come è disegnato il canvas

Il canvas è un rettangolo di **1200 × 700** pixel dentro un contenitore con lo scorrimento.
Dentro ci sono tre livelli, in quest'ordine nel DOM:

```text
┌─ .viewport (scorre se la finestra è stretta)
│  ┌─ .piano  (1200×700, position: relative)
│  │
│  │   1. <svg class="linee">          ← le linee, sotto a tutto
│  │      position:absolute  inset:0
│  │      z-index: 0    pointer-events: none
│  │
│  │   2. <p class="messaggio-vuoto">  ← "Il canvas è vuoto..." quando non c'è niente
│  │
│  │   3. <div class="dispositivo">    ← un div per dispositivo
│  │      position:absolute   z-index: 1
│  │      left/top da x e y   transform: translate(-50%, -50%)
```

Tre cose da sapere, tutte pensate per evitare problemi:

**Le linee stanno in un `<svg>` sovrapposto**, non dentro i dispositivi. Così una linea può
passare da qualsiasi parte senza essere tagliata dal bordo di un div.

**L'SVG ha `pointer-events: none`**, cioè "non riceve i click": i click passano attraverso e
arrivano ai dispositivi che stanno sopra. Senza questa riga l'SVG coprirebbe tutto il canvas e
non si potrebbe più cliccare niente.

**`x` e `y` sono il centro dell'icona**, non l'angolo in alto a sinistra. È il `transform:
translate(-50%, -50%)` che sposta il div di metà della sua larghezza e altezza. Il vantaggio è
enorme: gli estremi di una linea sono **esattamente** le coordinate dei due dispositivi, senza
dover calcolare niente sui bordi. La linea parte dal centro dell'uno e arriva al centro
dell'altro, e la parte sotto le icone resta coperta dal div del dispositivo (che ha sfondo
bianco ed è sopra all'SVG).

La griglia sullo sfondo non è un'immagine: sono due `linear-gradient` ripetuti ogni 40 px, uno
orizzontale e uno verticale.

## 6. Il drag & drop — la parte più delicata

Si usano **solo eventi pointer** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) e
**non** gli eventi HTML5 di drag&drop. Il motivo: gli eventi HTML5 scattano solo su certi
elementi e non danno le coordinate continue del movimento, quindi non vanno bene per spostare
qualcosa liberamente su un piano.

### Il problema da risolvere

Su un dispositivo si devono poter fare **due cose diverse**: trascinarlo (in modalità Modifica)
e cliccarlo (in modalità Collegamento). Come si fa a capire quale delle due sta facendo
l'utente? Il mouse produce un `click` **anche** alla fine di un trascinamento, quindi non si può
semplicemente ascoltare il click.

**La soluzione adottata:** non si ascolta mai l'evento `click`. La decisione si prende alla fine
del gesto, in `pointerup`, guardando **quanto si è spostato il puntatore**:

- si è spostato meno di **4 pixel** (`SOGLIA_TRASCINAMENTO`) → era un **click**;
- si è spostato di più → era un **trascinamento**, e il click non conta.

Così non c'è nessuna gara fra due eventi diversi: c'è un solo evento e una sola decisione.

### La sequenza, passo per passo

**`pointerdown`** — il dito/mouse si appoggia sul dispositivo:

1. `if (varEvento.button != 0) return` — se è il **tasto destro**, si esce subito: il destro
   serve ad aprire il dettaglio, non a trascinare;
2. `elemento.setPointerCapture?.(varEvento.pointerId)` — il "sequestro del puntatore": da questo
   momento tutti i movimenti arrivano a questo elemento **anche se il mouse esce dal
   dispositivo**. Serve a non far restare il trascinamento "incollato" quando si esce dal bordo.
   Il `?.` sulla chiamata è perché nei test (jsdom) quel metodo non esiste e altrimenti
   esploderebbero;
3. si segnano da parte l'id premuto, il punto di partenza (`partenzaX/Y`) e lo **scostamento**
   (`scostamentoX/Y`), cioè la distanza fra il puntatore e il centro del dispositivo;
4. **solo dopo**, se la modalità non è `edit`, si esce: così in modalità Collegamento il
   `pointerdown` registra comunque il punto di partenza, e al rilascio si potrà capire se è
   stato un click.

**`pointermove`** — il puntatore si muove:

```ts
this.service.spostaDispositivo(id, this.limita(x, this.larghezza), this.limita(y, this.altezza))
```

La nuova posizione è `clientX - bordo del piano - scostamento`, arrotondata. Si usa
`getBoundingClientRect()` **riletto ogni volta** (mai memorizzato) così le coordinate restano
giuste anche se la pagina scorre. `limita()` tiene il dispositivo dentro il canvas: non può
uscire, al massimo si ferma al bordo (a mezza icona di distanza, per non farlo tagliare).

**`pointerup`** — si rilascia:

1. `releasePointerCapture` — si restituisce il puntatore;
2. `this.idPremuto = null`;
3. se `distanza(puntatore, punto di partenza) < 4` → `service.cliccaDispositivo(id)`.

**`pointercancel`** — il gesto viene annullato dal sistema (per esempio arriva una telefonata su
mobile): si rilascia il puntatore e si azzera `idPremuto`, **senza** generare nessun click.

## 7. Le connessioni: la modalità Edit / Connect

Le due modalità esistono per non far mai indovinare all'applicazione cosa vuole fare l'utente:
in **Modifica** si trascina, in **Collegamento** si clicca. Il pulsante attivo nella toolbar lo
dice sempre.

```ts
cambiaModalita(varModalita) {
    if (this.modalita() == varModalita) return    // già in quella modalità: non fare niente
    this.modalita.set(varModalita)
    this.selezionato.set(null)                    // cambiando modalità la scelta si azzera
}
```

Il flusso del collegamento, in `cliccaDispositivo(id)` — che è l'**unico ingresso** del click su
un dispositivo:

```text
click su un dispositivo
        │
        ├─ modalità != connect → non fa niente (in modifica il click non conta)
        │
        ├─ selezionato == null       → selezionato = id        (primo capo)
        │                              e il dispositivo si evidenzia
        │
        ├─ selezionato == id         → selezionato = null      (cliccato due volte: annulla)
        │
        └─ selezionato != id         → creaConnessione(selezionato, id)
                                       e selezionato = null
```

E dentro `creaConnessione` ci sono i due **controlli minimi**:

```ts
if (varSorgente == varDestinazione) { alert("Un dispositivo non può essere collegato a sé stesso."); return }
if (this.collegati(varSorgente, varDestinazione)) { alert("Questi due dispositivi sono già collegati."); return }
```

`collegati()` controlla **in tutti e due i versi** (`A→B` e `B→A`): altrimenti si potrebbe creare
la stessa linea prima in un verso e poi nell'altro.

L'evidenziazione del selezionato si fa nel template con `[class.selezionato]="service.selezionato()
== dispositivo.id"`, e il CSS ingrandisce leggermente il dispositivo e gli mette un alone blu.

## 8. Il dettaglio — la sidebar

Si apre con il **tasto destro**:

```ts
apriDettaglio(varEvento: MouseEvent, varId: number): void {
    varEvento.preventDefault()      // toglie il menu del browser
    this.service.apriDettaglio(varId)
}
```

Il `preventDefault()` è indispensabile: senza, sopra il dispositivo comparirebbe anche il menu
contestuale di Chrome ("Salva immagine con nome…"), che coprirebbe la sidebar.

La sidebar si mostra solo se c'è un dispositivo aperto. Nel template è un `@if` che usa una
comodità di Angular, `as`:

```html
@if (service.dispositivoDettaglio(); as dispositivo) { ... }
```

Cioè: "se `dispositivoDettaglio()` non è nullo, chiamalo `dispositivo` e disegna il blocco". Da
quel punto dentro il blocco si scrive `dispositivo.nome`, `dispositivo.ip` e così via.

L'elenco **Collegamenti** non memorizza i nomi dei dispositivi collegati: li ricava con il
computed `connessioniDettaglio`, che per ogni connessione che tocca il dispositivo aperto cerca
**l'altro capo** e ne prende il nome:

```ts
connessioniDettaglio = computed(() => this.connessioni()
    .filter(connessione => this.tocca(connessione, this.idDettaglio()))
    .map(connessione => this.creaCollegamento(connessione, this.idDettaglio()))
    .filter((collegamento): collegamento is Collegamento => collegamento != null))
```

È una catena: prendi tutte le connessioni → tieni solo quelle che toccano questo dispositivo →
trasformale in `{ id, nome dell'altro capo }` → butta via quelle senza l'altro capo. I due
`filter` con `is` servono a TypeScript per sapere che dopo il filtro il `null` non c'è più.

## 9. Accendere e spegnere i dispositivi

Il pulsante **Attiva stato** è nel dettaglio. La particolarità è che **attivando un Router si
accendono anche tutti i dispositivi raggiungibili** attraverso i collegamenti, come se il router
portasse internet.

```ts
attivaStato(varId: number): void {
    const dispositivo = this.dispositivi().find(d => d.id == varId)
    if (!dispositivo) return

    const id = dispositivo.tipo == "Router"
        ? [varId, ...this.raggiungibili(varId)]     // il router e tutti quelli che raggiunge
        : [varId]                                   // per gli altri solo sé stesso

    this.dispositivi.update(lista => lista.map(d => id.includes(d.id)
        ? { ...d, stato: "Online" }
        : d))
}
```

`raggiungibili()` è l'algoritmo più "da esame" del progetto: una **visita in ampiezza** (BFS)
sul grafo dei collegamenti.

```ts
private raggiungibili(varId: number): number[] {
    const visitati: number[] = []
    const coda: number[] = [varId]                    // si parte dal router

    for (let i = 0; i < coda.length; i++) {           // la coda cresce mentre la si scorre
        for (const connessione of this.connessioni()) {
            const vicino = this.vicino(connessione, coda[i])

            if (vicino != null && vicino != varId && !visitati.includes(vicino)) {
                visitati.push(vicino)                 // segnato come raggiunto
                coda.push(vicino)                     // e da esplorare anche lui
            }
        }
    }

    return visitati
}
```

In parole povere: si parte dal router, si guardano tutti i suoi collegamenti e si segnano i
vicini; poi si guardano i collegamenti dei vicini, e così via finché non si trovano più
dispositivi nuovi. Il controllo `!visitati.includes(vicino)` evita di girare in tondo quando i
collegamenti formano un anello, e `vicino != varId` evita di riaccendere il router stesso.

**Disattiva stato**, invece, spegne **solo** il dispositivo scelto: è una scelta voluta, perché
"togliere internet al router" è una cosa diversa da "spegnere un PC".

## 10. Eliminare — la cascata

`eliminaDispositivo` fa tre cose, in quest'ordine:

1. chiede conferma con `confirm("Eliminare " + nome + " e i suoi collegamenti?")`; se l'utente
   dice no, **esce subito** (guard clause) e non è cambiato niente;
2. toglie il dispositivo dall'elenco **e** tutte le connessioni che lo toccano, in un verso o
   nell'altro:

```ts
this.dispositivi.update(lista => lista.filter(d => d.id != varId))
this.connessioni.update(lista => lista.filter(c => c.sourceId != varId && c.targetId != varId))
```

3. "pulisce" lo stato collegato: se la sidebar era aperta su quel dispositivo la chiude, e se
   era selezionato lo deseleziona. Senza questo passaggio la sidebar resterebbe aperta su un
   dispositivo che non esiste più (e c'è un test che lo verifica).

Se non si cancellassero anche le connessioni, resterebbero dei collegamenti che puntano a un id
inesistente: `creaLinea()` non troverebbe i due capi e restituirebbe `null` (la linea sparirebbe
dal disegno, ma resterebbe nei dati). È esattamente quello che il `filter` del computed `linee`
gestisce, ma è molto più pulito non crearle proprio.

`eliminaConnessione` è più semplice: controlla che esista, e la toglie dall'elenco.

## 11. Gli id

Gli id li assegna il frontend con questa regola:

```ts
private prossimoId(varIds: number[]): number {
    return Math.max(0, ...varIds) + 1
}
```

Cioè **il più alto esistente + 1**, non `length + 1`. La differenza conta dopo
un'eliminazione: con `length + 1`, cancellando il dispositivo 2 su 3 se ne creerebbe uno
nuovo con id 3 — che esiste già. Con `Math.max` questo non può succedere. Gli id non vengono
mai riusati.

I nomi invece sono progressivi per tipo: si guardano i nomi esistenti di quel tipo, si prende il
numero più alto e si aggiunge 1, formattato a due cifre (`PC-01`, `PC-02`…).

---

# Parte 2 — La persistenza

Il salvataggio ha **due strade indipendenti**, e la cosa notevole è che il canvas e la sidebar
non sanno nemmeno che esistono: chiamano il service, e il service decide dove andare.

```text
                          TopologiaService
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
      creaTopologia()                        creaTopologia()
              │                                     │
              ▼                                     ▼
    PersistenzaService                    TopologiaApiService
              │                                     │
              ▼                                     ▼
     localStorage del browser             HTTP  →  /api/topologie
       (Soluzione A)                            (Soluzione B)
```

## 12. Soluzione A — Local Storage

`PersistenzaService` è l'unico file che tocca `localStorage`. Tre metodi: `salva`, `carica`,
`cancella`, tutti avvolti in `try/catch`.

```ts
salva(varTopologia: Topologia): boolean {
    try {
        localStorage.setItem(CHIAVE_TOPOLOGIA, JSON.stringify(varTopologia))
        return true
    } catch {
        return false
    }
}
```

**Perché il `try/catch`:** `localStorage` può **lanciare un'eccezione** — se lo spazio è pieno
(circa 5 MB), in navigazione privata, o se i cookie sono bloccati. Senza il `try/catch`
l'applicazione si romperebbe; con il `try/catch` il metodo restituisce `false` e il service
mostra un messaggio all'utente.

**Perché `JSON.stringify`:** il Local Storage sa salvare **solo testo**. Quindi l'oggetto
JavaScript viene trasformato in una stringa JSON. Per rileggerlo si fa il contrario,
`JSON.parse`.

La chiave usata è `"topologia-rete"` (sta in `costanti.ts`). In DevTools → Application →
Local Storage si vede il JSON salvato.

`carica()` non si fida di quello che trova: dopo il `JSON.parse` controlla che sia davvero una
topologia (che `nome` sia testo e che `dispositivi` e `connessioni` siano due elenchi). Se non
lo è, restituisce `null`. Serve perché nello stesso Local Storage possono scrivere anche altre
pagine o versioni vecchie dell'app: senza il controllo, un dato scritto male farebbe esplodere
il canvas.

## 13. Soluzione B — l'API REST

`TopologiaApiService` è l'unico file che conosce l'indirizzo dell'API. Quattro metodi, e ognuno
fa una sola cosa:

| Metodo | Chiamata HTTP | Cosa torna |
|---|---|---|
| `elenco()` | `GET /api/topologie` | l'elenco delle topologie salvate (id, nome, data) |
| `apri(id)` | `GET /api/topologie/:id` | la topologia completa |
| `salva(topologia)` | `POST /api/topologie` | la topologia salvata **con gli id nuovi** |
| `elimina(id)` | `DELETE /api/topologie/:id` | niente |

`HttpClient` di Angular restituisce un `Observable`, ma nell'applicazione si usa `async/await`
(in fondo è più leggibile per chi arriva da JavaScript). Il ponte fra i due è
`firstValueFrom()`: prende il primo valore dell'Observable e lo trasforma in una Promise.

```ts
const risposta = await firstValueFrom(this.http.get<TopologiaSalvata[]>(this.indirizzo))
```

### Il proxy, e perché non c'è CORS

Nel frontend l'indirizzo è **relativo**: `"/api/topologie"`, non `"http://localhost:3000/..."`.
Quindi il browser chiama il **4200**, la stessa origine da cui ha caricato la pagina. Ci pensa
il dev server a girare la richiesta sul 3000:

```json
// proxy.conf.json
{ "/api": { "target": "http://localhost:3000", "changeOrigin": true, "secure": false } }
```

Vantaggio: **non c'è nessun problema di CORS**, perché per il browser è tutto sulla stessa
origine. E non c'è nessun indirizzo da cambiare fra sviluppo e produzione.

(Il backend ha comunque `cors()` attivo, così si può provare l'API da fuori con `curl`.)

### La toolbar è "smart"

`Strumenti` è l'unico componente che conosce l'API. Tiene quattro signals suoi, diversi da
quelli della topologia: `elencoServer`, `idScelto`, `serverAttivo`, `inCorso`.

Ogni operazione passa da un metodo unico, `esegui()`, che fa sempre le stesse tre cose:

```ts
private async esegui(varLavoro: () => Promise<void>): Promise<void> {
    this.inCorso.set(true)
    try {
        await varLavoro()
    } catch (errore) {
        alert(this.messaggioDi(errore))       // l'errore diventa un messaggio leggibile
    } finally {
        this.inCorso.set(false)               // succeda quel che succeda, si riabilita
    }
}
```

Il `finally` è importante: se il salvataggio fallisce, `inCorso` torna comunque `false` e i
pulsanti si riabilitano — altrimenti resterebbero bloccati per sempre.

E `messaggioDi()` traduce l'errore tecnico in qualcosa di comprensibile:

- se non è un errore HTTP → "Qualcosa non ha funzionato: …";
- se `status == 0` → "Server non raggiungibile: avvia docker compose up -d in esame_backend."
  (`status == 0` è il modo in cui il browser segnala che **non è riuscito nemmeno a
  connettersi**: il server è spento);
- altrimenti usa il messaggio che ha mandato l'API (`errore.error?.errore`).

### Il punto delicato: gli id cambiano

Questo è il passaggio da sapere spiegare bene, perché è l'insidia vera della Soluzione B.

Il frontend assegna gli id da solo (0, 1, 2, 3…), ma nel database la colonna è
`AUTO_INCREMENT`: è **il database** a decidere gli id. Quindi dopo un `POST` gli id dei
dispositivi salvati sono diversi da quelli che aveva il frontend, e di conseguenza anche i
riferimenti dentro le connessioni (`sourceId`, `targetId`) non valgono più.

**Come è risolto, dal lato server:**

1. l'API inserisce i dispositivi uno per uno e, per ognuno, si segna in una `Map` la coppia
   *vecchio id → nuovo id*;
2. quando inserisce le connessioni, traduce `sourceId` e `targetId` usando quella mappa;
3. infine **restituisce la topologia salvata**, con gli id definitivi.

**Come è risolto, dal lato frontend:** quando il `POST` risponde, il frontend non butta via
niente e non ricarica niente: **riapplica la topologia che gli è tornata indietro**.

```ts
const salvata = await this.api.salva(this.service.creaTopologia())
this.service.applicaTopologia(salvata)     // il canvas si rimpiazza con gli id nuovi
this.idScelto.set(salvata.id)              // e la tendina si sposta su quella appena salvata
```

Risultato: **sullo schermo non cambia assolutamente niente** (stessi dispositivi, stesse
posizioni, stesse linee) ma dentro lo stato ora ci sono gli id del database. È il motivo per cui
si può salvare due volte di seguito senza duplicare nulla.

---

# Parte 3 — Il backend

## 14. Il database

Tre tabelle, in MySQL 8.4:

```text
topologie     id, nome, creata_il
     │
     ├── dispositivi    id, topologia_id → topologie.id,
     │                  tipo ENUM('PC','Switch','Router'), nome, x, y, ip, hostname,
     │                  stato ENUM('Online','Offline','Manutenzione')
     │
     └── connessioni    id, topologia_id → topologie.id,
                        sorgente_id → dispositivi.id,
                        destinazione_id → dispositivi.id
```

Il campo `topologia_id` è quello che lega ogni riga alla sua topologia: è la **relazione uno a
molti**, cioè una topologia ha molti dispositivi e molte connessioni. Nella tabella
`connessioni` ci sono **due** chiavi esterne verso `dispositivi`, perché una connessione ha due
capi.

Tutte le chiavi esterne hanno `ON DELETE CASCADE`, che significa: "se sparisce la riga
puntata, cancella anche questa". Quindi:

- cancellando una topologia, il database cancella da solo i suoi dispositivi e le sue
  connessioni;
- cancellando un dispositivo, spariscono da sole le connessioni che lo toccano (anche quelle
  in cui è la destinazione).

È **la stessa cascata** che fa il frontend nei signals: è bello poter dire che le due parti si
comportano allo stesso modo.

Le colonne sono in italiano (`sorgente_id`) tranne `sourceId`/`targetId` nella risposta
dell'API: la traduzione sta solo nell'API, così il frontend usa lo stesso modello dati della
consegna e del Local Storage.

## 15. L'API

Express 5, quattro file:

| File | Compito |
|---|---|
| `src/index.js` | monta l'app: `cors()`, `express.json()`, `/api/health`, il router, la gestione errori |
| `src/db.js` | crea il **pool** di connessioni a MySQL |
| `src/routes/topologie.js` | i 5 endpoint, la validazione e le transazioni |
| `db/init.sql` | crea le tabelle e i dati di esempio |

**Il pool di connessioni** (`mysql.createPool`): invece di aprire e chiudere una connessione a
ogni richiesta (lento), se ne tengono fino a 10 aperte e si riusano. Il database ringrazia.

**La transazione.** Salvare una topologia sono **una** `INSERT` per la topologia, **N** per i
dispositivi e **M** per le connessioni. Sono tante operazioni: se una fallisce a metà si
resterebbe con una topologia incompleta nel database. La soluzione è la transazione:

```ts
async function inTransazione(varLavoro) {
    const connessione = await pool.getConnection()
    try {
        await connessione.beginTransaction()
        const esito = await varLavoro(connessione)
        await connessione.commit()          // tutto ok: si scrive davvero
        return esito
    } catch (errore) {
        await connessione.rollback()        // qualcosa è andato storto: si annulla tutto
        throw errore
    } finally {
        connessione.release()               // la connessione torna al pool
    }
}
```

`commit` = "conferma tutto", `rollback` = "annulla tutto come se non avessi fatto niente".
Così o si salva la topologia intera, o non si salva niente: mai una via di mezzo.

**La validazione** (`validaCorpo`) controlla il corpo della richiesta **prima** di toccare il
database: il nome c'è, gli elenchi sono elenchi, gli id sono numeri interi e diversi fra loro,
`tipo` e `stato` sono fra i valori ammessi (`TIPI` e `STATI`), le coordinate sono numeri
interi, nessun dispositivo collegato a sé stesso, nessun collegamento verso un dispositivo che
non c'è. Se qualcosa non torna risponde `400` con il motivo. Meglio un errore chiaro subito che
una riga strana nel database.

**La gestione degli errori.** Express 5 manda da solo le eccezioni al middleware finale, quello
con quattro parametri `(errore, req, res, next)`, che risponde `500` con `{errore, dettaglio}`.
Nelle versioni precedenti di Express bisognava scrivere il `try/catch` a mano in ogni rotta.

**Lo `healthcheck`.** Nel `docker-compose.yml` l'API ha `depends_on: db: condition:
service_healthy`: non parte finché MySQL non risponde davvero al suo `mysqladmin ping`. Senza,
al primo avvio l'API partirebbe prima del database e fallirebbe la connessione. Anche l'API ha
un suo `healthcheck` su `/api/health`, che è quello che fa apparire `(healthy)` in
`docker compose ps`.

## 16. Il frontend dentro il container

Il frontend ha un suo `Dockerfile`, fatto in **due fasi** (multi-stage build). È una tecnica che
vale la pena saper spiegare, perché risolve un problema concreto: per **compilare** Angular
servono Node e centinaia di megabyte di librerie, ma per **servire** l'applicazione compilata
servono solo dei file statici.

```dockerfile
# FASE 1 — si compila (qui dentro c'e' Node e tutto node_modules)
FROM node:24-alpine AS compilazione
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# FASE 2 — si serve (qui dentro c'e' solo nginx e i file compilati)
FROM nginx:alpine
COPY --from=compilazione /app/dist/esame_angular/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

La seconda fase **parte da zero**: prende solo la cartella dei file compilati dalla prima fase e
se la copia dentro. Tutto il resto — Node, i sorgenti TypeScript, `node_modules` — resta fuori.
L'immagine finale è di poche decine di megabyte invece che di centinaia, e non contiene né il
codice sorgente né gli strumenti di compilazione. È anche una questione di sicurezza: meno roba
c'è dentro, meno cose possono essere sfruttate.

**Il vantaggio pratico di mettere prima `package.json` e poi il codice:** Docker costruisce
l'immagine a strati e riusa gli strati che non sono cambiati. Se si copiassero prima i sorgenti
e poi si lanciasse `npm ci`, **ogni** modifica a una riga di codice farebbe reinstallare tutte
le librerie. Copiando prima solo i due file delle dipendenze, quel passaggio viene riusato e la
ricompilazione è molto più veloce.

### nginx e il proxy

```nginx
location / {
    try_files $uri $uri/ /index.html;      # qualunque indirizzo → index.html
}

location /api/ {
    proxy_pass http://api:3000;            # /api/... → il container dell'API
}
```

La prima regola serve perché l'applicazione è una *single page application*: esiste un solo
`index.html` vero, e gli indirizzi interni li gestisce JavaScript. Il `try_files` dice a nginx:
"se il file richiesto non esiste, servi `index.html` invece di dare un errore 404".

La seconda regola è **la stessa cosa che fa il dev server con `proxy.conf.json`**, ma in
produzione. E c'è una simmetria che vale la pena far notare: dentro la rete di docker compose
ogni servizio chiama gli altri **per nome**, non per indirizzo.

```text
   browser
      │  http://localhost:8080          (una sola origine: niente CORS)
      ▼
   nginx (frontend)  ──proxy_pass──►  http://api:3000
                                          │
                                          ▼
                                       api  ──DB_HOST=db──►  http://db:3306
```

Il nome `api` non è un indirizzo internet: è il **nome del servizio** nel `docker-compose.yml`,
che Docker trasforma automaticamente nell'indirizzo IP del container. Per questo non c'è
nessun indirizzo IP scritto da nessuna parte, e non c'è niente da cambiare se i container
vengono ricreati.

### La catena di avvio

```yaml
api:
  depends_on:
    db: { condition: service_healthy }      # l'API parte dopo il database

frontend:
  depends_on:
    api: { condition: service_healthy }     # il frontend parte dopo l'API
```

Il risultato è che `docker compose up -d` avvia i tre servizi **nell'ordine giusto**, senza che
nessuno debba aspettare a mano. È il motivo per cui un solo comando basta: la dipendenza è
scritta nel file, non nella testa di chi lo lancia.

---

# Parte 4 — I test

**101 test in 7 file**, con Vitest. Non testano l'aspetto grafico: testano la **logica**.

| File | Test | Cosa verificano |
|---|---:|---|
| `topologia-service.spec.ts` | 43 | il cuore: id univoci, spostamenti, connessioni, duplicati, dettaglio, accensione a cascata del router, eliminazioni, salvataggio/caricamento |
| `canvas.spec.ts` | 17 | il drag: il dispositivo segue il puntatore, non esce dal canvas, le linee si aggiornano, **il click non scatta dopo un trascinamento**, il tasto destro |
| `dettaglio.spec.ts` | 12 | i campi mostrati, i pulsanti, l'elenco dei collegamenti, le eliminazioni dalla sidebar |
| `strumenti.spec.ts` | 11 | i pulsanti, l'elenco dal server, gli errori del server, la scelta dopo il salvataggio |
| `persistenza-service.spec.ts` | 10 | salvataggio, rilettura, JSON rotto, storage che rifiuta di scrivere |
| `topologia-api-service.spec.ts` | 6 | le chiamate HTTP giuste, con `HttpTestingController` (nessuna richiesta vera) |
| `app.spec.ts` | 2 | che l'applicazione si monti |

Due cose che vale la pena raccontare:

**Il test delle linee che seguono il dispositivo** è anche il test della mutazione immutabile:
verifica che dopo uno spostamento l'oggetto del dispositivo sia **una referenza nuova**, e che
il computed `linee` sia cambiato.

**I test delle chiamate HTTP non usano il server vero.** Usano `HttpTestingController`, che
intercetta le richieste: il test dice "adesso rispondi questo" e verifica che l'applicazione
reagisca bene, anche agli errori (per esempio un `404`).

**Come si eseguono:** `npx ng test --watch=false`.

---

# Parte 5 — Domande probabili

Le domande che è più facile che arrivino, con la risposta breve.

**Perché hai usato i signals invece delle variabili normali?**
Perché quando un dato cambia, tutto quello che lo usa si aggiorna da solo. Le linee del canvas
non hanno bisogno di nessuno che le ridisegni: dipendono dai signals dei dispositivi e delle
connessioni, e si ricalcolano quando quelli cambiano.

**Che differenza c'è fra signals e computed?**
Il signal è un dato che si scrive (`.set()`, `.update()`). Il computed è un dato che si
**ricava** da altri signals e non si può scrivere: si ricalcola da solo. `dispositivi` è un
signal, `linee` è un computed.

**Perché lo stato sta in un service e non nel componente?**
Perché serve a tre componenti diversi. Mettendolo in un service, tutti e tre lo condividono e
nessuno deve passare dati agli altri.

**Perché avete usato gli eventi pointer e non il drag&drop di HTML5?**
Perché gli eventi HTML5 non danno le coordinate continue del movimento e scattano solo su certi
elementi. Con i pointer event si ha `pointermove` con la posizione esatta, e funziona anche su
touch e penna.

**Come fate a distinguere un click da un trascinamento?**
Non ascoltiamo mai il `click`. In `pointerup` misuriamo quanto si è spostato il puntatore: meno
di 4 pixel era un click, di più era un trascinamento.

**A che serve `setPointerCapture`?**
A fare in modo che i movimenti continuino ad arrivare al dispositivo anche se il puntatore esce
dai suoi bordi. Senza, il trascinamento si "incollerebbe" uscendo dall'elemento.

**Perché non modificate mai gli oggetti esistenti?**
Perché i signals confrontano le **referenze** per capire se qualcosa è cambiato. Se modificassi
l'oggetto esistente la referenza resterebbe uguale, il signal non se ne accorgerebbe e i
computed non si ricalcolerebbero.

**Perché `x` e `y` sono il centro e non l'angolo?**
Perché così gli estremi di una linea sono esattamente le coordinate dei due dispositivi e non
serve nessun calcolo sui bordi. Il `transform: translate(-50%, -50%)` sposta il div di metà
della sua dimensione.

**A che serve `pointer-events: none` sull'SVG delle linee?**
A far passare i click attraverso. L'SVG copre tutto il canvas: senza quella regola intercetterebbe
i click e i dispositivi sotto non si potrebbero più cliccare.

**Perché il tasto destro non fa partire un trascinamento?**
Perché in `pointerdown` c'è `if (varEvento.button != 0) return`. Il tasto destro serve ad aprire
il dettaglio.

**Come fa il router ad accendere gli altri dispositivi?**
Con una visita in ampiezza sui collegamenti: si parte dal router, si guardano i suoi vicini, poi
i vicini dei vicini, finché non se ne trovano più. Il controllo sui già visitati evita di girare
in tondo se i collegamenti formano un anello.

**Perché eliminando un dispositivo spariscono anche le sue linee?**
Perché nel service, quando si elimina, si filtrano anche le connessioni che lo toccano in
entrambi i versi. Nel database la stessa cosa è garantita da `ON DELETE CASCADE`.

**Perché il Local Storage sta in un service separato?**
Perché è l'unico punto che lo tocca. Quando è stato aggiunto il salvataggio sul server, il
canvas e la sidebar non hanno dovuto cambiare niente: è bastato un secondo service.

**Perché `JSON.stringify` per salvare?**
Perché il Local Storage accetta solo testo: l'oggetto va trasformato in stringa, e per rileggerlo
si usa `JSON.parse`.

**Perché c'è il `try/catch` intorno al Local Storage?**
Perché `localStorage` può lanciare un'eccezione se è pieno o se i cookie sono bloccati. Senza,
l'applicazione si romperebbe.

**Perché `Math.max` e non `length + 1` per i nuovi id?**
Perché dopo un'eliminazione `length + 1` darebbe un id già esistente. Con `Math.max(...ids) + 1`
non succede mai, e c'è un test apposta.

**Perché il frontend chiama `/api/topologie` e non `localhost:3000`?**
Perché è un indirizzo relativo: la richiesta va alla stessa origine della pagina, quindi non ci
sono problemi di CORS. Ci pensa il proxy del dev server a girarla sulla porta 3000.

**Che cosa sono `commit` e `rollback`?**
Sono la fine di una transazione. `commit` conferma tutte le operazioni fatte, `rollback` le
annulla tutte come se non fossero mai avvenute. Servono perché salvare una topologia sono tante
`INSERT` diverse: o vanno a buon fine tutte, o nessuna.

**Perché gli id dei dispositivi cambiano quando si salva sul server?**
Perché nel database la colonna è `AUTO_INCREMENT` e gli id li decide il database. Il server
tiene una mappa *vecchio id → nuovo id* e la usa per riscrivere i collegamenti, poi restituisce
la topologia salvata e il frontend la riapplica: sullo schermo non cambia niente.

**Perché l'API parte solo quando il database è pronto?**
Perché nel `docker-compose.yml` c'è `depends_on: db: condition: service_healthy`, che aspetta
che MySQL risponda al `mysqladmin ping`. Senza, al primo avvio l'API proverebbe a connettersi a
un database non ancora pronto e fallirebbe.

**Il frontend funziona senza il backend?**
Sì. È una delle cose da dire: le due soluzioni di persistenza sono indipendenti. Senza backend
si usano i pulsanti Salva/Carica/Cancella (Local Storage) e la riga Server avvisa che il server
non è raggiungibile.

**Perché avete messo anche il frontend in Docker?**
Perché così **un solo comando** avvia tutto il progetto, e perché l'applicazione compilata ha
bisogno di un web server che le giri le chiamate all'API. In sviluppo lo fa il dev server di
Angular, in produzione lo fa nginx. Sono due configurazioni diverse (`proxy.conf.json` e
`nginx.conf`) per lo stesso codice compilato.

**Cos'è una multi-stage build?**
Un `Dockerfile` con più `FROM`. La prima fase compila il progetto con tutti gli strumenti
necessari, la seconda copia **solo il risultato** dentro un'immagine piccola. Così l'immagine
finale non contiene Node, i sorgenti né le librerie di sviluppo.

**Perché nel `Dockerfile` copiate prima `package.json` e poi il resto?**
Perché Docker mette in cache gli strati: se le dipendenze non cambiano, `npm ci` non viene
rieseguito e la ricompilazione è molto più veloce.

**Chi fa da proxy verso l'API?**
Dipende da dove gira il frontend: in sviluppo il dev server di Angular (`proxy.conf.json`),
nel container nginx (`nginx.conf`). In tutti e due i casi il browser vede **una sola origine**,
quindi non c'è nessun problema di CORS e non c'è nessun indirizzo assoluto nel codice.

**Come fa nginx a sapere dov'è l'API?**
Dal nome del servizio: `http://api:3000`. Dentro la rete di docker compose i container si
chiamano per nome, ed è Docker a tradurlo nell'indirizzo giusto. È la stessa cosa che fa l'API
con `DB_HOST=db`.

**Perché il frontend nel container non vede le modifiche al codice?**
Perché è compilato una volta sola, quando si costruisce l'immagine. Per sviluppare si usa
`ng serve`, che ricompila a ogni salvataggio.
