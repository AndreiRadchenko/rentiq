import { HttpStatus } from '@nestjs/common';
import { TenantContext } from '../../../src/shared-kernel/interface/middleware/tenant-context';
import { FakeEventBus } from '../helpers/fakes';
import { AuditableLogger } from '../../../src/shared-kernel/infrastructure/audit/auditable-action.decorator';
import { TariffService } from '../../../src/pricing/application/tariff.service';
import { PricingService } from '../../../src/pricing/application/pricing.service';
import { FakeTariffRepository, makeTariff } from '../helpers/locations-fakes';

const ORG = '00000000-0000-4000-8000-0000000000aa';
const ACTOR = 'actor-1';

function withOrg<T>(fn: () => Promise<T>): Promise<T> {
  return TenantContext.run(ORG, fn) as Promise<T>;
}

async function expectApiError(promise: Promise<unknown>, code: string, status: number) {
  try {
    await promise;
    throw new Error(`Expected ApiException ${code}`);
  } catch (error) {
    expect(error).toHaveProperty('code', code);
    expect((error as { getStatus(): number }).getStatus()).toBe(status);
  }
}

describe('TariffService (US2)', () => {
  function build() {
    const tariffs = new FakeTariffRepository();
    const eventBus = new FakeEventBus();
    const audit = new AuditableLogger();
    const tariffService = new TariffService(tariffs, eventBus, audit);
    const pricingService = new PricingService(tariffs);
    return { tariffService, pricingService, tariffs, eventBus };
  }

  it('creates a tariff and publishes TariffChanged CREATED', async () => {
    const { tariffService, tariffs, eventBus } = build();
    const tariff = await withOrg(() =>
      tariffService.create({ kitType: 'SUP_BOARD', dayType: 'WEEKDAY', durationMinutes: 60, priceMinor: 10000 }, ACTOR),
    );
    expect(tariffs.store.has(tariff.id)).toBe(true);
    expect(eventBus.events.some((e) => e.constructor.name === 'TariffChanged')).toBe(true);
  });

  it('duplicate key → DUPLICATE_TARIFF 422 (FR-026)', async () => {
    const { tariffService, tariffs } = build();
    const existing = makeTariff();
    tariffs.store.set(existing.id, existing);
    await expectApiError(
      withOrg(() =>
        tariffService.create(
          { kitType: 'SUP_BOARD', dayType: 'WEEKDAY', durationMinutes: 60, priceMinor: 20000 },
          ACTOR,
        ),
      ),
      'DUPLICATE_TARIFF',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  });

  it('soft-deleting then re-creating same key succeeds (FR-026)', async () => {
    const { tariffService, tariffs } = build();
    const existing = makeTariff();
    tariffs.store.set(existing.id, existing);
    await withOrg(() => tariffService.softDelete(existing.id, ACTOR));
    const recreated = await withOrg(() =>
      tariffService.create({ kitType: 'SUP_BOARD', dayType: 'WEEKDAY', durationMinutes: 60, priceMinor: 20000 }, ACTOR),
    );
    expect(recreated.id).not.toBe(existing.id);
  });

  it('update price only; key immutable', async () => {
    const { tariffService, tariffs } = build();
    const t = makeTariff();
    tariffs.store.set(t.id, t);
    await withOrg(() => tariffService.update(t.id, { priceMinor: 15000 }, ACTOR));
    expect(t.currentState.priceMinor).toBe(15000);
    expect(t.currentState.kitType).toBe('SUP_BOARD');
    expect(t.currentState.durationMinutes).toBe(60);
  });
});

describe('PricingService.quote (US1)', () => {
  it('returns exact price + tariffId when found', async () => {
    const { pricingService, tariffs } = build();
    const t = makeTariff();
    tariffs.store.set(t.id, t);
    const result = await pricingService.quote(ORG, 'SUP_BOARD', 'WEEKDAY', 60);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap().money.getAmountMinor()).toBe(10000);
      expect(result.unwrap().tariffId).toBe(t.id);
    }
  });

  it('returns Err TARIFF_NOT_FOUND when no tariff for the key', async () => {
    const { pricingService } = build();
    const result = await pricingService.quote(ORG, 'SUP_BOARD', 'WEEKDAY', 999);
    expect(result.isErr()).toBe(true);
  });

  function build() {
    const tariffs = new FakeTariffRepository();
    const pricingService = new PricingService(tariffs);
    return { pricingService, tariffs };
  }
});
