import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERSIONE_TOPOLOGIA } from '../costanti';
import { Connessione } from '../types/connessione';
import { Dispositivo } from '../types/dispositivo';
import { Topologia } from '../types/topologia';
import { TopologiaSalvata } from '../types/topologia-salvata';

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

    private indirizzo = "/api/topologie"

    async elenco(): Promise<TopologiaSalvata[]> {
        return firstValueFrom(this.http.get<TopologiaSalvata[]>(this.indirizzo))
    }

    async apri(varId: number): Promise<Topologia> {
        const risposta = await firstValueFrom(this.http.get<RispostaApi>(this.indirizzo + "/" + varId))

        return this.creaTopologia(risposta)
    }

    async salva(varTopologia: Topologia): Promise<Topologia> {
        const risposta = await firstValueFrom(this.http.post<RispostaApi>(this.indirizzo, {
            nome: varTopologia.nome,
            dispositivi: varTopologia.dispositivi,
            connessioni: varTopologia.connessioni
        }))

        return this.creaTopologia(risposta)
    }

    async elimina(varId: number): Promise<void> {
        await firstValueFrom(this.http.delete(this.indirizzo + "/" + varId))
    }

    private creaTopologia(varRisposta: RispostaApi): Topologia {
        return {
            nome: varRisposta.nome,
            versione: VERSIONE_TOPOLOGIA,
            dispositivi: varRisposta.dispositivi,
            connessioni: varRisposta.connessioni
        }
    }

}
