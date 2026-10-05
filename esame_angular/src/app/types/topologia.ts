import { Connessione } from './connessione';
import { Dispositivo } from './dispositivo';

// Il documento che viene salvato e caricato: è l'unico formato che viaggia,
// sia verso il Local Storage sia verso l'API.
export type Topologia = {
    nome: string,
    versione: number,
    dispositivi: Dispositivo[],
    connessioni: Connessione[]
}

// La stessa topologia, ma con l'id che le ha assegnato il server: serve alla toolbar
// per sapere quale voce dell'elenco selezionare dopo un salvataggio.
export type TopologiaConId = Topologia & { id: number }
