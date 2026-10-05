import { Component, inject } from '@angular/core';
import { TopologiaService } from '../../services/topologia-service';
import { StatoDispositivo } from '../../types/dispositivo';

// La sidebar di dettaglio, quella che si apre con il click destro su un dispositivo.
// Mostra i dati del dispositivo e i suoi collegamenti, e da qui si accende il router
// o si eliminano dispositivi e collegamenti.

@Component({
  imports: [],
  selector: 'app-dettaglio',
  styleUrl: './dettaglio.css',
  templateUrl: './dettaglio.html',
})
export class Dettaglio {

  service = inject(TopologiaService);

  // Restituisce la classe CSS che colora la pastiglia dello stato: verde se il
  // dispositivo è raggiungibile, rosso se è spento, ambra se è in manutenzione.
  classeStato(varStato: StatoDispositivo): string {
    if (varStato == "Online") {
      return "pastiglia--online";
    }
    if (varStato == "Offline") {
      return "pastiglia--offline";
    }
    return "pastiglia--manutenzione";
  }

}
