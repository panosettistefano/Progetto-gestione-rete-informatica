import { Service } from '@angular/core';
import { CHIAVE_TOPOLOGIA } from '../costanti';
import { Topologia } from '../types/topologia';

// L'unico punto dell'applicazione che tocca il Local Storage del browser.
// Sta da solo in un service proprio perché, quando è arrivato il salvataggio sul
// server, canvas e sidebar non hanno dovuto cambiare niente.

@Service()
export class PersistenzaService {

    // Scrive la topologia nel Local Storage come testo JSON. Torna false se il
    // browser rifiuta di scrivere (spazio pieno, navigazione privata, cookie bloccati).
    salva(varTopologia: Topologia): boolean {
        try {
            localStorage.setItem(CHIAVE_TOPOLOGIA, JSON.stringify(varTopologia))

            return true
        } catch {
            return false
        }
    }

    // Rilegge la topologia salvata. Torna null se non c'è niente, se il testo è
    // rovinato o se quello che c'è dentro non è una topologia.
    carica(): Topologia | null {
        try {
            const salvata = localStorage.getItem(CHIAVE_TOPOLOGIA)

            if (!salvata) {
                return null
            }

            const topologia = JSON.parse(salvata) as Topologia

            if (!topologia || typeof topologia.nome != "string"
                || !Array.isArray(topologia.dispositivi)
                || !Array.isArray(topologia.connessioni)) {
                return null
            }

            return topologia
        } catch {
            return null
        }
    }

    // Cancella la topologia salvata. Torna false se il browser non lascia toccare lo storage.
    cancella(): boolean {
        try {
            localStorage.removeItem(CHIAVE_TOPOLOGIA)

            return true
        } catch {
            return false
        }
    }

}
