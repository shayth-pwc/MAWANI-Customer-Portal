// Authenticated, read-only consumer API. The physical CONFIG tables preexist.
@path: '/lists'
@requires: 'authenticated-user'
service ListService {
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
  function getList(app: String, code: String) returns Definition;
}
