import { TestBed } from '@angular/core/testing';
import { CHIAVE_TOPOLOGIA, VERSIONE_TOPOLOGIA } from '../costanti';
import { Dispositivo, TipoDispositivo } from '../types/dispositivo';
import { Topologia } from '../types/topologia';
import { TopologiaService } from './topologia-service';

describe('TopologiaService', () => {
  let service: TopologiaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TopologiaService);
    localStorage.clear();
  });

  function dispositivo(varId: number, varTipo: TipoDispositivo, varNome: string, varX: number, varY: number): Dispositivo {
    return {
      id: varId,
      tipo: varTipo,
      nome: varNome,
      x: varX,
      y: varY,
      ip: "192.168.1." + varId,
      hostname: varNome.toLowerCase(),
      stato: "Online"
    };
  }

  function popola(): void {
    service.dispositivi.set([
      dispositivo(1, "Router", "Router-01", 600, 120),
      dispositivo(2, "Switch", "Switch-01", 600, 340),
      dispositivo(3, "PC", "PC-01", 360, 560),
      dispositivo(4, "PC", "PC-02", 840, 560)
    ]);

    service.connessioni.set([
      { id: 1, sourceId: 1, targetId: 2 },
      { id: 2, sourceId: 2, targetId: 3 },
      { id: 3, sourceId: 2, targetId: 4 }
    ]);
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty canvas', () => {
    expect(service.dispositivi().length).toBe(0);
    expect(service.connessioni().length).toBe(0);
    expect(service.linee().length).toBe(0);
  });

  it('should build one line for each connection', () => {
    popola();

    const linee = service.linee();

    expect(linee.length).toBe(3);
    expect(linee[0]).toEqual({ id: 1, x1: 600, y1: 120, x2: 600, y2: 340 });
  });

  it('should not build a line when a device is missing', () => {
    popola();

    service.dispositivi.set(service.dispositivi().filter(d => d.id != 2));

    expect(service.linee().length).toBe(0);
  });

  it('should move a device creating a new object', () => {
    popola();

    const prima = service.dispositivi()[0];

    service.spostaDispositivo(1, 100, 200);

    const dopo = service.dispositivi()[0];

    expect(dopo.x).toBe(100);
    expect(dopo.y).toBe(200);
    expect(dopo).not.toBe(prima);
    expect(prima.x).toBe(600);
  });

  it('should not touch the list when the position does not change', () => {
    popola();

    const prima = service.dispositivi();

    service.spostaDispositivo(1, 600, 120);

    expect(service.dispositivi()).toBe(prima);
  });

  it('should update the lines when a device moves', () => {
    popola();

    service.spostaDispositivo(1, 300, 100);

    const linea = service.linee().find(l => l.id == 1);

    expect(linea?.x1).toBe(300);
    expect(linea?.y1).toBe(100);
  });

  it('should add a device with a new id and a progressive name', () => {
    service.aggiungiDispositivo("PC");
    service.aggiungiDispositivo("PC");

    const primo = service.dispositivi()[0];
    const secondo = service.dispositivi()[1];

    expect(service.dispositivi().length).toBe(2);
    expect(primo.id).toBe(1);
    expect(primo.nome).toBe("PC-01");
    expect(primo.hostname).toBe("pc-01");
    expect(primo.ip).toBe("192.168.1.101");
    expect(primo.stato).toBe("Offline");
    expect(secondo.id).toBe(2);
    expect(secondo.nome).toBe("PC-02");
  });

  it('should keep ids unique after a device is removed', () => {
    popola();

    service.dispositivi.set(service.dispositivi().filter(d => d.id != 4));

    service.aggiungiDispositivo("PC");

    const id = service.dispositivi().map(d => d.id);

    expect(id).toEqual([1, 2, 3, 4]);
  });

  it('should not overlap the new device with the existing ones', () => {
    popola();

    service.aggiungiDispositivo("Switch");

    const nuovo = service.dispositivi()[4];
    const sovrapposti = service.dispositivi()
      .filter(d => d.id != nuovo.id)
      .filter(d => Math.abs(d.x - nuovo.x) < 72 && Math.abs(d.y - nuovo.y) < 72);

    expect(sovrapposti.length).toBe(0);
  });

  it('should change mode and clear the selection', () => {
    service.selezionato.set(1);

    service.cambiaModalita("connect");

    expect(service.modalita()).toBe("connect");
    expect(service.selezionato()).toBeNull();
  });

  it('should ignore the click on a device in edit mode', () => {
    popola();

    service.cliccaDispositivo(1);

    expect(service.selezionato()).toBeNull();
    expect(service.connessioni().length).toBe(3);
  });

  it('should select a device with the first click in connect mode', () => {
    popola();

    service.cambiaModalita("connect");

    service.cliccaDispositivo(1);

    expect(service.selezionato()).toBe(1);
    expect(service.connessioni().length).toBe(3);
  });

  it('should deselect the device clicked twice', () => {
    popola();

    service.cambiaModalita("connect");

    service.cliccaDispositivo(1);
    service.cliccaDispositivo(1);

    expect(service.selezionato()).toBeNull();
    expect(service.connessioni().length).toBe(3);
  });

  it('should create the connection with the second click on another device', () => {
    popola();

    service.cambiaModalita("connect");

    service.cliccaDispositivo(1);
    service.cliccaDispositivo(4);

    const nuova = service.connessioni()[3];

    expect(service.connessioni().length).toBe(4);
    expect(nuova).toEqual({ id: 4, sourceId: 1, targetId: 4 });
    expect(service.linee().length).toBe(4);
    expect(service.selezionato()).toBeNull();
  });

  it('should not connect a device to itself', () => {
    popola();

    const avviso = vi.spyOn(window, "alert").mockImplementation(() => {});

    service.creaConnessione(1, 1);

    expect(service.connessioni().length).toBe(3);
    expect(avviso).toHaveBeenCalled();
  });

  it('should not duplicate a connection in both directions', () => {
    popola();

    const avviso = vi.spyOn(window, "alert").mockImplementation(() => {});

    service.creaConnessione(2, 1);

    expect(service.connessioni().length).toBe(3);
    expect(avviso).toHaveBeenCalled();
  });

  it('should have no detail device when nothing is open', () => {
    expect(service.idDettaglio()).toBeNull();
    expect(service.dispositivoDettaglio()).toBeNull();
  });

  it('should open the detail of a device', () => {
    popola();

    service.apriDettaglio(2);

    expect(service.idDettaglio()).toBe(2);
    expect(service.dispositivoDettaglio()?.nome).toBe("Switch-01");
  });

  it('should close the detail', () => {
    popola();

    service.apriDettaglio(2);
    service.chiudiDettaglio();

    expect(service.idDettaglio()).toBeNull();
    expect(service.dispositivoDettaglio()).toBeNull();
  });

  it('should not show a device that is no longer there', () => {
    popola();

    service.apriDettaglio(2);
    service.dispositivi.set(service.dispositivi().filter(d => d.id != 2));

    expect(service.dispositivoDettaglio()).toBeNull();
  });

  it('should switch on the whole network and switch it off again', () => {
    popola();

    service.attivaStato(1);

    expect(service.dispositivi().every(d => d.stato == "Online")).toBe(true);

    service.disattivaStato(1);

    expect(service.dispositivi().every(d => d.stato == "Offline")).toBe(true);
  });

  it('should not let a switch or a PC switch itself on', () => {
    popola();

    service.disattivaStato(1);

    service.attivaStato(2);
    service.attivaStato(3);

    expect(service.dispositivi().every(d => d.stato == "Offline")).toBe(true);
  });

  it('should switch a device on as soon as it is connected to a running router', () => {
    popola();

    service.attivaStato(1);
    service.aggiungiDispositivo("PC");

    const nuovo = service.dispositivi()[4];

    expect(nuovo.stato).toBe("Offline");

    service.creaConnessione(2, nuovo.id);

    expect(service.dispositivi()[4].stato).toBe("Online");
  });

  it('should switch off the devices left without a connection', () => {
    popola();

    service.attivaStato(1);
    service.eliminaConnessione(2);

    expect(service.dispositivi()[0].stato).toBe("Online");
    expect(service.dispositivi()[1].stato).toBe("Online");
    expect(service.dispositivi()[2].stato).toBe("Offline");
    expect(service.dispositivi()[3].stato).toBe("Online");
  });

  it('should not let the signal pass through a router that is off', () => {
    service.dispositivi.set([
      dispositivo(1, "Router", "Router-01", 100, 100),
      dispositivo(2, "Router", "Router-02", 300, 100),
      dispositivo(3, "PC", "PC-01", 500, 100)
    ]);

    service.connessioni.set([
      { id: 1, sourceId: 1, targetId: 2 },
      { id: 2, sourceId: 2, targetId: 3 }
    ]);

    service.attivaStato(1);

    expect(service.dispositivi()[0].stato).toBe("Online");
    expect(service.dispositivi()[1].stato).toBe("Offline");
    expect(service.dispositivi()[2].stato).toBe("Offline");

    service.attivaStato(2);

    expect(service.dispositivi()[2].stato).toBe("Online");
  });

  it('should switch on every connected device when the router is activated', () => {
    popola();

    service.dispositivi.update(lista => lista.map(d => ({ ...d, stato: "Offline" })));

    service.attivaStato(1);

    const spenti = service.dispositivi().filter(d => d.stato != "Online");

    expect(service.dispositivi()[0].stato).toBe("Online");
    expect(spenti.length).toBe(0);
  });

  it('should not switch on a device that is not connected to the router', () => {
    popola();

    service.aggiungiDispositivo("PC");
    service.attivaStato(1);

    expect(service.dispositivi()[0].stato).toBe("Online");
    expect(service.dispositivi()[4].stato).toBe("Offline");
  });

  it('should list the connections of the device in the detail', () => {
    popola();

    service.apriDettaglio(2);

    expect(service.connessioniDettaglio()).toEqual([
      { id: 1, nome: "Router-01" },
      { id: 2, nome: "PC-01" },
      { id: 3, nome: "PC-02" }
    ]);
  });

  it('should name the device at the other end of the connection', () => {
    popola();

    service.apriDettaglio(1);

    expect(service.connessioniDettaglio()).toEqual([{ id: 1, nome: "Switch-01" }]);
  });

  it('should have no connections in the detail of an isolated device', () => {
    popola();

    service.aggiungiDispositivo("PC");
    service.apriDettaglio(5);

    expect(service.connessioniDettaglio()).toEqual([]);
  });

  it('should delete a device and its connections after the confirm', () => {
    popola();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    service.eliminaDispositivo(2);

    expect(service.dispositivi().map(d => d.id)).toEqual([1, 3, 4]);
    expect(service.connessioni().length).toBe(0);
    expect(service.linee().length).toBe(0);
  });

  it('should not delete a device when the confirm is refused', () => {
    popola();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    service.eliminaDispositivo(2);

    expect(service.dispositivi().length).toBe(4);
    expect(service.connessioni().length).toBe(3);
  });

  it('should keep the connections of the other devices', () => {
    popola();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    service.eliminaDispositivo(3);

    expect(service.connessioni().map(c => c.id)).toEqual([1, 3]);
  });

  it('should close the detail when the open device is deleted', () => {
    popola();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    service.apriDettaglio(2);
    service.eliminaDispositivo(2);

    expect(service.idDettaglio()).toBeNull();
    expect(service.dispositivoDettaglio()).toBeNull();
  });

  it('should clear the selection when the selected device is deleted', () => {
    popola();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    service.cambiaModalita("connect");
    service.cliccaDispositivo(2);
    service.eliminaDispositivo(2);

    expect(service.selezionato()).toBeNull();
  });

  it('should delete a single connection', () => {
    popola();

    service.eliminaConnessione(2);

    expect(service.connessioni().map(c => c.id)).toEqual([1, 3]);
    expect(service.linee().length).toBe(2);
  });

  it('should not touch the list when the connection does not exist', () => {
    popola();

    const prima = service.connessioni();

    service.eliminaConnessione(99);

    expect(service.connessioni()).toBe(prima);
  });

  it('should keep the connection ids unique after a deletion', () => {
    popola();

    service.eliminaConnessione(2);
    service.creaConnessione(3, 4);

    expect(service.connessioni().map(c => c.id)).toEqual([1, 3, 4]);
  });

  it('should save and load the whole topology', () => {
    popola();

    vi.spyOn(window, "alert").mockImplementation(() => {});

    service.salvaTopologia();

    service.aggiungiDispositivo("PC");
    service.spostaDispositivo(1, 10, 10);
    service.eliminaConnessione(1);

    expect(service.dispositivi().length).toBe(5);
    expect(service.connessioni().length).toBe(2);

    service.caricaTopologia();

    expect(service.dispositivi().length).toBe(4);
    expect(service.dispositivi()[0].x).toBe(600);
    expect(service.dispositivi()[0].y).toBe(120);
    expect(service.connessioni().map(c => c.id)).toEqual([1, 2, 3]);
    expect(service.linee().length).toBe(3);
  });

  it('should write the version and the name in the saved payload', () => {
    popola();

    vi.spyOn(window, "alert").mockImplementation(() => {});

    service.salvaTopologia();

    const salvata = JSON.parse(localStorage.getItem(CHIAVE_TOPOLOGIA) as string) as Topologia;

    expect(salvata.versione).toBe(VERSIONE_TOPOLOGIA);
    expect(salvata.nome).toBe("Rete laboratorio");
    expect(salvata.dispositivi.length).toBe(4);
    expect(salvata.connessioni.length).toBe(3);
  });

  it('should warn when there is nothing to load', () => {
    const avviso = vi.spyOn(window, "alert").mockImplementation(() => {});

    service.caricaTopologia();

    expect(avviso).toHaveBeenCalled();
    expect(service.dispositivi().length).toBe(0);
  });

  it('should warn when the storage cannot save', () => {
    popola();

    const avviso = vi.spyOn(window, "alert").mockImplementation(() => {});

    vi.spyOn(service.persistenza, "salva").mockReturnValue(false);

    service.salvaTopologia();

    expect(avviso).toHaveBeenCalledWith("Non è stato possibile salvare: lo spazio del browser non è disponibile.");
  });

  it('should close the detail and the selection when a topology is loaded', () => {
    popola();

    vi.spyOn(window, "alert").mockImplementation(() => {});

    service.salvaTopologia();

    service.apriDettaglio(2);
    service.cambiaModalita("connect");
    service.cliccaDispositivo(2);

    service.caricaTopologia();

    expect(service.idDettaglio()).toBeNull();
    expect(service.selezionato()).toBeNull();
    expect(service.modalita()).toBe("connect");
  });

  it('should empty the canvas when the topology is deleted', () => {
    popola();

    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    service.salvaTopologia();
    service.cancellaTopologia();

    expect(service.dispositivi().length).toBe(0);
    expect(service.connessioni().length).toBe(0);
    expect(service.linee().length).toBe(0);
    expect(service.persistenza.carica()).toBeNull();
  });

  it('should keep everything when the deletion is refused', () => {
    popola();

    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(false);

    service.salvaTopologia();
    service.cancellaTopologia();

    expect(service.dispositivi().length).toBe(4);
    expect(service.persistenza.carica()?.dispositivi.length).toBe(4);
  });
});
