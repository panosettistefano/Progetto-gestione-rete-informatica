import { Component, inject } from '@angular/core';
import { Canvas } from './components/canvas/canvas';
import { Dettaglio } from './components/dettaglio/dettaglio';
import { Strumenti } from './components/strumenti/strumenti';
import { TopologiaService } from './services/topologia-service';

// Il componente principale: monta la barra in alto e i tre pezzi dell'applicazione
// (toolbar, canvas e sidebar). Non ha logica: il service gli serve solo per sapere
// se la sidebar è aperta e stringere il contenuto per farle posto.

@Component({
  imports: [Strumenti, Canvas, Dettaglio],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {

  service = inject(TopologiaService);

}
