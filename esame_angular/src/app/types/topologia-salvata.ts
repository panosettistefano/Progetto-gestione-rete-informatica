// Una riga dell'elenco delle topologie sul server: solo l'intestazione, senza
// dispositivi e connessioni. I dispositivi si chiedono solo quando si apre una topologia.

export type TopologiaSalvata = {
    id: number,
    nome: string,
    creata_il: string
}
