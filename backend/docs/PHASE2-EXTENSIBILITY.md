# Extending the Mawani CAP backend

The backend is a modular monolith for now: one Cloud Foundry application, one CAP runtime,
and domain-specific services. Do not place business logic for future applications inside
`admin-service.js` or `core/clients/ias.client.js`.

## Proposed next-module pattern

    srv/
      core/
        security/      # authenticated identity and shared authorization
        repositories/  # existing shared physical data tables
        services/      # shared audit/identity services
        clients/       # reusable IAS/third-party clients
      modules/
        permit-management/
          permit-service.cds
          permit-service.js
          controllers/
          services/
          repositories/
        customer-registration/
          ...
      integrations/
        sap-s4hana/
        integration-suite/

Apps may share IAS identity validation, logging, and database configuration, but
should expose separate versioned CAP services. Integrations should own their
external APIs, timeouts, retries, credentials, and mapping code. Prefer events or
outbox patterns for cross-system writes when later phases require reliability.

Authentication and authorization must be considered separately. This Phase 1 code
requires preapproved linked SYSTEM_ADMIN records. In future phases, consider
SAP Authorization Management Service (AMS) for centralized fine-grained policies
without assuming the IAS JWT carries application roles.

No first-login auto-provisioning is implemented. Adding it later requires an
explicit approved account mapping policy and concurrency-safe unique constraints.
