import { EntityId } from './entity-id';

export class OrgId extends EntityId<'OrgId'> {
  protected constructor(value: string) {
    super(value);
  }

  static override generate(): OrgId {
    return EntityId.generate<'OrgId'>() as OrgId;
  }

  static override from(value: string): OrgId {
    return EntityId.from<'OrgId'>(value) as OrgId;
  }
}
