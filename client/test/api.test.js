import { resolveBaseUrl } from '../src/api'

describe('resolveBaseUrl', () => {
  it('falls back to a relative /api when no URL is configured', () => {
    expect(resolveBaseUrl(undefined)).toBe('/api')
    expect(resolveBaseUrl('')).toBe('/api')
  })

  it('adds https:// when the given URL has no protocol', () => {
    expect(resolveBaseUrl('api.example.com')).toBe('https://api.example.com/api')
  })

  it('keeps an explicit protocol as-is', () => {
    expect(resolveBaseUrl('http://localhost:4000')).toBe('http://localhost:4000/api')
  })

  it('strips a trailing slash before appending /api', () => {
    expect(resolveBaseUrl('https://api.example.com/')).toBe('https://api.example.com/api')
  })
})

describe('api client', () => {
  beforeEach(() => {
    jest.resetModules()
    localStorage.clear()
  })

  it('attaches a Bearer token from localStorage to outgoing requests', async () => {
    localStorage.setItem('pos_token', 'abc123')
    const api = require('../src/api').default
    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('does not set an Authorization header when there is no token', async () => {
    const api = require('../src/api').default
    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })

  // jsdom's `window.location` is non-configurable and its navigation setter
  // is a documented no-op ("not implemented: navigation") rather than an
  // actual page change, so the href it ends up with can't be asserted
  // directly here. What's observable and worth testing is the two branches
  // of api.js's own logic: whether it attempts a redirect at all (jsdom
  // logs that attempt) and, either way, that storage is always cleared.
  it('clears storage and attempts a redirect to /login on a 401 response when not already there', async () => {
    localStorage.setItem('pos_token', 'abc123')
    localStorage.setItem('pos_user', '{"name":"x"}')
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const api = require('../src/api').default
    await expect(
      api.interceptors.response.handlers[0].rejected({ response: { status: 401 } })
    ).rejects.toBeTruthy()

    expect(localStorage.getItem('pos_token')).toBeNull()
    expect(localStorage.getItem('pos_user')).toBeNull()
    // jsdom's default test URL is not /login, so api.js's own pathname
    // check should have attempted a navigation (jsdom logs it as an error).
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'not implemented' }))
    errorSpy.mockRestore()
  })

  it('does not attempt a redirect if already on the login page', async () => {
    window.history.pushState({}, '', '/login')
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const api = require('../src/api').default
    await expect(
      api.interceptors.response.handlers[0].rejected({ response: { status: 401 } })
    ).rejects.toBeTruthy()

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('passes through a non-401 error unchanged', async () => {
    const api = require('../src/api').default
    await expect(
      api.interceptors.response.handlers[0].rejected({ response: { status: 500 } })
    ).rejects.toEqual({ response: { status: 500 } })
  })
})
