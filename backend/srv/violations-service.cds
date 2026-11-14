@path                        : '/violations'
@requires                    : 'authenticated-user'
@cds.server.body_parser.limit: '2mb'
service ViolationsService {
  type Fine {
    ID: String(80);
    ObjectID: String(120);
    BuyerPartyID: String(80);
    BuyerPartyName: String(255);
    SalesOrganisationID: String(80);
    PORT_TEXT: String(255);
    PORT_TEXT_AR: String(255);
    PORT_UICOLORSTATUS: String(50);
    BTP_FInestatus_KUT: String(80);
    BTP_FInestatus_KUTText: String(255);
    BTP_FInestatus_KUTText_AR: String(255);
    BTP_FInestatus_KUT_UICOLORSTATUS: String(50);
    Role1_KUT: String(80);
    Role1_KUTText: String(255);
    Role1_KUTText_AR: String(255);
    ProcessingTypeCode: String(80);
    ProcessingTypeCodeText: String(255);
    ProcessingTypeCodeText_AR: String(255);
    ProcessingTypeCode_UICOLORSTATUS: String(50);
    zLicenseNumber_SDK: String(80);
    CRNationalNumber_KUT: String(40);
    ZCommercialRegisterNumber_SDK: String(40);
    NetAmount: String(80);
    NetAmountCurrencyCode: String(10);
    Invoicedate_KUT: String(40);
    ObjectionExpiryDate: String(40);
    SadadNumber_KUT: String(80);
    FineSubject_KUT: String(5000);
    FineDescription_KUT: LargeString;
  }

  type ObjectionRequest {
    ID: String(80);
    ObjectID: String(120);
    SalesOrderID: String(80);
    BuyerPartyID: String(80);
    BTP_SadadNumber: String(80);
    Name: String(5000);
    Reason_KUT: LargeString;
    CreationDateTime: String(40);
    ServiceRequestUserLifeCycleStatusCode: String(80);
    ServiceRequestUserLifeCycleStatusCodeText: String(255);
    ServiceRequestUserLifeCycleStatusCodeText_AR: String(255);
    ServiceRequestUserLifeCycleStatusCode_UICOLORSTATUS: String(50);
    Role1_KUT: String(80);
    SalesOrganisationID: String(80);
  }

  type Attachment {
    TypeCode: String(40);
    TypeCodeText: String(255);
    Name: String(255);
    CategoryCode: String(40);
    CategoryCodeText: String(255);
    Binary: LargeString;
    MimeType: String(100);
    DocumentLink: String(5000);
  }

  type ObjectionSubmissionResult {
    ID: String(80);
    ObjectID: String(120);
    attachmentCount: Integer;
  }

  function getMyFines() returns many Fine;
  function getFineById(fineId: String(80)) returns many Fine;
  function getMyObjectionRequests() returns many ObjectionRequest;
  function getFineAttachments(fineId: String(80)) returns many Attachment;
  function getObjectionAttachments(requestId: String(80)) returns many Attachment;
  action submitObjection(payload: LargeString) returns ObjectionSubmissionResult;
}
