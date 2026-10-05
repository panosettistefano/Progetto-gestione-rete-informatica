// I numeri fissi dell'applicazione: stanno tutti qui invece che sparsi nel codice.

// Larghezza e altezza del piano di lavoro su cui si trascinano i dispositivi, in pixel.
export const LARGHEZZA_CANVAS = 1200
export const ALTEZZA_CANVAS = 700

// Il lato della scatola che rappresenta un dispositivo sul canvas, in pixel.
export const DIMENSIONE_DISPOSITIVO = 72

// Sotto questa distanza (in pixel) un gesto del mouse è un click, sopra è un trascinamento.
export const SOGLIA_TRASCINAMENTO = 4

// La chiave con cui la topologia viene salvata nel Local Storage del browser.
export const CHIAVE_TOPOLOGIA = "topologia-rete"

// La versione del formato salvato: serve a riconoscere i file scritti da versioni diverse.
export const VERSIONE_TOPOLOGIA = 1
