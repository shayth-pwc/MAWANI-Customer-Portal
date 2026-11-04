@path: '/licenses-api'
@requires: 'authenticated-user'
service LicenseService {
  type LicenseSummary {
    AccountID                    : String(80);
    ObjectID                     : String(80);
    LicenseNumber                : String(80);
    LicenseType                  : String(40);
    CRNationalNumber             : String(40);
    CommercialRegistrationNumber : String(40);
    CompanyName                  : String(255);
    Port                         : String(80);
    Status                       : String(80);
  }

  type RequestSummary {
    ID                           : String(80);
    ObjectID                     : String(80);
    BuyerPartyID                 : String(80);
    LicenseType                  : String(40);
    RequestType                  : String(40);
    Status                       : String(80);
    Amount                       : String(80);
    CRNationalNumber             : String(40);
    CommercialRegistrationNumber : String(40);
  }

  function getMyLicenses() returns many LicenseSummary;
  function getMyRequests() returns many RequestSummary;
  action submitLicense(payload : LargeString) returns LargeString;
  action renewLicense(payload : LargeString) returns LargeString;
}
