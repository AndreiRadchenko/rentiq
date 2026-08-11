import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantContext } from '../../../shared-kernel/interface/middleware/tenant-context';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationRepository,
} from '../../../organizations/application/ports/organization.repository';
import { StationHealthCheckerService } from '../../application/station-health-checker.service';
import { StationsService } from '../../application/stations.service';

@Injectable()
export class StationHealthCheckerCron {
  private readonly logger = new Logger('StationHealthCheckerCron');

  constructor(
    private readonly healthChecker: StationHealthCheckerService,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    private readonly stationsService: StationsService,
  ) {}

  @Cron('*/30 * * * * *')
  async tick(): Promise<void> {
    const orgs = await this.organizationRepository.listAll();
    for (const org of orgs) {
      if (org.isSuspended) continue;
      const orgId = org.id;
      await TenantContext.run(orgId, async () => {
        const stations = await this.stationsService.listAdmin();
        for (const station of stations) {
          if (!station.currentState.adminIntendedIsActive) continue;
          try {
            await this.healthChecker.checkOne(station);
          } catch (error) {
            this.logger.error(`Health check failed for station ${station.id}: ${(error as Error).message}`);
          }
        }
      });
    }
  }
}
