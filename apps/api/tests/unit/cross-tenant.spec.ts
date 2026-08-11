import { TenantContext } from '../../src/shared-kernel/interface/middleware/tenant-context';
import { FakeEventBus } from './helpers/fakes';
import { AuditableLogger } from '../../src/shared-kernel/infrastructure/audit/auditable-action.decorator';
import { CryptoService } from '../../src/shared-kernel/infrastructure/crypto/crypto.service';
import { makeCryptoService } from './helpers/locations-fakes';
import { StationsService } from '../../src/locations/application/stations.service';
import { TariffService } from '../../src/pricing/application/tariff.service';
import {
  FakeStationRepository,
  FakeTariffRepository,
} from './helpers/locations-fakes';

const ORG_A = '00000000-0000-4000-8000-0000000000aa';
const ORG_B = '00000000-0000-4000-8000-0000000000bb';

function withOrg<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(orgId, fn) as Promise<T>;
}

describe('Cross-tenant isolation (Constitution Principle VI, Scenario 7)', () => {
  it('org-A data does not leak into org-B queries', async () => {
    const stations = new FakeStationRepository();
    const tariffs = new FakeTariffRepository();
    const eventBus = new FakeEventBus();
    const audit = new AuditableLogger();
    const stationsService = new StationsService(stations, stations as never, eventBus, audit, makeCryptoService());
    const tariffService = new TariffService(tariffs, eventBus, audit);

    const stationA = await withOrg(ORG_A, () =>
      stationsService.create({ name: 'OrgA Station', haUrlOrIp: 'http://a', haToken: 'a', haWebhookSecret: 'ws-a' }, 'admin-a'),
    );
    await withOrg(ORG_A, () =>
      tariffService.create({ kitType: 'SUP_BOARD', dayType: 'WEEKDAY', durationMinutes: 60, priceMinor: 10000 }, 'admin-a'),
    );

    const orgBStations = await withOrg(ORG_B, () => stationsService.listAdmin());
    expect(orgBStations).toHaveLength(0);
    expect(orgBStations.find((s) => s.id === stationA.id)).toBeUndefined();

    const orgBTariffs = await withOrg(ORG_B, () => tariffService.list({}));
    expect(orgBTariffs).toHaveLength(0);

    const crossLookup = await stations.findById(ORG_B, stationA.id);
    expect(crossLookup).toBeNull();
  });
});
