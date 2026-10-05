import { Component, inject } from '@angular/core';
import {
  ALTEZZA_CANVAS,
  DIMENSIONE_DISPOSITIVO,
  LARGHEZZA_CANVAS,
  SOGLIA_TRASCINAMENTO,
} from '../../costanti';
import { TopologiaService } from '../../services/topologia-service';
import { TipoDispositivo } from '../../types/dispositivo';

// Il canvas: disegna i dispositivi e le linee, e gestisce il mouse.
// Non tiene nessun dato della topologia: chiede tutto al service e gli rimanda
// le azioni (sposta, clicca, apri il dettaglio). Le uniche variabili sue sono
// quelle del gesto in corso, che servono solo a lui.

@Component({
  imports: [],
  selector: 'app-canvas',
  styleUrl: './canvas.css',
  templateUrl: './canvas.html',
})
export class Canvas {

  service = inject(TopologiaService);

  larghezza = LARGHEZZA_CANVAS;

  altezza = ALTEZZA_CANVAS;

  dimensione = DIMENSIONE_DISPOSITIVO;

  // --- stato del gesto in corso, non della topologia ---

  // L'id del dispositivo su cui è stato premuto il mouse e che non è ancora stato rilasciato.
  idPremuto: number | null = null;

  // Dove stava il puntatore quando è stato premuto: serve a capire, al rilascio,
  // se il gesto è stato un click o un trascinamento.
  partenzaX = 0;

  partenzaY = 0;

  // La distanza fra il puntatore e il centro del dispositivo quando è stato preso:
  // senza, il dispositivo "salterebbe" sotto il puntatore al primo movimento.
  scostamentoX = 0;

  scostamentoY = 0;

  // Restituisce la classe CSS che dà al dispositivo il colore del suo tipo.
  classeDispositivo(varTipo: TipoDispositivo): string {
    if (varTipo == "PC") {
      return "dispositivo-pc";
    }
    if (varTipo == "Switch") {
      return "dispositivo-switch";
    }
    return "dispositivo-router";
  }

  // Restituisce l'icona Bootstrap Icons da mostrare per quel tipo.
  iconaDispositivo(varTipo: TipoDispositivo): string {
    if (varTipo == "PC") {
      return "bi-pc-display";
    }
    if (varTipo == "Switch") {
      return "bi-hdd-network";
    }
    return "bi-router";
  }

  // Il mouse si appoggia su un dispositivo: si annota dove e su quale, e ci si
  // "impossessa" del puntatore per continuare a ricevere i movimenti anche uscendo.
  iniziaTrascinamento(varEvento: PointerEvent, varId: number): void {
    const elemento = varEvento.currentTarget as HTMLElement;
    const dispositivo = this.service.dispositivi().find(d => d.id == varId);

    // il tasto destro non trascina: serve ad aprire il dettaglio
    if (varEvento.button != 0 || !dispositivo || !elemento.parentElement) {
      return;
    }

    elemento.setPointerCapture?.(varEvento.pointerId);

    this.idPremuto = varId;
    this.partenzaX = varEvento.clientX;
    this.partenzaY = varEvento.clientY;

    // in modalità collegamento non si trascina, ma il punto di partenza serve
    // comunque per capire al rilascio se è stato un click
    if (this.service.modalita() != "edit") {
      return;
    }

    const piano = elemento.parentElement.getBoundingClientRect();

    this.scostamentoX = varEvento.clientX - piano.left - dispositivo.x;
    this.scostamentoY = varEvento.clientY - piano.top - dispositivo.y;
  }

  // Il mouse si muove con il tasto premuto: si aggiorna la posizione del dispositivo,
  // limitandola dentro il canvas. Le coordinate del piano si rileggono ogni volta,
  // così restano giuste anche se la pagina scorre.
  trascina(varEvento: PointerEvent): void {
    const id = this.idPremuto;
    const elemento = varEvento.currentTarget as HTMLElement;

    if (id == null || !elemento.parentElement || this.service.modalita() != "edit") {
      return;
    }

    const piano = elemento.parentElement.getBoundingClientRect();
    const x = Math.round(varEvento.clientX - piano.left - this.scostamentoX);
    const y = Math.round(varEvento.clientY - piano.top - this.scostamentoY);

    this.service.spostaDispositivo(id, this.limita(x, this.larghezza), this.limita(y, this.altezza));
  }

  // Il mouse viene rilasciato: se il puntatore si è spostato meno di pochi pixel è
  // stato un click, altrimenti era un trascinamento. Non si ascolta mai l'evento
  // "click" proprio per non avere due eventi in gara fra loro.
  finisciTrascinamento(varEvento: PointerEvent): void {
    const elemento = varEvento.currentTarget as HTMLElement;
    const id = this.idPremuto;

    if (id == null) {
      return;
    }

    elemento.releasePointerCapture?.(varEvento.pointerId);

    this.idPremuto = null;

    if (this.distanza(varEvento) < SOGLIA_TRASCINAMENTO) {
      this.service.cliccaDispositivo(id);
    }
  }

  // Il gesto viene annullato dal sistema (per esempio arriva una chiamata su mobile):
  // si molla tutto senza generare nessun click.
  annullaTrascinamento(varEvento: PointerEvent): void {
    const elemento = varEvento.currentTarget as HTMLElement;

    elemento.releasePointerCapture?.(varEvento.pointerId);

    this.idPremuto = null;
  }

  // Click con il tasto destro su un dispositivo: apre la sidebar di dettaglio.
  // Il preventDefault serve a non far comparire il menu del browser sopra la sidebar.
  apriDettaglio(varEvento: MouseEvent, varId: number): void {
    varEvento.preventDefault();

    this.service.apriDettaglio(varId);
  }

  // Quanto si è spostato il puntatore da quando è stato premuto.
  private distanza(varEvento: PointerEvent): number {
    return Math.hypot(varEvento.clientX - this.partenzaX, varEvento.clientY - this.partenzaY);
  }

  // Tiene un valore dentro il canvas, lasciando mezza icona di margine per non
  // farla uscire o tagliare dal bordo.
  private limita(varValore: number, varMassimo: number): number {
    const meta = this.dimensione / 2;

    if (varValore < meta) {
      return meta;
    }
    if (varValore > varMassimo - meta) {
      return varMassimo - meta;
    }
    return varValore;
  }

}
