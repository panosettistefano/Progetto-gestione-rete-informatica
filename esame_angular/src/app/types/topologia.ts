import { Connessione } from './connessione';
import { Dispositivo } from './dispositivo';

export type Topologia = {
    nome: string,
    versione: number,
    dispositivi: Dispositivo[],
    connessioni: Connessione[]
}

export type TopologiaConId = Topologia & { id: number }
