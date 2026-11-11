@path                        : '/licenses-api'
@requires                    : 'authenticated-user'
@cds.server.body_parser.limit: '2mb'
service LicenseService {

  type LicenseSubmissionPreflight {
    status                : String(50);
    message               : String(255);
    licenseType           : String(40);
    accountID             : String(80);
    accountMatches        : Integer;
    sameTypeQuoteCount    : Integer;
    accountQuoteCount     : Integer;
    existingLicenseNumber : String(80);
    crStatus              : String(256);
    btpActiveStatus       : String(32);
  }


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

  type CommercialRegistration {
    id               : String(64);
    crNumber         : String(32);
    crNationalNumber : String(32);
    companyName      : String(255);
    companyNameEn    : String(5000);
    companyNameAr    : String(5000);
    address          : String(5000);
    cityCode         : String(32);
    cityEn           : String(1024);
    cityAr           : String(1024);
    postal           : String(32);
    district         : String(512);
    street           : String(512);
    building         : String(56);
    secondary        : String(10);
    shortAddress     : String(5000);
    isTestData       : Boolean;
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

  type ServicePrice {
    serviceCode  : String(40);
    priceHalalas : String(24);
    currency     : String(3);
  }

  type ServiceQuote {
    currency     : String(3);
    totalHalalas : String(24);
    items        : array of ServicePrice;
  }

  type C4cConnectionStatus {
    connected   : Boolean;
    destination : String(80);
    status      : String(80);
  }

  function checkC4cConnection()                                returns C4cConnectionStatus;
  function getServicePrices()                                  returns many ServicePrice;
  function quoteServices(serviceCodes: LargeString)            returns ServiceQuote;
  function getMyCommercialRegistrations()                      returns many CommercialRegistration;
  function getMyLicenses()                                     returns many LicenseSummary;
  function getMyRequests()                                     returns many RequestSummary;

  function preflightLicenseSubmission(crNationalNumber: String(32),
  crNumber: String(32),
  licenseType: String(40))
  returns LicenseSubmissionPreflight;

  action   submitLicense(payload: LargeString)                 returns LargeString;
  action   renewLicense(payload: LargeString)                  returns LargeString;
}
