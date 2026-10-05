// Una linea da disegnare sull'SVG del canvas: gli estremi sono le coordinate dei
// due dispositivi collegati. Non si salva da nessuna parte, si calcola dalle connessioni.

export type Linea = {
    id: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
}
