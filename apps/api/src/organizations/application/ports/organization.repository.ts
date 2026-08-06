import { Organization } from '../../domain/organization';

export const ORGANIZATION_REPOSITORY = 'ORGANIZATION_REPOSITORY';

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  listAll(): Promise<Organization[]>;
  save(organization: Organization): Promise<void>;
}
