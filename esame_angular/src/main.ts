import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Il punto di partenza: avvia l'applicazione Angular con il suo componente
// principale e la sua configurazione.
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
