Create a functional specification for the Media Assets capability of rentiq.

Use docs/architecture/greenfield-architecture.md and docs/domain/business-rules.md only as
context — see BR-10.1 through BR-10.4 and ADR-005. Do not restate them; reference them.

Focus on business behavior only.

Include:
- User stories
- Functional requirements: photos submitted by renters must be stored durably and never
  rely on a channel-specific reference (e.g. a Telegram file identifier) that can expire
  or become inaccessible; the upload flow (client downloads/collects the photo, then
  submits it to the platform, which stores it centrally); strict access control so photos
  are only viewable through short-lived, authenticated access, never via a guessable
  public URL; minimum one-year retention (configurable per organization) with automatic
  expiry and purge
- Business rules
- Acceptance criteria
- Error scenarios (oversized file, unsupported file type)
- Non-functional requirements
- Open questions

Exclude:
- Database schema
- NestJS modules, classes, services
- API endpoint shapes
- MinIO/object-storage protocol details
