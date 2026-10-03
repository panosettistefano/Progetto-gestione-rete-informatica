import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VERSIONE_TOPOLOGIA } from '../costanti';
import { Topologia } from '../types/topologia';
import { TopologiaApiService } from './topologia-api-service';

describe('TopologiaApiService', () => {
  let service: TopologiaApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TopologiaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function topologiaLocale(): Topologia {
    return {
      nome: "Rete laboratorio",
      versione: VERSIONE_TOPOLOGIA,
      dispositivi: [
        { id: 1, tipo: "Router", nome: "Router-01", x: 600, y: 120, ip: "192.168.1.101", hostname: "router-01", stato: "Online" },
        { id: 2, tipo: "Switch", nome: "Switch-01", x: 600, y: 340, ip: "192.168.1.102", hostname: "switch-01", stato: "Offline" }
      ],
      connessioni: [{ id: 1, sourceId: 1, targetId: 2 }]
    };
  }

  function rispostaServer(): object {
    return {
      id: 4,
      nome: "Rete laboratorio",
      creata_il: "2026-09-25T15:37:27.000Z",
      dispositivi: [
        { id: 10, tipo: "Router", nome: "Router-01", x: 600, y: 120, ip: "192.168.1.101", hostname: "router-01", stato: "Online" },
        { id: 11, tipo: "Switch", nome: "Switch-01", x: 600, y: 340, ip: "192.168.1.102", hostname: "switch-01", stato: "Offline" }
      ],
      connessioni: [{ id: 7, sourceId: 10, targetId: 11 }]
    };
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should read the list of the saved topologies', async () => {
    const promessa = service.elenco();

    http.expectOne('/api/topologie').flush([
      { id: 4, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" }
    ]);

    await expect(promessa).resolves.toEqual([
      { id: 4, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" }
    ]);
  });

  it('should open a topology from the server', async () => {
    const promessa = service.apri(4);

    const richiesta = http.expectOne('/api/topologie/4');

    expect(richiesta.request.method).toBe("GET");

    richiesta.flush(rispostaServer());

    const topologia = await promessa;

    expect(topologia.nome).toBe("Rete laboratorio");
    expect(topologia.versione).toBe(VERSIONE_TOPOLOGIA);
    expect(topologia.dispositivi.map(d => d.id)).toEqual([10, 11]);
    expect(topologia.connessioni).toEqual([{ id: 7, sourceId: 10, targetId: 11 }]);
  });

  it('should send the topology without the version', async () => {
    const promessa = service.salva(topologiaLocale());

    const richiesta = http.expectOne('/api/topologie');

    expect(richiesta.request.method).toBe("POST");
    expect(richiesta.request.body.versione).toBeUndefined();
    expect(richiesta.request.body.nome).toBe("Rete laboratorio");
    expect(richiesta.request.body.dispositivi.length).toBe(2);
    expect(richiesta.request.body.connessioni.length).toBe(1);

    richiesta.flush(rispostaServer());

    const salvata = await promessa;

    expect(salvata.id).toBe(4);
    expect(salvata.dispositivi.map(d => d.id)).toEqual([10, 11]);
  });

  it('should delete a topology', async () => {
    const promessa = service.elimina(4);

    const richiesta = http.expectOne('/api/topologie/4');

    expect(richiesta.request.method).toBe("DELETE");

    richiesta.flush({ eliminata: 4 });

    await expect(promessa).resolves.toBeUndefined();
  });

  it('should report the error of the server', async () => {
    const promessa = service.apri(99);

    http.expectOne('/api/topologie/99').flush({ errore: "Topologia 99 non trovata." }, { status: 404, statusText: "Not Found" });

    await expect(promessa).rejects.toBeTruthy();
  });
});
