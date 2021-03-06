import test from 'tape'
import sinon from 'sinon'
import Promise from 'bluebird'
import OBM from '../lib'

const nr = 6
const userId = 11

const noop = () => undefined
const $ = global.$ = {
  ajax: opts => {
    setTimeout(() => opts.success({ nr: 0, included: false, actions: '' }), 20)
  },
  cookie: noop
}

test('mock', function (t) {
  const obm = new OBM(nr, userId)
  const included = true
  const actions = 'manager,blue'
  obm.mock({ included, actions })

  t.equal(obm.obmData.included, included, 'data prop check')
  t.equal(obm.obmData.actions, actions, 'data prop check')
  t.end()
})

test('isIncluded', function (t) {
  const obm = new OBM(nr, userId)

  obm.mock({ included: true })
  t.ok(obm.isIncluded(), 'should return true if included')

  obm.mock({ included: false })
  t.notOk(obm.isIncluded(), 'should return false if excluded')

  t.end()
})

test('isExcluded', function (t) {
  const obm = new OBM(nr, userId)

  obm.mock({ included: true })
  t.notOk(obm.isExcluded(), 'should return false if included')

  obm.mock({ included: false })
  t.ok(obm.isExcluded(), 'should return true if excluded')

  t.end()
})

test('getActionExists', function (t) {
  const obm = new OBM(nr, userId)

  obm.mock({ actions: '' })
  t.notOk(
    obm.getActionExists('blue'),
    'should return false if doesnt exist'
  )

  obm.mock({ actions: 'blue' })
  t.ok(
    obm.getActionExists('blue'),
    'should return true if exists'
  )

  obm.mock({ actions: 'blue,red' })
  t.ok(
    obm.getActionExists('blue'),
    'should return true if exists and mult actions'
  )
  t.ok(
    obm.getActionExists('red'),
    'should return true if exists and mult actions'
  )
  t.notOk(
    obm.getActionExists('green'),
    'should return false if doesnt exist and mult actions'
  )

  t.end()
})

test('getStorageKey', function (t) {
  let obm = new OBM(nr, userId)
  t.equal(
    obm.getStorageKey('shown'),
    `obm${ nr }_shown_${ userId }`,
    'should return nr and userId dependent key'
  )
  t.end()
})

const cookieMock = function () {
  const store = {}
  return function (key, value) {
    if (value == null) {
      return store[key]
    } else {
      store[key] = String(value)
    }
  }
}

test('getData/saveData', function (t) {
  $.cookie = cookieMock()
  let obm = new OBM(6, userId)
  const key = 'shown'

  t.equal(obm.getData(key), undefined,
    'should return `undefined` when nothing stored')

  obm.saveData(key, true)
  t.equal(obm.getData(key), 'true',
    'it should return the stored string')

  $.cookie = noop
  t.end()
})

test('getBool/saveBool', function (t) {
  $.cookie = cookieMock()
  let obm = new OBM(6, userId)
  const key = 'shown'

  t.equal(obm.getBool(key), false,
    'should return `false` when nothing stored')

  obm.saveData(key, true)
  t.equal(obm.getBool(key), true,
    'should return `true` when `true` was stored')

  obm.saveData(key, false)
  t.equal(obm.getBool(key), false,
    'should return `false` when `false` was stored')

  obm.saveData(key, 1)
  t.equal(obm.getBool(key), true,
    'should return `true` when `1` was stored')

  obm.saveData(key, 0)
  t.equal(obm.getBool(key), false,
    'should return `false` when `0` was stored')

  obm.saveBool(key, true)
  t.equal(obm.getBool(key), true,
    'should return `true` when used saveBool with `true`')

  obm.saveBool(key, false)
  t.equal(obm.getBool(key), false,
    'should return `false` when used saveBool with `false`')

  $.cookie = noop
  t.end()
})

test('dataExists', function (t) {
  $.cookie = cookieMock()
  let obm = new OBM(6, userId)
  const key = 'shown'

  t.equal(obm.dataExists(key), false,
    'should return `false` when nothing stored')

  obm.saveData(key, false)
  t.equal(obm.dataExists(key), true,
    'should return `false` when something stored')

  $.cookie = noop
  t.end()
})

test('getGroupString', function (t) {
  const obm = new OBM(6, userId)

  obm.mock({ included: true })
  t.equal(obm.getGroupString(), 'included',
    'should return "included" if included')

  obm.mock({ included: false })
  t.equal(obm.getGroupString(), 'excluded',
    'should return "excluded" if excluded')

  t.end()
})

test('sendAction', function (t) {
  sinon.stub($, 'ajax')
  const obm = new OBM(nr, userId)

  obm.mock({ included: true, actions: '' })
  obm.sendAction('seen', 3)
  t.equal($.ajax.callCount, 1, 'should perform ajax call')
  let callArgs = $.ajax.firstCall.args[0]
  t.equal(
    callArgs.data,
    '{"experiment_id":6,"key":"seen","value":"3"}',
    'with correct payload'
  )
  t.equal(
    callArgs.url,
    '/api/v9/obm/actions',
    'and to the right endpoint'
  )
  t.ok(obm.getActionExists('seen'), 'action should be saved locally')

  $.ajax.restore()
  t.end()
})

test('fetch', function (t) {
  t.plan(9)

  let res = { nr: 43, included: true, actions: 'manager-included' }
  let ajaxCalledCount = 0
  $.ajax = opts => {
    ++ajaxCalledCount
    setTimeout(() => {
      opts.success(res)
    }, 20)
  }

  Promise.resolve().then(() => {
    const obm = new OBM(44, userId)
    t.notOk(obm.obmData.fetched, 'initially data is not fetched')
    t.equal(ajaxCalledCount, 1, 'helper constructor triggers initial fetch')
    obm.fetch()
    t.equal(ajaxCalledCount, 2, 'it should trigger a re-fetch by default')
    const p = obm.fetch({ force: false })
    t.equal(ajaxCalledCount, 2,
      'during an on-going request, non-forced fetch should NOT re-fetch')
    t.ok(p instanceof Promise, 'it should return a promise')
    return p
  }).then(obm => {
    t.pass('promise for fetch that didnt cause re-fetch should still fulfill')
    t.ok(obm.obmData.fetched,
      'when getting server response should mark its data as fetched')
    t.notOk(obm.isIncluded() || obm.getActionExists('manager-included'),
      'it should NOT update its data if incoming data is NOT for the exp')
    res.nr = 44 // try now with response that matches exp number
    return obm.fetch()
  }).then(obm => {
    t.ok(obm.isIncluded() && obm.getActionExists('manager-included'),
      'it should update its data if incoming data is for the exp')
  })
})
