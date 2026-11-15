@path                        : '/permits'
@requires                    : 'authenticated-user'
@cds.server.body_parser.limit: '6mb'
service PermitsService {
  type License {
    AccountID: String(80); ObjectID: String(120); LicenseNumber: String(80);
    LicenseType: String(80); LicenseTypeText: String(255); LicenseTypeTextAr: String(255);
    CRNationalNumber: String(40); CommercialRegistrationNumber: String(40);
    CompanyName: String(500); Port: String(80); PortText: String(255); PortTextAr: String(255);
    Status: String(80); StartDate: String(40); ExpiryDate: String(40);
  }
  type PermitRequest {
    ID: String(80); ObjectID: String(120); BuyerPartyID: String(80); BuyerPartyName: String(500);
    ProcessingTypeCode: String(80); ProcessingTypeText: String(255); ProcessingTypeTextAr: String(255);
    Port: String(80); PortText: String(255); PortTextAr: String(255); Place: String(80);
    Status: String(80); StatusText: String(255); StatusTextAr: String(255);
    CreationDateTime: String(40); ExpiryDate: String(40); CancellationDate: String(40);
    LicenseNumber: String(80); CRNationalNumber: String(40);
  }
  type Attachment {
    TypeCode: String(40); TypeCodeText: String(255); Name: String(255);
    CategoryCode: String(40); CategoryCodeText: String(255); Binary: LargeString;
    MimeType: String(100); DocumentLink: String(5000);
  }
  type PermitSubmissionResult { ID: String(80); ObjectID: String(120); attachmentCount: Integer; }

  function getMyLicenses() returns many License;
  function getMyPermitRequests() returns many PermitRequest;
  function getLicenseAttachments(accountId: String(80)) returns many Attachment;
  function getPermitAttachments(requestId: String(80)) returns many Attachment;
  action submitPermit(payload: LargeString) returns PermitSubmissionResult;
}
