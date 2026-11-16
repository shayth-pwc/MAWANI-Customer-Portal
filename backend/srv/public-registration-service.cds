@path    : '/public-registration'
@requires: 'any'
service PublicRegistrationService {
  type ValidationStart {
    documentType   : String(32);
    documentNumber : String(32);
    nationalityId  : String(32);
    language       : String(10);
  }

  type ValidationStartResult {
    status   : String(32);
    loginUrl : String(5000);
  }

  type ValidationStatus {
    status    : String(32);
    validated : Boolean;
  }

  type RegistrationResult {
    iasId  : String(150);
    status : String(32);
  }

  type RegistrationListItem {
    itemKey : String(255);
    title   : String(500);
    titleAr : String(500);
    list    : String(100);
  }

  function getRegistrationLists()                    returns many RegistrationListItem;
  action   startNafathValidation(input: LargeString) returns ValidationStartResult;
  function nafathStatus(documentNumber: String(32))  returns ValidationStatus;
  action   completeRegistration(input: LargeString)  returns RegistrationResult;
}
