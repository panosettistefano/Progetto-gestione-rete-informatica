import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CHIAVE_TOPOLOGIA } from '../../costanti';
import { Strumenti } from './strumenti';

describe('Strumenti', () => {
  let component: Strumenti;
  let fixture: ComponentFixture<Strumenti>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Strumenti],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Strumenti);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  function pulsante(varTesto: string): HTMLButtonElement {
    const pulsanti = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    return pulsanti.find(p => p.textContent?.includes(varTesto)) as HTMLButtonElement;
  }

  function opzioni(): HTMLOptionElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('select option')) as HTMLOptionElement[];
  }

  async function rispondiElenco(varElenco: object[]): Promise<void> {
    http.match('/api/topologie').forEach(richiesta => richiesta.flush(varElenco));

    await new Promise(risolvi => setTimeout(risolvi));
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the three buttons of the topology', () => {
    expect(pulsante("Salva")).toBeTruthy();
    expect(pulsante("Carica")).toBeTruthy();
    expect(pulsante("Cancella")).toBeTruthy();
  });

  it('should save the topology with the button', async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    localStorage.clear();

    pulsante("Salva").click();
    await fixture.whenStable();

    expect(localStorage.getItem(CHIAVE_TOPOLOGIA)).not.toBeNull();
  });

  it('should show the three buttons of the server', () => {
    expect(pulsante("Salva sul server")).toBeTruthy();
    expect(pulsante("Apri dal server")).toBeTruthy();
    expect(pulsante("Elimina dal server")).toBeTruthy();
  });

  it('should ask the server for the list at startup', () => {
    expect(component.serverAttivo()).toBeNull();
    expect(http.match('/api/topologie').length).toBe(1);
  });

  it('should fill the list with the topologies of the server', async () => {
    await rispondiElenco([
      { id: 4, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" },
      { id: 5, nome: "Rete aula 3", creata_il: "2026-09-25T16:02:00.000Z" }
    ]);

    expect(component.serverAttivo()).toBe(true);
    expect(opzioni().length).toBe(2);
    expect(opzioni()[0].textContent).toContain("Rete laboratorio");
    expect(opzioni()[1].textContent).toContain("Rete aula 3");
    expect(component.idScelto()).toBe(5);
  });

  it('should notice when the server does not answer', async () => {
    http.match('/api/topologie').forEach(richiesta => richiesta.error(new ProgressEvent("error"), { status: 0 }));

    await new Promise(risolvi => setTimeout(risolvi));
    await fixture.whenStable();

    expect(component.serverAttivo()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain("Server non raggiungibile");
  });

  it('should take the topology that comes back from the server', async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});

    await rispondiElenco([]);

    component.service.aggiungiDispositivo("PC");

    const salvataggio = component.salvaSulServer();

    const invio = http.expectOne('/api/topologie');

    expect(invio.request.method).toBe("POST");

    invio.flush({
      id: 4,
      nome: "Rete laboratorio",
      creata_il: "2026-09-25T15:37:27.000Z",
      dispositivi: [
        { id: 77, tipo: "PC", nome: "PC-01", x: 100, y: 100, ip: "192.168.1.101", hostname: "pc-01", stato: "Offline" }
      ],
      connessioni: []
    });

    await new Promise(risolvi => setTimeout(risolvi));
    await rispondiElenco([{ id: 4, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" }]);
    await salvataggio;

    expect(component.service.dispositivi().map(d => d.id)).toEqual([77]);
    expect(component.elencoServer().length).toBe(1);
    expect(component.idScelto()).toBe(4);
  });

  it('should move the choice on the topology it has just saved', async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});

    await rispondiElenco([
      { id: 1, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" },
      { id: 4, nome: "Rete aula 3", creata_il: "2026-09-25T16:02:00.000Z" }
    ]);

    expect(component.idScelto()).toBe(4);

    component.service.aggiungiDispositivo("PC");

    const salvataggio = component.salvaSulServer();

    http.expectOne('/api/topologie').flush({
      id: 5,
      nome: "Rete laboratorio",
      creata_il: "2026-09-25T17:00:00.000Z",
      dispositivi: [
        { id: 77, tipo: "PC", nome: "PC-01", x: 100, y: 100, ip: "192.168.1.101", hostname: "pc-01", stato: "Offline" }
      ],
      connessioni: []
    });

    await new Promise(risolvi => setTimeout(risolvi));
    await rispondiElenco([
      { id: 1, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" },
      { id: 4, nome: "Rete aula 3", creata_il: "2026-09-25T16:02:00.000Z" },
      { id: 5, nome: "Rete laboratorio", creata_il: "2026-09-25T17:00:00.000Z" }
    ]);
    await salvataggio;

    expect(component.idScelto()).toBe(5);
  });

  it('should delete a topology from the server', async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await rispondiElenco([{ id: 4, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" }]);

    const cancellazione = component.eliminaDalServer();

    const invio = http.expectOne('/api/topologie/4');

    expect(invio.request.method).toBe("DELETE");

    invio.flush({ eliminata: 4 });

    await new Promise(risolvi => setTimeout(risolvi));
    await rispondiElenco([]);
    await cancellazione;

    expect(component.elencoServer().length).toBe(0);
    expect(component.idScelto()).toBeNull();
  });

  it('should not delete anything when the confirm is refused', async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    await rispondiElenco([{ id: 4, nome: "Rete laboratorio", creata_il: "2026-09-25T15:37:27.000Z" }]);

    component.eliminaDalServer();

    expect(http.match('/api/topologie/4').length).toBe(0);
  });
});
