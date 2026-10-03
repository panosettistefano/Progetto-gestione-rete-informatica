import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { TopologiaApiService } from '../../services/topologia-api-service';
import { TopologiaService } from '../../services/topologia-service';
import { TopologiaSalvata } from '../../types/topologia-salvata';

@Component({
  imports: [DatePipe],
  selector: 'app-strumenti',
  styleUrl: './strumenti.css',
  templateUrl: './strumenti.html',
})
export class Strumenti implements OnInit {

  service = inject(TopologiaService);
  api = inject(TopologiaApiService);

  elencoServer = signal<TopologiaSalvata[]>([]);
  idScelto = signal<number | null>(null);
  serverAttivo = signal<boolean | null>(null);
  inCorso = signal(false);

  async ngOnInit(): Promise<void> {
    await this.aggiornaElenco();
  }

  async salvaSulServer(): Promise<void> {
    await this.esegui(async () => {
      const salvata = await this.api.salva(this.service.creaTopologia());

      this.service.applicaTopologia(salvata);
      this.idScelto.set(salvata.id);
      await this.aggiornaElenco();

      alert("Topologia salvata sul server.");
    });
  }

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

  scegli(varEvento: Event): void {
    const scelta = (varEvento.target as HTMLSelectElement).value;

    this.idScelto.set(scelta == "" ? null : Number(scelta));
  }

  private async aggiornaElenco(): Promise<void> {
    try {
      this.elencoServer.set(await this.api.elenco());
      this.serverAttivo.set(true);
      this.controllaScelta();
    } catch {
      this.serverAttivo.set(false);
    }
  }

  private controllaScelta(): void {
    const elenco = this.elencoServer();

    if (elenco.some(salvata => salvata.id == this.idScelto())) {
      return;
    }

    this.idScelto.set(elenco.length == 0 ? null : elenco[elenco.length - 1].id);
  }

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
