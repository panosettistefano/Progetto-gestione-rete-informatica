import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERSIONE_TOPOLOGIA } from '../costanti';
import { Connessione } from '../types/connessione';
import { Dispositivo } from '../types/dispositivo';
import { Topologia, TopologiaConId } from '../types/topologia';
import { TopologiaSalvata } from '../types/topologia-salvata';

// L'unico punto dell'applicazione che conosce l'indirizzo dell'API. Fa da traduttore:
// il database tiene le colonne in italiano e le rinomina, così il resto del frontend
// continua a usare lo stesso modello dati del Local Storage.

type RispostaApi = {
    id: number,
    nome: string,
    creata_il: string,
    dispositivi: Dispositivo[],
    connessioni: Connessione[]
}

@Service()
export class TopologiaApiService {

    private http = inject(HttpClient)

    // Indirizzo relativo: la richiesta va alla stessa origine della pagina e ci pensa
    // il proxy (in sviluppo) o nginx (nel container) a girarla all'API. Così non ci
    // sono problemi di CORS e non c'è nessun indirizzo da cambiare fra i due ambienti.
    private indirizzo = "/api/topologie"

    // Chiede al server l'elenco delle topologie salvate: solo nome, id e data.
    async elenco(): Promise<TopologiaSalvata[]> {
        return firstValueFrom(this.http.get<TopologiaSalvata[]>(this.indirizzo))
    }

    // Scarica una topologia completa dal server e la converte nel formato del frontend.
    async apri(varId: number): Promise<Topologia> {
        const risposta = await firstValueFrom(this.http.get<RispostaApi>(this.indirizzo + "/" + varId))

        return this.creaTopologia(risposta)
    }

    // Manda la topologia al server per salvarla. Torna anche l'id appena assegnato,
    // che serve alla toolbar per selezionare la voce nuova.
    async salva(varTopologia: Topologia): Promise<TopologiaConId> {
        const risposta = await firstValueFrom(this.http.post<RispostaApi>(this.indirizzo, {
            nome: varTopologia.nome,
            dispositivi: varTopologia.dispositivi,
            connessioni: varTopologia.connessioni
        }))

        return { ...this.creaTopologia(risposta), id: risposta.id }
    }

    // Elimina una topologia dal server: il database cancella da solo i suoi
    // dispositivi e i suoi collegamenti, perché le chiavi esterne sono in cascata.
    async elimina(varId: number): Promise<void> {
        await firstValueFrom(this.http.delete(this.indirizzo + "/" + varId))
    }

    // Converte la risposta dell'API nel tipo Topologia, aggiungendo la versione del formato.
    private creaTopologia(varRisposta: RispostaApi): Topologia {
        return {
            nome: varRisposta.nome,
            versione: VERSIONE_TOPOLOGIA,
            dispositivi: varRisposta.dispositivi,
            connessioni: varRisposta.connessioni
        }
    }

}
