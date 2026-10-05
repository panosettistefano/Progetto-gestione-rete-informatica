import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// La configurazione dell'applicazione: cosa Angular deve predisporre all'avvio.
// provideHttpClient() è quello che permette di chiamare l'API REST.
// Il router c'è ma le rotte sono vuote: l'applicazione è tutta in una pagina sola.

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient()
  ]
};
