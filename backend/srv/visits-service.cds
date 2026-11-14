@path                        : '/visits'
@requires                    : 'authenticated-user'
service VisitsService {
  type Visit {
    ID: String(80);
    ObjectID: String(120);
    MainAccountPartyID: String(80);
    AccountPartyName: String(255);
    Subject: String(5000);
    Status: String(40);
    ActualStartDateTime: String(40);
    SalesOrganisationID: String(80);
    VisitType: String(80);
    BTP_PORT_TEXT_EN: String(255);
    BTP_PORT_TEXT_AR: String(255);
    BTP_VisitTypeText_EN: String(255);
    BTP_VisitTypeText_AR: String(255);
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

  function getMyVisits() returns many Visit;
  function getVisitById(visitId: String(80)) returns many Visit;
  function getVisitAttachments(visitId: String(80)) returns many Attachment;
}
