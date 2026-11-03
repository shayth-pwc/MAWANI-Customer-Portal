// This service deliberately does NOT expose managed CDS persistence entities.
// public."BTP_TBL_USERS" and public."BTP_TBL_AUDIT_LOG" are existing physical tables.
@path: '/admin'
@requires: 'authenticated-user'
service AdminService {
  type PortalUser {
    UUID          : UUID;
    PERNR         : String(20);
    IAS_ID        : String(150);
    EMAIL         : String(254);
    ACCOUNT_TYPE  : String(30);
    FNAME         : String(100);
    SNAME         : String(100);
    TNAME         : String(100);
    LNAME         : String(100);
    MOBILE_KEY    : String(10);
    MOBILE_NUMBER : String(25);
    CCODE         : String(2);
    ACTIVE_STATUS : Boolean;
    CREATED_ON    : Timestamp;
    CHANGED_ON    : Timestamp;
  }
  type IasUser {
    id          : String;
    userName    : String;
    displayName : String;
    email       : String;
    active      : Boolean;
    // Safe, admin-visible SCIM profile fields; never expose password hashes.
    givenName   : String;
    familyName  : String;
    middleName  : String;
    mobile      : String;
    title       : String;
    locale      : String;
    timezone    : String;
    preferredLanguage : String;
    externalId  : String;
    userType    : String;
    nickName    : String;
    groupsSummary: String;
    addressesSummary: String;
    organization: String;
    department  : String;
    created     : String;
    lastModified: String;
    portalUserUuid : UUID; // populated on createIasUser only
    portalCreated  : Boolean; // populated on createIasUser only
    groupIds : array of String;
  }
  type IasUserPage {
    totalResults : Integer;
    itemsPerPage : Integer;
    startIndex   : Integer;
    users        : array of IasUser;
  }

  type IasMembershipResult {
  userId   : String;
  groupId  : String;
  assigned : Boolean;
}

action setIasUserGroupMembership(
  userId: String,
  groupId: String,
  assigned: Boolean
) returns IasMembershipResult;

  type PortalSyncResult {
    profile : PortalUser;
    created : Boolean;
  }

  type IasGroup {
    id          : String;
    displayName : String;
    externalId  : String;
    manageable : Boolean;
  }
  type IasGroupPage {
    totalResults : Integer;
    itemsPerPage : Integer;
    startIndex   : Integer;
    groups       : array of IasGroup;
  }

  // Existing local PostgreSQL users. Preserve original operations.
  function getUsers(limit: Integer, offset: Integer) returns array of PortalUser;
  function getUser(uuid: UUID) returns PortalUser;
  action updatePortalUser(
    uuid: UUID,
    FNAME: String,
    SNAME: String,
    TNAME: String,
    LNAME: String,
    MOBILE_KEY: String,
    MOBILE_NUMBER: String,
    CCODE: String,
    ACTIVE_STATUS: Boolean
  ) returns PortalUser;
  action createPortalUser(iasId: String) returns PortalUser;

  // IAS groups, read-only in this phase. Memberships are not exposed.
  function listIasGroups(startIndex: Integer, count: Integer) returns IasGroupPage;
  function getIasGroup(id: String) returns IasGroup;

  // IAS users, across the full tenant, using IAS Directory SCIM.
  function listIasUsers(startIndex: Integer, count: Integer) returns IasUserPage;
  function getIasUser(id: String) returns IasUser;
  action createIasUser(
    userName: String, email: String, givenName: String, familyName: String
  ) returns IasUser;
  // Idempotently register an existing IAS user in PostgreSQL (no IAS changes).
  action syncIasUserToPortal(id: String) returns PortalSyncResult;
  // Explicit administrator reconciliation after a verified remote IAS update.
  // Unlike the create-only sync, this applies current IAS name/email/status.
  action reconcileIasUserToPortal(id: String) returns PortalSyncResult;
  action updateIasUser(
    id: String, email: String, givenName: String, familyName: String,
    mobile: String, title: String, locale: String, timezone: String,
    preferredLanguage: String
  ) returns IasUser;
  type PasswordResetResult {
    accepted: Boolean;
    message: String;
  }
  action requestIasPasswordReset(id: String) returns PasswordResetResult;
  action setIasUserActive(id: String, active: Boolean) returns IasUser;
}
