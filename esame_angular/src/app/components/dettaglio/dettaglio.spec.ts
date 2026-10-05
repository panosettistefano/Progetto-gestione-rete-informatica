import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopologiaService } from '../../services/topologia-service';
import { Dispositivo, TipoDispositivo } from '../../types/dispositivo';
import { Dettaglio } from './dettaglio';

describe('Dettaglio', () => {
  let component: Dettaglio;
  let fixture: ComponentFixture<Dettaglio>;
  let service: TopologiaService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dettaglio],
    }).compileComponents();

    fixture = TestBed.createComponent(Dettaglio);
    component = fixture.componentInstance;
    service = TestBed.inject(TopologiaService);
    await fixture.whenStable();
  });

  function creaDispositivo(varId: number, varTipo: TipoDispositivo, varNome: string, varX: number, varY: number): Dispositivo {
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
      creaDispositivo(1, "Router", "Router-01", 600, 120),
      creaDispositivo(2, "Switch", "Switch-01", 600, 340)
    ]);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show the sidebar when no device is open', () => {
    expect(fixture.nativeElement.querySelector('.sidebar-dettaglio')).toBeNull();
  });

  it('should show the fields of the opened device', async () => {
    popola();
    service.apriDettaglio(1);
    await fixture.whenStable();

    const testo = fixture.nativeElement.textContent;

    expect(fixture.nativeElement.querySelector('.sidebar-dettaglio')).toBeTruthy();
    expect(testo).toContain("Router-01");
    expect(testo).toContain("Router");
    expect(testo).toContain("192.168.1.1");
    expect(testo).toContain("router-01");
    expect(testo).toContain("Hostname");
    expect(testo).toContain("Online");
  });

  it('should close the sidebar with its button', async () => {
    popola();
    service.apriDettaglio(1);
    await fixture.whenStable();

    const pulsante = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    pulsante.click();
    await fixture.whenStable();

    expect(service.idDettaglio()).toBeNull();
    expect(fixture.nativeElement.querySelector('.sidebar-dettaglio')).toBeNull();
  });

  it('should close the sidebar when the device disappears', async () => {
    popola();
    service.apriDettaglio(1);
    await fixture.whenStable();

    service.dispositivi.set(service.dispositivi().filter(d => d.id != 1));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.sidebar-dettaglio')).toBeNull();
  });

  function pulsanteStato(): HTMLButtonElement {
    const pulsanti = Array.from(fixture.nativeElement.querySelectorAll('.sidebar-dettaglio button')) as HTMLButtonElement[];

    return pulsanti.find(p => p.textContent?.includes("stato")) as HTMLButtonElement;
  }

  it('should activate the state from the sidebar', async () => {
    popola();
    service.disattivaStato(1);
    service.apriDettaglio(1);
    await fixture.whenStable();

    expect(pulsanteStato().textContent).toContain("Attiva stato");

    pulsanteStato().click();
    await fixture.whenStable();

    expect(service.dispositivi()[0].stato).toBe("Online");
    expect(fixture.nativeElement.textContent).toContain("Online");
    expect(pulsanteStato().textContent).toContain("Disattiva stato");
  });

  it('should deactivate the state from the sidebar', async () => {
    popola();
    service.apriDettaglio(1);
    await fixture.whenStable();

    pulsanteStato().click();
    await fixture.whenStable();

    expect(service.dispositivi()[0].stato).toBe("Offline");
    expect(pulsanteStato().textContent).toContain("Attiva stato");
  });

  it('should list the connections of the device', async () => {
    popola();
    service.connessioni.set([{ id: 1, sourceId: 1, targetId: 2 }]);
    service.apriDettaglio(1);
    await fixture.whenStable();

    const voci = fixture.nativeElement.querySelectorAll('.sidebar-dettaglio .elenco li');

    expect(voci.length).toBe(1);
    expect(voci[0].textContent).toContain("Switch-01");
  });

  it('should say when the device has no connections', async () => {
    popola();
    service.apriDettaglio(1);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('.elenco li').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain("Nessun collegamento");
  });

  it('should delete the connection from its button', async () => {
    popola();
    service.connessioni.set([{ id: 1, sourceId: 1, targetId: 2 }]);
    service.apriDettaglio(1);
    await fixture.whenStable();

    const pulsante = fixture.nativeElement.querySelector('.elenco li button') as HTMLButtonElement;

    pulsante.click();
    await fixture.whenStable();

    expect(service.connessioni().length).toBe(0);
    expect(service.dispositivi().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain("Nessun collegamento");
  });

  it('should delete the device from its button', async () => {
    popola();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    service.apriDettaglio(1);
    await fixture.whenStable();

    const pulsante = fixture.nativeElement.querySelector('.sidebar-dettaglio .pulsante--elimina') as HTMLButtonElement;

    pulsante.click();
    await fixture.whenStable();

    expect(service.dispositivi().map(d => d.id)).toEqual([2]);
    expect(fixture.nativeElement.querySelector('.sidebar-dettaglio')).toBeNull();
  });

  it('should give a colour to every state', () => {
    expect(component.classeStato("Online")).toBe("pastiglia--online");
    expect(component.classeStato("Offline")).toBe("pastiglia--offline");
    expect(component.classeStato("Manutenzione")).toBe("pastiglia--manutenzione");
  });
});
