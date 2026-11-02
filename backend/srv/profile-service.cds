// Authenticated self-service. No administrator role required.
// GET is strictly read-only; first-login provisioning uses the protected
// POST action, invoked by the authenticated App Router bootstrap page.
@path: '/profile'
@requires: 'authenticated-user'
service ProfileService {
  type MyProfile {
    UUID          : UUID;
    IAS_ID        : String(150);
    EMAIL         : String(254);
    ACCOUNT_TYPE  : String(30);
    FNAME         : String(100);
    LNAME         : String(100);
    ACTIVE_STATUS : Boolean;
    created       : Boolean;
  }
  function me() returns MyProfile;
  action provision() returns MyProfile;
}
