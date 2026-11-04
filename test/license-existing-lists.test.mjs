import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/services/licenseListsApi.js', import.meta.url), 'utf8')
const {getLicenseList} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
function definition(code, items, extra={}) {return {app:'PORTAL',code,active:true,items,...extra}}
function item(key, order, extra={}) {return {key,title:`EN ${key}`,titleAr:`AR ${key}`,itemOrder:order,active:true,subItems:[],...extra}}
const reply = data=>({ok:true,status:200,json:async()=>data})
const originalFetch = globalThis.fetch
try {
  await test('frontend reads the existing /lists/getList endpoint and maps Arabic/English titles', async ()=>{
    const called=[]
    globalThis.fetch=async (url,opts)=>{called.push([url,opts]);return reply(definition('LICENSE_TYPE',[item('B',2),item('A',1)]))}
    const result=await getLicenseList('LICENSE_TYPE')
    assert.equal(called[0][0],"/lists/getList(app='PORTAL',code='LICENSE_TYPE')")
    assert.equal(called[0][1].credentials,'same-origin')
    assert.deepEqual(result.map(i=>i.key),['A','B'])
    assert.equal(result[0].title,'EN A')
    assert.equal(result[0].titleAr,'AR A')
  })
  await test('frontend excludes inactive options including children',async()=>{
    globalThis.fetch=async()=>reply(definition('SERVICE_TYPE',[item('OFF',0,{active:false,subItems:[item('CHILD',1)]}),item('ON',1,{subItems:[item('SUB',0)]})]))
    assert.deepEqual((await getLicenseList('SERVICE_TYPE')).map(i=>i.key),['ON','SUB'])
  })
  await test('inactive list produces no options',async()=>{
    globalThis.fetch=async()=>reply(definition('INVESTOR_TYPE',[item('SA',0)],{active:false}))
    assert.deepEqual(await getLicenseList('INVESTOR_TYPE'),[])
  })
  await test('frontend fails closed on unexpected response',async()=>{
    globalThis.fetch=async()=>reply({value:[{key:'UNSAFE'}]})
    await assert.rejects(getLicenseList('LICENSE_TYPE'),/unexpected response/)
  })
} finally { globalThis.fetch=originalFetch }
