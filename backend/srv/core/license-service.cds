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
    PortText                     : String(255);
    PortTextAr                   : String(255);
    Status                       : String(80);
    LicenseTypeText              : String(255);
    LicenseTypeTextAr            : String(255);
    StartDate                    : String(40);
    ExpiryDate                   : String(40);
    Amount                       : String(80);
    QuoteID                      : String(80);
    QuoteObjectID                : String(120);
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
    LicenseTypeText              : String(255);
    LicenseTypeTextAr            : String(255);
    RequestType                  : String(40);
    ServiceType                  : String(80);
    ServiceTypeText              : String(255);
    ServiceTypeTextAr            : String(255);
    Port                         : String(80);
    PortText                     : String(255);
    PortTextAr                   : String(255);
    Status                       : String(80);
    Amount                       : String(80);
    CreatedAt                    : String(40);
    CRNationalNumber             : String(40);
    CommercialRegistrationNumber : String(40);
    CompanyName                  : String(255);
  }

  type Attachment {
    TypeCode                     : String(40);
    TypeCodeText                 : String(255);
    Name                         : String(255);
    CategoryCode                 : String(40);
    CategoryCodeText             : String(255);
    Binary                       : LargeString;
    MimeType                     : String(100);
    DocumentLink                 : String(5000);
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
  function getLicenseAttachments(accountId: String(80))        returns many Attachment;
  function getRequestAttachments(requestId: String(80))        returns many Attachment;

  function preflightLicenseSubmission(crNationalNumber: String(32),
  crNumber: String(32),
  licenseType: String(40))
  returns LicenseSubmissionPreflight;

  action   submitLicense(payload: LargeString)                 returns LargeString;
  action   renewLicense(payload: LargeString)                  returns LargeString;
}
