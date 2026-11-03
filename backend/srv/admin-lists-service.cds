// Administrative configuration API; same IAS group authorization as /admin.
@path: '/admin-lists'
@requires: 'authenticated-user'
service AdminListsService {
  type SubItem {
    ![key]: String(255);
    title: String(500);
    titleAr: String(500);
    itemOrder: Integer;
    icon: String(150);
    uiColor: String(50);
    parentKey: String(255);
    active: Boolean;
  }
  type Item {
    ![key]: String(255);
    title: String(500);
    titleAr: String(500);
    itemOrder: Integer;
    icon: String(150);
    uiColor: String(50);
    parentKey: String(255);
    active: Boolean;
    subItems: array of SubItem;
  }
  type Definition {
    app: String(100);
    code: String(100);
    title: String(250);
    titleAr: String(250);
    description: String;
    listType: String(50);
    isSublist: Boolean;
    allowMultiple: Boolean;
    isRequired: Boolean;
    defaultValue: String(255);
    active: Boolean;
    items: array of Item;
  }
  type DefinitionPage {
    total: Integer;
    lists: array of Definition;
  }
  function getDefinitions(limit: Integer, offset: Integer) returns DefinitionPage;
  function getDefinition(app: String, code: String) returns Definition;
  action saveDefinition(app: String, code: String, title: String, titleAr: String,
    description: String, listType: String, isSublist: Boolean,
    allowMultiple: Boolean, isRequired: Boolean, defaultValue: String,
    active: Boolean) returns Definition;
  action saveItem(app: String, code: String, key: String,
    title: String, titleAr: String, itemOrder: Integer,
    icon: String, uiColor: String, parentKey: String,
    active: Boolean) returns Item;
  action setDefinitionActive(app: String, code: String, active: Boolean) returns Definition;
  action setItemActive(app: String, code: String, key: String, active: Boolean) returns Item;
}
