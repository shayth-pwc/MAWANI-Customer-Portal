// Reuse the EXISTING portal ListService: no /licenses-api list endpoints and no list writes.
const APP = 'PORTAL'
function literal(value) { return String(value).replace(/'/g, "''") }
function sortByOrder(items) {
  return [...items].sort((a, b) => (Number(a.itemOrder) || 0) - (Number(b.itemOrder) || 0))
}
function selectableItems(items) {
  const result = []
  function visit(group, namePrefix = '', nameArPrefix = '') {
    for (const item of sortByOrder(group)) {
      if (!item || item.active === false || typeof item.key !== 'string' || !item.key) continue
      const title = String(item.title || item.key)
      const titleAr = String(item.titleAr || item.title || item.key)
      result.push({
        key: item.key, title: namePrefix ? `${namePrefix} / ${title}` : title,
        titleAr: nameArPrefix ? `${nameArPrefix} / ${titleAr}` : titleAr,
        itemOrder: Number(item.itemOrder) || 0, parentKey: item.parentKey || ''
      })
      if (Array.isArray(item.subItems)) {
        visit(item.subItems, namePrefix ? `${namePrefix} / ${title}` : title,
          nameArPrefix ? `${nameArPrefix} / ${titleAr}` : titleAr)
      }
    }
  }
  visit(items)
  return result
}

export async function getLicenseList(code) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) throw new Error('Invalid dynamic list code')
  const url = `/lists/getList(app='${literal(APP)}',code='${literal(code)}')`
  const response = await fetch(url, { credentials: 'same-origin' })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error?.message || `Dynamic list ${code} failed (${response.status})`)
  }
  const definition = data?.value && !Array.isArray(data.value) ? data.value : data
  if (!definition || !Array.isArray(definition.items) ||
      (definition.app && definition.app !== APP) ||
      (definition.code && definition.code !== code)) {
    throw new Error(`Dynamic list ${code} returned an unexpected response`)
  }
  if (definition.active === false) return []
  return selectableItems(definition.items)
}
