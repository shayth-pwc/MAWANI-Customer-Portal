import test from 'node:test'
import assert from 'node:assert/strict'
import { getDefinition, getPublicList, listAction } from '../src/services/adminListsApi.js'

const jsonHeaders = new Headers({'content-type':'application/json'})
const response = (body, status = 200, csrf = null) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get(name) { return name.toLowerCase() === 'x-csrf-token' ? csrf : jsonHeaders.get(name) } },
  async json() { return body },
})
test('read-only list query uses same-origin and app+list keys', async () => {
  let args
  const data = {app:'PORTAL',code:'PORTS',items:[{key:'JUBAIL',subItems:[{key:'JUBAIL_EAST'}]}]}
  const result = await getPublicList('PORTAL','PORTS',async (...params) => { args=params; return response({value:data}) })
  assert.equal(args[0],"/lists/getList(app='PORTAL',code='PORTS')")
  assert.equal(args[1].credentials,'same-origin')
  assert.equal(result.items[0].subItems[0].key,'JUBAIL_EAST')
})
test('admin writes require CSRF and never submit if token is absent', async () => {
  let writes=0
  await assert.rejects(() => listAction('saveDefinition',{app:'PORTAL',code:'PORTS'}, async (path) => {
    if (path.includes('saveDefinition')) writes++
    return response({},200,null)
  }), /CSRF token missing/)
  assert.equal(writes,0)
})
test('admin save sends CSRF token and only allowed actions', async () => {
  const calls=[]
  const fetcher=async (path,opts) => { calls.push({path,opts}); return path.endsWith('$metadata') ? response({},200,'safe-token') : response({value:{app:'PORTAL',code:'PORTS'}}) }
  const result=await listAction('saveDefinition',{app:'PORTAL',code:'PORTS'},fetcher)
  assert.equal(result.code,'PORTS')
  assert.equal(calls[1].opts.headers['X-CSRF-Token'],'safe-token')
  await assert.rejects(()=>listAction('deleteEverything',{},fetcher),/Unsupported/)
})
test('getDefinition treats server values as data, not HTML', async () => {
  const value=await getDefinition('PORTAL','PORTS',async()=>response({value:{code:'PORTS',title:'<script>alert(1)</script>'}}))
  assert.equal(value.title,'<script>alert(1)</script>')
})
