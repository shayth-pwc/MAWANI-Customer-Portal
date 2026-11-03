'use strict';
// Uses EXISTING physical PostgreSQL tables; no CAP schema auto-deployment.
const cds = require('@sap/cds');
const { randomUUID } = require('node:crypto');
const AuditService = require('./audit.service');
const { AppError } = require('../utils/errors');
const v = require('../utils/validation');

const HEAD = 'public."CONFIG_TBL_APPLICATIONS_LISTS"';
const ITEM = 'public."CONFIG_TBL_APPLICATIONS_LISTS_I"';
const CODE = /^[A-Z0-9][A-Z0-9_.-]{0,99}$/;
const OPTION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/;
const headCols = '"RID", "APP", "LIST", "TYPE", "IS_SUBLIST", "TITLE", "TITLE_AR", "DESCRIPTION", "DEFAULT_VALUE", "ALLOW_MULTIPLE", "IS_REQUIRED", "ACTIVE_STATUS", "BEGDA", "ENDDA"';
const itemCols = '"RID", "SERVICE_NAME", "LIST", "KEY", "TITLE", "TITLE_AR", "ITEM_ORDER", "ICON", "UI_COLOR", "EXTRA_DATA", "ACTIVE_STATUS", "BEGDA", "ENDDA"';

function code(value, name) {
  if (typeof value !== 'string' || !CODE.test(value)) throw new AppError(400, `Invalid ${name}; use uppercase code A-Z, digits, dot, underscore or hyphen`);
  return value;
}
function key(value, name = 'key') {
  if (typeof value !== 'string' || !OPTION.test(value)) throw new AppError(400, `Invalid ${name}`);
  return value;
}
function label(value, name, max, required = true) {
  if (value === '' && !required) return '';
  return v.text(value, name, { max, required });
}
function bool(value, name, defaultValue = null) {
  if (value === undefined || value === null) return defaultValue;
  return v.boolean(value, name);
}
function jsonObject(raw) {
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { obj = null; } }
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
}
function validAt(row, now = new Date().toISOString().slice(0, 10)) {
  const day = (val) => val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
  return row.ACTIVE_STATUS === true && (!row.BEGDA || day(row.BEGDA) <= now) && (!row.ENDDA || day(row.ENDDA) >= now);
}
function mapItem(item) {
  const meta = jsonObject(item.EXTRA_DATA);
  return {
    key: item.KEY, title: item.TITLE || '', titleAr: item.TITLE_AR || '',
    itemOrder: item.ITEM_ORDER ?? 0, icon: item.ICON || '', uiColor: item.UI_COLOR || '',
    parentKey: typeof meta.parentKey === 'string' ? meta.parentKey : '',
    active: item.ACTIVE_STATUS === true, subItems: []
  };
}
function toTree(rows, activeOnly = false) {
  const selected = rows.filter(row => !activeOnly || validAt(row));
  const all = new Map();
  for (const row of selected) {
    if (!row.KEY || all.has(row.KEY)) throw new AppError(409, 'Duplicate or invalid dynamic list option key');
    all.set(row.KEY, mapItem(row));
  }
  const roots = [];
  for (const row of selected) {
    const node = all.get(row.KEY);
    if (!node.parentKey) roots.push(node);
    else {
      const parent = all.get(node.parentKey);
      // An inactive/missing parent should never expose an orphan child to a consumer.
      if (!parent) {
        if (activeOnly) continue;
        throw new AppError(409, 'Dynamic list contains an orphan option');
      }
      if (parent.parentKey) throw new AppError(409, 'Dynamic list is limited to one sub-item level');
      parent.subItems.push(node);
    }
  }
  const sort = (a, b) => a.itemOrder - b.itemOrder || a.key.localeCompare(b.key);
  roots.sort(sort);
  for (const root of roots) root.subItems.sort(sort);
  return roots;
}
function mapDefinition(row, items) {
  return {
    app: row.APP, code: row.LIST, title: row.TITLE || '', titleAr: row.TITLE_AR || '',
    description: row.DESCRIPTION || '', listType: row.TYPE || 'LOCAL', isSublist: row.IS_SUBLIST === true,
    allowMultiple: row.ALLOW_MULTIPLE === true, isRequired: row.IS_REQUIRED === true,
    defaultValue: row.DEFAULT_VALUE || '', active: row.ACTIVE_STATUS === true,
    items
  };
}

class DynamicListService {
  constructor({ getDb = () => cds.connect.to('db'), audit = new AuditService() } = {}) {
    this.getDb = getDb;
    this.audit = audit;
  }
  async header(app, listCode, db) {
    const rows = await db.run(`SELECT ${headCols} FROM ${HEAD} WHERE "APP" = $1 AND "LIST" = $2 LIMIT 2`, [app, listCode]);
    if (rows.length > 1) throw new AppError(409, 'Duplicate list definition; data repair required');
    return rows[0] || null;
  }
  async itemRows(app, listCode, db) {
    return db.run(`SELECT ${itemCols} FROM ${ITEM} WHERE "SERVICE_NAME" = $1 AND "LIST" = $2 ORDER BY "ITEM_ORDER" NULLS LAST, "KEY"`, [app, listCode]);
  }
  async getDefinition({ app, code: listCode }, { activeOnly = false, db = null } = {}) {
    app = code(app, 'app'); listCode = code(listCode, 'code');
    const connection = db || await this.getDb();
    const head = await this.header(app, listCode, connection);
    if (!head || (activeOnly && !validAt(head))) throw new AppError(404, 'Dynamic list not found');
    const items = toTree(await this.itemRows(app, listCode, connection), activeOnly);
    const result = mapDefinition(head, items);
    if (activeOnly && result.defaultValue && !items.some(x => x.key === result.defaultValue || x.subItems.some(y => y.key === result.defaultValue))) {
      result.defaultValue = '';
    }
    return result;
  }
  async getList(data) { return this.getDefinition(data, { activeOnly: true }); }
  async getDefinitions({ limit, offset }) {
    const size = v.int(limit, 'limit', 50, 1, 100);
    const skip = v.int(offset, 'offset', 0, 0, 100000);
    const db = await this.getDb();
    const [countRows, heads] = await Promise.all([
      db.run(`SELECT COUNT(*)::integer AS total FROM ${HEAD}`),
      db.run(`SELECT ${headCols} FROM ${HEAD} ORDER BY "APP", "LIST" LIMIT $1 OFFSET $2`, [size, skip])
    ]);
    return { total: Number(countRows[0]?.total ?? 0), lists: heads.map(row => mapDefinition(row, [])) };
  }
  async saveDefinition(data, req) {
    const app = code(data.app, 'app'); const listCode = code(data.code, 'code');
    const title = label(data.title, 'title', 250);
    const titleAr = label(data.titleAr, 'titleAr', 250, false) || '';
    const description = data.description ? label(data.description, 'description', 2000) : '';
    if (data.listType && data.listType !== 'LOCAL') throw new AppError(400, 'Only LOCAL list type is supported in this release');
    const active = bool(data.active, 'active', true);
    const isSublist = bool(data.isSublist, 'isSublist', false);
    const allowMultiple = bool(data.allowMultiple, 'allowMultiple', false);
    const isRequired = bool(data.isRequired, 'isRequired', false);
    const defaultValue = data.defaultValue ? key(data.defaultValue, 'defaultValue') : '';
    const db = await this.getDb();
    return db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [`dynamic-list:${app}:${listCode}`]);
      const existing = await this.header(app, listCode, tx);
      if (defaultValue) {
        const found = (await this.itemRows(app, listCode, tx)).some(row => row.KEY === defaultValue && validAt(row));
        if (!found) throw new AppError(400, 'Default option must be an active item in this list');
      }
      const actor = req?.mawaniActor?.UUID || null;
      const values = [title, titleAr, description, isSublist, allowMultiple, isRequired, defaultValue || null, active, actor];
      if (existing) {
        await tx.run(`UPDATE ${HEAD} SET "TITLE"=$1, "TITLE_AR"=$2, "DESCRIPTION"=$3, "TYPE"='LOCAL', "IS_SUBLIST"=$4, "ALLOW_MULTIPLE"=$5, "IS_REQUIRED"=$6, "DEFAULT_VALUE"=$7, "ACTIVE_STATUS"=$8, "CHANGED_BY"=$9::uuid, "CHANGED_ON"=CURRENT_TIMESTAMP WHERE "RID"=$10::uuid`, [...values, existing.RID]);
      } else {
        await tx.run(`INSERT INTO ${HEAD} ("RID", "APP", "LIST", "TITLE", "TITLE_AR", "DESCRIPTION", "TYPE", "SOURCE_CONFIG", "IS_SUBLIST", "ALLOW_MULTIPLE", "IS_REQUIRED", "DEFAULT_VALUE", "ACTIVE_STATUS", "CREATED_BY", "CREATED_ON") VALUES ($1::uuid,$2,$3,$4,$5,$6,'LOCAL',NULL,$7,$8,$9,$10,$11,$12::uuid,CURRENT_TIMESTAMP)`, [randomUUID(), app, listCode, title, titleAr, description, isSublist, allowMultiple, isRequired, defaultValue || null, active, actor]);
      }
      await this.audit.record(req, existing ? 'CONFIG_LIST_UPDATE' : 'CONFIG_LIST_CREATE', 'CONFIG_TBL_APPLICATIONS_LISTS', `${app}/${listCode}`, 'SUCCESS', 'Dynamic list definition saved', tx);
      return this.getDefinition({ app, code: listCode }, { db: tx });
    });
  }
  async saveItem(data, req) {
    const app = code(data.app, 'app'); const listCode = code(data.code, 'code');
    const itemKey = key(data.key);
    const title = label(data.title, 'title', 500);
    const titleAr = label(data.titleAr, 'titleAr', 500, false) || '';
    const parentKey = data.parentKey ? key(data.parentKey, 'parentKey') : '';
    if (parentKey === itemKey) throw new AppError(400, 'An item cannot be its own parent');
    const itemOrder = v.int(data.itemOrder, 'itemOrder', 0, 0, 100000);
    const active = bool(data.active, 'active', true);
    const icon = data.icon ? label(data.icon, 'icon', 150) : '';
    const uiColor = data.uiColor ? label(data.uiColor, 'uiColor', 50) : '';
    const db = await this.getDb();
    return db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [`dynamic-list:${app}:${listCode}`]);
      const head = await this.header(app, listCode, tx);
      if (!head) throw new AppError(404, 'Create the list definition before adding options');
      const rows = await this.itemRows(app, listCode, tx);
      const duplicates = rows.filter(row => row.KEY === itemKey);
      if (duplicates.length > 1) throw new AppError(409, 'Duplicate option key');
      const existing = duplicates[0];
      if (parentKey) {
        const parent = rows.find(row => row.KEY === parentKey);
        if (!parent) throw new AppError(400, 'Parent option does not exist');
        if (jsonObject(parent.EXTRA_DATA).parentKey) throw new AppError(400, 'Only one sub-item level is supported');
      }
      if (rows.some(row => jsonObject(row.EXTRA_DATA).parentKey === itemKey) && parentKey) {
        throw new AppError(400, 'An option that has children cannot become a sub-item');
      }
      const actor = req?.mawaniActor?.UUID || null;
      const values = [title, titleAr, itemOrder, icon || null, uiColor || null, active, actor];
      if (existing) {
        // Preserve all other EXTRA_DATA JSON keys; change parentKey only.
        const metadata = { ...jsonObject(existing.EXTRA_DATA) };
        if (parentKey) metadata.parentKey = parentKey;
        else delete metadata.parentKey;
        await tx.run(`UPDATE ${ITEM} SET "TITLE"=$1, "TITLE_AR"=$2, "ITEM_ORDER"=$3, "ICON"=$4, "UI_COLOR"=$5, "ACTIVE_STATUS"=$6, "CHANGED_BY"=$7::uuid, "CHANGED_ON"=CURRENT_TIMESTAMP, "EXTRA_DATA"=$8::jsonb WHERE "RID"=$9::uuid`, [...values, JSON.stringify(metadata), existing.RID]);
      } else {
        await tx.run(`INSERT INTO ${ITEM} ("RID", "SERVICE_NAME", "LIST", "KEY", "TITLE", "TITLE_AR", "ITEM_ORDER", "ICON", "UI_COLOR", "ACTIVE_STATUS", "EXTRA_DATA", "CREATED_BY", "CREATED_ON") VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::uuid,CURRENT_TIMESTAMP)`, [randomUUID(), app, listCode, itemKey, title, titleAr, itemOrder, icon || null, uiColor || null, active, JSON.stringify(parentKey ? { parentKey } : {}), actor]);
      }
      await this.audit.record(req, existing ? 'CONFIG_LIST_ITEM_UPDATE' : 'CONFIG_LIST_ITEM_CREATE', 'CONFIG_TBL_APPLICATIONS_LISTS_I', `${app}/${listCode}/${itemKey}`, 'SUCCESS', 'Dynamic list option saved', tx);
      const result = await this.getDefinition({ app, code: listCode }, { db: tx });
      return [...result.items.flatMap(item => [item, ...item.subItems])].find(item => item.key === itemKey) || null;
    });
  }
  async setDefinitionActive({ app, code: listCode, active }, req) {
    return this.modifyStatus({ app, code: listCode, active }, null, req);
  }
  async setItemActive({ app, code: listCode, key: itemKey, active }, req) {
    return this.modifyStatus({ app, code: listCode, active }, itemKey, req);
  }
  async modifyStatus(data, itemKey, req) {
    const app = code(data.app, 'app'); const listCode = code(data.code, 'code');
    const active = v.boolean(data.active, 'active');
    const db = await this.getDb();
    return db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [`dynamic-list:${app}:${listCode}`]);
      const head = await this.header(app, listCode, tx);
      if (!head) throw new AppError(404, 'Dynamic list not found');
      if (itemKey) {
        itemKey = key(itemKey);
        const items = await this.itemRows(app, listCode, tx);
        const item = items.find(row => row.KEY === itemKey);
        if (!item) throw new AppError(404, 'Option not found');
        if (active && jsonObject(item.EXTRA_DATA).parentKey) {
          const parent = items.find(row => row.KEY === jsonObject(item.EXTRA_DATA).parentKey);
          if (!parent || !validAt(parent)) throw new AppError(400, 'Activate the parent option first');
        }
        await tx.run(`UPDATE ${ITEM} SET "ACTIVE_STATUS"=$1, "CHANGED_BY"=$2::uuid, "CHANGED_ON"=CURRENT_TIMESTAMP WHERE "RID"=$3::uuid`, [active, req?.mawaniActor?.UUID || null, item.RID]);
        await this.audit.record(req, 'CONFIG_LIST_ITEM_STATUS', 'CONFIG_TBL_APPLICATIONS_LISTS_I', `${app}/${listCode}/${itemKey}`, 'SUCCESS', `Option active=${active}`, tx);
        const result = await this.getDefinition({ app, code: listCode }, { db: tx });
        return result.items.flatMap(node => [node, ...node.subItems]).find(node => node.key === itemKey) || null;
      }
      await tx.run(`UPDATE ${HEAD} SET "ACTIVE_STATUS"=$1, "CHANGED_BY"=$2::uuid, "CHANGED_ON"=CURRENT_TIMESTAMP WHERE "RID"=$3::uuid`, [active, req?.mawaniActor?.UUID || null, head.RID]);
      await this.audit.record(req, 'CONFIG_LIST_STATUS', 'CONFIG_TBL_APPLICATIONS_LISTS', `${app}/${listCode}`, 'SUCCESS', `List active=${active}`, tx);
      return this.getDefinition({ app, code: listCode }, { db: tx });
    });
  }
}
module.exports = DynamicListService;
module.exports._test = { code, key, toTree, validAt, mapDefinition };
