import { Service, computed, inject, signal } from '@angular/core';
import { ALTEZZA_CANVAS, LARGHEZZA_CANVAS, VERSIONE_TOPOLOGIA } from '../costanti';
import { Collegamento } from '../types/collegamento'
import { Connessione } from '../types/connessione';
import { Dispositivo, StatoDispositivo, TipoDispositivo } from '../types/dispositivo';
import { Linea } from '../types/linea';
import { Topologia } from '../types/topologia';
import { PersistenzaService } from './persistenza-service';

// Il cuore dell'applicazione: tiene lo stato della topologia e tutta la logica che
// lo fa cambiare. I tre componenti (toolbar, canvas, dettaglio) non si parlano fra
// loro: leggono gli stessi signals e chiamano i metodi di questo service.

@Service()
export class TopologiaService {

    persistenza = inject(PersistenzaService)

    // Il nome della topologia (per ora fisso: si cambia solo dal codice).
    nome = signal("Rete laboratorio")

    // I dispositivi sul canvas e i collegamenti fra loro: sono i due elenchi principali.
    dispositivi = signal<Dispositivo[]>([])

    connessioni = signal<Connessione[]>([])

    // Se si sta modificando (si trascina) o collegando (si clicca per unire due dispositivi).
    modalita = signal<"edit" | "connect">("edit")

    // L'id del dispositivo scelto come primo capo di un collegamento, in attesa del secondo.
    selezionato = signal<number | null>(null)

    // L'id del dispositivo di cui è aperta la sidebar di dettaglio.
    idDettaglio = signal<number | null>(null)

    // Gli id dei router accesi: l'interruttore ce l'hanno solo loro, perché sono la
    // porta verso internet. Da qui si ricava lo stato di tutti gli altri dispositivi.
    routerAccesi = signal<number[]>([])

    // Le linee da disegnare sull'SVG: si ricavano dai due elenchi, quindi si
    // aggiornano da sole quando un dispositivo viene spostato.
    linee = computed(() => this.connessioni()
        .map(connessione => this.creaLinea(connessione))
        .filter((linea): linea is Linea => linea != null))

    // Il dispositivo di cui mostrare i dati nella sidebar.
    dispositivoDettaglio = computed(() => this.dispositivi()
        .find(d => d.id == this.idDettaglio()) ?? null)

    // L'elenco "Collegamenti" della sidebar: per ogni connessione che tocca il
    // dispositivo aperto, il nome di quello che sta all'altro capo.
    connessioniDettaglio = computed(() => this.connessioni()
        .filter(connessione => this.tocca(connessione, this.idDettaglio()))
        .map(connessione => this.creaCollegamento(connessione, this.idDettaglio()))
        .filter((collegamento): collegamento is Collegamento => collegamento != null))

    // Trasforma una connessione nelle coordinate della linea da disegnare.
    // Torna null se uno dei due dispositivi non esiste più.
    creaLinea(varConnessione: Connessione): Linea | null {
        const sorgente = this.dispositivi().find(d => d.id == varConnessione.sourceId)
        const destinazione = this.dispositivi().find(d => d.id == varConnessione.targetId)

        if(!sorgente || !destinazione){
            return null
        }

        return {
            id: varConnessione.id,
            x1: sorgente.x,
            y1: sorgente.y,
            x2: destinazione.x,
            y2: destinazione.y
        }
    }

    // Trova il nome del dispositivo che sta all'altro capo di una connessione.
    creaCollegamento(varConnessione: Connessione, varId: number | null): Collegamento | null {
        if (varId == null) {
            return null
        }

        const altro = this.dispositivi().find(d => d.id == (varConnessione.sourceId == varId
            ? varConnessione.targetId
            : varConnessione.sourceId))

        if (!altro) {
            return null
        }

        return { id: varConnessione.id, nome: altro.nome }
    }

    // Sposta un dispositivo alle coordinate indicate. Crea un oggetto nuovo invece di
    // modificare quello esistente, altrimenti i computed non si accorgerebbero del cambiamento.
    spostaDispositivo(varId: number, varX: number, varY: number): void {
        const dispositivo = this.dispositivi().find(d => d.id == varId)

        if(!dispositivo || (dispositivo.x == varX && dispositivo.y == varY)){
            return
        }

        this.dispositivi.update(lista => lista.map(d => d.id == varId
            ? { ...d, x: varX, y: varY }
            : d))
    }

    // Aggiunge un dispositivo del tipo richiesto: id nuovo, nome progressivo, ip e
    // hostname automatici, nel primo posto libero del canvas. Nasce spento.
    aggiungiDispositivo(varTipo: TipoDispositivo): void {
        const id = this.prossimoId(this.dispositivi().map(d => d.id))
        const numero = this.prossimoNumero(varTipo)
        const posizione = this.posizioneLibera()

        this.dispositivi.update(lista => [
            ...lista,
            {
                id: id,
                tipo: varTipo,
                nome: varTipo + "-" + this.dueCifre(numero),
                x: posizione.x,
                y: posizione.y,
                ip: "192.168.1." + (100 + id),
                hostname: varTipo.toLowerCase() + "-" + this.dueCifre(numero),
                stato: "Offline"
            }
        ])
    }

    // Passa da modifica a collegamento o viceversa, azzerando la scelta in sospeso.
    cambiaModalita(varModalita: "edit" | "connect"): void {
        if (this.modalita() == varModalita) {
            return
        }

        this.modalita.set(varModalita)
        this.selezionato.set(null)
    }

    // Un click su un dispositivo: in modalità collegamento il primo sceglie la
    // sorgente, il secondo crea il collegamento, un doppio click annulla la scelta.
    cliccaDispositivo(varId: number): void {
        if (this.modalita() != "connect") {
            return
        }

        const sorgente = this.selezionato()

        if (sorgente == null) {
            this.selezionato.set(varId)
            return
        }

        if (sorgente == varId) {
            this.selezionato.set(null)
            return
        }

        this.creaConnessione(sorgente, varId)
        this.selezionato.set(null)
    }

    // Collega due dispositivi, dopo aver controllato che non siano lo stesso e che
    // non siano già collegati. Poi ricalcola gli stati, perché la rete è cambiata.
    creaConnessione(varSorgente: number, varDestinazione: number): void {
        if (varSorgente == varDestinazione) {
            alert("Un dispositivo non può essere collegato a sé stesso.")
            return
        }

        if (this.collegati(varSorgente, varDestinazione)) {
            alert("Questi due dispositivi sono già collegati.")
            return
        }

        const id = this.prossimoId(this.connessioni().map(c => c.id))

        this.connessioni.update(lista => [
            ...lista,
            {
                id: id,
                sourceId: varSorgente,
                targetId: varDestinazione
            }
        ])

        this.ricalcolaStati()
    }

    // Apre la sidebar di dettaglio su un dispositivo.
    apriDettaglio(varId: number): void {
        this.idDettaglio.set(varId)
    }

    // Chiude la sidebar di dettaglio.
    chiudiDettaglio(): void {
        this.idDettaglio.set(null)
    }

    // Accende un router: è la porta verso internet. Solo i router hanno questo
    // interruttore, e accendendolo si accende tutto quello che raggiungono.
    attivaStato(varId: number): void {
        const dispositivo = this.dispositivi().find(d => d.id == varId)

        if (!dispositivo || dispositivo.tipo != "Router" || this.routerAccesi().includes(varId)) {
            return
        }

        this.routerAccesi.update(lista => [...lista, varId])
        this.ricalcolaStati()
    }

    // Spegne un router: si spegne tutta la rete che stava dietro di lui.
    disattivaStato(varId: number): void {
        const dispositivo = this.dispositivi().find(d => d.id == varId)

        if (!dispositivo || dispositivo.tipo != "Router") {
            return
        }

        this.routerAccesi.update(lista => lista.filter(id => id != varId))
        this.ricalcolaStati()
    }

    // Riscrive lo stato di ogni dispositivo in base a chi è raggiungibile da un router
    // acceso. Va chiamato dopo OGNI modifica della topologia, non solo quando si preme
    // l'interruttore: altrimenti un dispositivo scollegato resterebbe acceso.
    private ricalcolaStati(): void {
        const accesi = this.dispositiviAccesi()

        if (!this.dispositivi().some(d => this.statoDi(d, accesi) != d.stato)) {
            return
        }

        this.dispositivi.update(lista => lista.map(d => {
            const stato = this.statoDi(d, accesi)

            return d.stato == stato
                ? d
                : { ...d, stato: stato }
        }))
    }

    // Lo stato che un dispositivo dovrebbe avere: acceso se è fra quelli raggiungibili.
    private statoDi(varDispositivo: Dispositivo, varAccesi: number[]): StatoDispositivo {
        return varAccesi.includes(varDispositivo.id)
            ? "Online"
            : "Offline"
    }

    // Tutti i dispositivi accesi: i router accesi più tutto quello che ognuno raggiunge.
    private dispositiviAccesi(): number[] {
        const accesi: number[] = []

        for (const id of this.routerAccesi()) {
            if (!accesi.includes(id)) {
                accesi.push(id)
            }

            for (const vicino of this.raggiungibili(id)) {
                if (!accesi.includes(vicino)) {
                    accesi.push(vicino)
                }
            }
        }

        return accesi
    }

    // Attraverso uno switch o un PC il segnale passa sempre; attraverso un router
    // passa solo se è acceso, perché un router spento non porta niente a nessuno.
    private attraversabile(varId: number): boolean {
        const dispositivo = this.dispositivi().find(d => d.id == varId)

        if (!dispositivo) {
            return false
        }

        return dispositivo.tipo != "Router" || this.routerAccesi().includes(varId)
    }

    // Elimina un dispositivo dopo conferma, insieme a tutti i suoi collegamenti, e
    // sistema quello che resta: dettaglio chiuso, scelta azzerata, stati ricalcolati.
    eliminaDispositivo(varId: number): void {
        const dispositivo = this.dispositivi().find(d => d.id == varId)

        if (!dispositivo) {
            return
        }

        if (!confirm("Eliminare " + dispositivo.nome + " e i suoi collegamenti?")) {
            return
        }

        this.dispositivi.update(lista => lista.filter(d => d.id != varId))
        this.connessioni.update(lista => lista.filter(c => c.sourceId != varId && c.targetId != varId))
        this.routerAccesi.update(lista => lista.filter(id => id != varId))

        if (this.idDettaglio() == varId) {
            this.chiudiDettaglio()
        }

        if (this.selezionato() == varId) {
            this.selezionato.set(null)
        }

        this.ricalcolaStati()
    }

    // Elimina un singolo collegamento: chi resta scollegato si spegne.
    eliminaConnessione(varId: number): void {
        const connessione = this.connessioni().find(c => c.id == varId)

        if (!connessione) {
            return
        }

        this.connessioni.update(lista => lista.filter(c => c.id != varId))

        this.ricalcolaStati()
    }

    // Salva la topologia nel Local Storage e avvisa dell'esito.
    salvaTopologia(): void {
        if (this.persistenza.salva(this.creaTopologia())) {
            alert("Topologia salvata.")
            return
        }

        alert("Non è stato possibile salvare: lo spazio del browser non è disponibile.")
    }

    // Riprende la topologia salvata nel Local Storage e la mette sul canvas.
    caricaTopologia(): void {
        const topologia = this.persistenza.carica()

        if (!topologia) {
            alert("Non c'è nessuna topologia salvata da caricare.")
            return
        }

        this.applicaTopologia(topologia)
        alert("Topologia caricata.")
    }

    // Cancella la topologia salvata e svuota il canvas, dopo conferma.
    cancellaTopologia(): void {
        if (!confirm("Cancellare la topologia salvata e svuotare il canvas?")) {
            return
        }

        this.persistenza.cancella()
        this.applicaTopologia(this.topologiaVuota())
        alert("Topologia cancellata.")
    }

    // Cambia il nome della topologia: è quello che si vede nell'elenco sul server.
    cambiaNome(varNome: string): void {
        this.nome.set(varNome)
    }

    // Mette insieme lo stato attuale in un documento pronto da salvare o da spedire all'API.
    creaTopologia(): Topologia {
        return {
            nome: this.nome(),
            versione: VERSIONE_TOPOLOGIA,
            dispositivi: this.dispositivi(),
            connessioni: this.connessioni()
        }
    }

    // Una topologia vuota, con lo stesso nome: serve a svuotare il canvas.
    private topologiaVuota(): Topologia {
        return {
            nome: this.nome(),
            versione: VERSIONE_TOPOLOGIA,
            dispositivi: [],
            connessioni: []
        }
    }

    // Mette sul canvas una topologia arrivata da fuori (dal Local Storage o dall'API)
    // e ricostruisce la rete: i router che erano accesi tornano accesi.
    applicaTopologia(varTopologia: Topologia): void {
        this.nome.set(varTopologia.nome)
        this.dispositivi.set(varTopologia.dispositivi)
        this.connessioni.set(varTopologia.connessioni)
        this.selezionato.set(null)
        this.chiudiDettaglio()

        // i router accesi non si salvano a parte: si ricavano dagli stati salvati
        this.routerAccesi.set(varTopologia.dispositivi
            .filter(d => d.tipo == "Router" && d.stato == "Online")
            .map(d => d.id))

        this.ricalcolaStati()
    }

    // Dice se una connessione tocca un certo dispositivo (da un capo o dall'altro).
    private tocca(varConnessione: Connessione, varId: number | null): boolean {
        return varId != null && (varConnessione.sourceId == varId || varConnessione.targetId == varId)
    }

    // Visita in ampiezza dei collegamenti: tutti i dispositivi raggiungibili partendo
    // da uno, senza passare due volte dallo stesso e senza attraversare router spenti.
    private raggiungibili(varId: number): number[] {
        const visitati: number[] = []
        const coda: number[] = [varId]

        for (let i = 0; i < coda.length; i++) {
            for (const connessione of this.connessioni()) {
                const vicino = this.vicino(connessione, coda[i])

                if (vicino != null && vicino != varId && !visitati.includes(vicino)
                    && this.attraversabile(vicino)) {
                    visitati.push(vicino)
                    coda.push(vicino)
                }
            }
        }

        return visitati
    }

    // Dato un capo di una connessione, restituisce l'id dell'altro capo (o null).
    private vicino(varConnessione: Connessione, varId: number): number | null {
        if (varConnessione.sourceId == varId) {
            return varConnessione.targetId
        }
        if (varConnessione.targetId == varId) {
            return varConnessione.sourceId
        }

        return null
    }

    // Dice se due dispositivi sono già collegati, in un verso o nell'altro.
    private collegati(varSorgente: number, varDestinazione: number): boolean {
        return this.connessioni().some(c =>
            (c.sourceId == varSorgente && c.targetId == varDestinazione)
            || (c.sourceId == varDestinazione && c.targetId == varSorgente))
    }

    // Il prossimo id libero: il più alto esistente più uno, così gli id non si riusano mai.
    private prossimoId(varIds: number[]): number {
        return Math.max(0, ...varIds) + 1
    }

    // Il prossimo numero progressivo per quel tipo di dispositivo (PC-03 dopo PC-02).
    private prossimoNumero(varTipo: TipoDispositivo): number {
        const numeri = this.dispositivi()
            .filter(d => d.tipo == varTipo)
            .map(d => parseInt(d.nome.replace(varTipo + "-", "")))
            .filter(n => !isNaN(n))

        return Math.max(0, ...numeri) + 1
    }

    // Cerca un posticino libero sul canvas, procedendo a scacchiera per non
    // sovrapporre il dispositivo nuovo a quelli già presenti.
    private posizioneLibera(): { x: number, y: number } {
        const passo = 100
        let x = passo
        let y = passo

        while (y < ALTEZZA_CANVAS - passo && this.dispositivi()
            .some(d => Math.abs(d.x - x) < passo && Math.abs(d.y - y) < passo)) {
            x = x + passo

            if (x > LARGHEZZA_CANVAS - passo) {
                x = passo
                y = y + passo
            }
        }

        return { x: x, y: y }
    }

    // Trasforma un numero in due cifre: 3 diventa "03".
    private dueCifre(varNumero: number): string {
        return varNumero.toString().padStart(2, "0")
    }

}
