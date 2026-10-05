import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { TopologiaApiService } from '../../services/topologia-api-service';
import { TopologiaService } from '../../services/topologia-service';
import { TopologiaSalvata } from '../../types/topologia-salvata';

// La toolbar: aggiunge i dispositivi, cambia modalità e gestisce il salvataggio,
// sia in locale sia sul server. È l'unico componente che parla con l'API.

@Component({
  imports: [DatePipe],
  selector: 'app-strumenti',
  styleUrl: './strumenti.css',
  templateUrl: './strumenti.html',
})
export class Strumenti implements OnInit {

  service = inject(TopologiaService);
  api = inject(TopologiaApiService);

  // Le topologie che stanno sul server, così come le ha elencate l'API.
  elencoServer = signal<TopologiaSalvata[]>([]);

  // L'id della topologia selezionata nella tendina: è quella che si apre o si elimina.
  idScelto = signal<number | null>(null);

  // true se il server ha risposto, false se non si è riusciti a contattarlo,
  // null finché non si è provato: serve a decidere cosa scrivere sotto la tendina.
  serverAttivo = signal<boolean | null>(null);

  // true mentre una richiesta al server è in corso: disabilita i pulsanti per non
  // far partire due operazioni insieme.
  inCorso = signal(false);

  // All'apertura si chiede subito al server l'elenco delle topologie salvate.
  async ngOnInit(): Promise<void> {
    await this.aggiornaElenco();
  }

  // Salva la topologia sul server e riprende quella che torna indietro: il canvas
  // resta identico, ma gli id diventano quelli del database.
  async salvaSulServer(): Promise<void> {
    await this.esegui(async () => {
      const salvata = await this.api.salva(this.service.creaTopologia());

      this.service.applicaTopologia(salvata);
      this.idScelto.set(salvata.id);
      await this.aggiornaElenco();

      alert("Topologia salvata sul server.");
    });
  }

  // Apre dal server la topologia scelta nella tendina e la mette sul canvas.
  async apriDalServer(): Promise<void> {
    const id = this.idScelto();

    if (id == null) {
      return;
    }

    await this.esegui(async () => {
      this.service.applicaTopologia(await this.api.apri(id));

      alert("Topologia aperta dal server.");
    });
  }

  // Elimina dal server la topologia scelta, dopo conferma, e aggiorna l'elenco.
  async eliminaDalServer(): Promise<void> {
    const id = this.idScelto();

    if (id == null) {
      return;
    }

    if (!confirm("Eliminare questa topologia dal server? Non si può annullare.")) {
      return;
    }

    await this.esegui(async () => {
      await this.api.elimina(id);
      await this.aggiornaElenco();

      alert("Topologia eliminata dal server.");
    });
  }

  // Rinomina la topologia corrente leggendo quello che c'è scritto nel campo.
  cambiaNome(varEvento: Event): void {
    this.service.cambiaNome((varEvento.target as HTMLInputElement).value);
  }

  // Registra quale topologia è stata scelta nella tendina.
  scegli(varEvento: Event): void {
    const scelta = (varEvento.target as HTMLSelectElement).value;

    this.idScelto.set(scelta == "" ? null : Number(scelta));
  }

  // Rilegge dal server l'elenco delle topologie. Se il server non risponde lo segnala,
  // senza far esplodere l'applicazione.
  private async aggiornaElenco(): Promise<void> {
    try {
      this.elencoServer.set(await this.api.elenco());
      this.serverAttivo.set(true);
      this.controllaScelta();
    } catch {
      this.serverAttivo.set(false);
    }
  }

  // Fa in modo che la tendina punti sempre a qualcosa che esiste davvero: se la
  // topologia scelta non c'è più, si passa all'ultima dell'elenco.
  private controllaScelta(): void {
    const elenco = this.elencoServer();

    if (elenco.some(salvata => salvata.id == this.idScelto())) {
      return;
    }

    this.idScelto.set(elenco.length == 0 ? null : elenco[elenco.length - 1].id);
  }

  // Fa girare un'operazione sul server con le stesse attenzioni ogni volta:
  // accende "inCorso" mentre lavora, e qualunque cosa succeda lo rispegne.
  private async esegui(varLavoro: () => Promise<void>): Promise<void> {
    this.inCorso.set(true);

    try {
      await varLavoro();
    } catch (errore) {
      alert(this.messaggioDi(errore));
    } finally {
      this.inCorso.set(false);
    }
  }

  // Traduce l'errore tecnico in una frase che si capisce. Lo stato 0 vuol dire che
  // il browser non è nemmeno riuscito a connettersi: il server è spento.
  private messaggioDi(varErrore: unknown): string {
    if (!(varErrore instanceof HttpErrorResponse)) {
      return "Qualcosa non ha funzionato: " + varErrore;
    }

    if (varErrore.status == 0) {
      return "Server non raggiungibile: avvia docker compose up -d in esame_backend.";
    }

    return varErrore.error?.errore ?? "Errore del server (" + varErrore.status + ").";
  }

}
