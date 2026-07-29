Create an implementation plan for the Media Assets specification.

Follow spec-kit-prompts/constitution.prompt.md.
Follow docs/architecture/greenfield-architecture.md (§4.9 media, ADR-005) and
docs/roadmap/implementation-roadmap.md (Phase 4 — Media Assets deliverables and exit
criteria).

Preserve module boundaries: media is the sole owner of MediaAsset; other modules (rentals,
support) reference media assets by ID only, never touch MinIO directly.

Include:
- Architecture impact
- Required modules: media
- Domain model: MediaAsset entity (id, orgId, ownerType, ownerId, storageKey, contentType,
  sizeBytes, uploadedByType, uploadedById, expiresAt)
- Database changes: media_assets table
- APIs: POST /media/upload (authenticated, multipart/form-data, max 10 MB, stores to
  {orgId}/{ownerType}/{ownerId}/{uuid}.{ext}, returns { assetId }); GET /media/:assetId/url
  (returns a 15-minute pre-signed URL)
- Events: none (media changes are not business events)
- Background jobs: MediaCleanupJob (@Cron daily) deleting assets past expiresAt from both
  object storage and the database
- Testing strategy: integration test uploading a JPEG, requesting a pre-signed URL,
  opening it, and running the cleanup job manually against an expired asset
- Risks: object storage filling up on a single host — retention lifecycle rules must be
  set from day one
- Migration considerations: none (greenfield)
- Task breakdown matching Phase 4's exit criteria, plus i18n error strings ("Photo too
  large" / "Unsupported file type") in uk and en

Do not generate production code.
