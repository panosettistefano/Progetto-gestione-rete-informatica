// I modelli di un dispositivo della rete.

// I tre tipi di dispositivo che si possono aggiungere al canvas.
export type TipoDispositivo = "PC" | "Switch" | "Router"

// Lo stato di un dispositivo: se è acceso e collegato alla rete oppure no.
export type StatoDispositivo = "Online" | "Offline" | "Manutenzione"

// Un dispositivo sul canvas.
// x e y sono il CENTRO dell'icona, non l'angolo: è il CSS che lo sposta di metà
// della sua dimensione, così gli estremi delle linee sono esattamente queste coordinate.
export type Dispositivo = {
    id: number,
    tipo: TipoDispositivo,
    nome: string,
    x: number,
    y: number,
    ip: string,
    hostname: string,
    stato: StatoDispositivo
}
