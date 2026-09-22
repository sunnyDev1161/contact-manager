import { money, downloadCsv } from '../src/format'

describe('money', () => {
  it('formats a number with the Rs. prefix and 2 decimals', () => {
    expect(money(220)).toBe('Rs. 220.00')
    expect(money(0)).toBe('Rs. 0.00')
    expect(money(19.999)).toBe('Rs. 20.00')
    expect(money('150.5')).toBe('Rs. 150.50')
  })
})

describe('downloadCsv', () => {
  let clickSpy
  const realCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    clickSpy = jest.fn()
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag)
      el.click = clickSpy
      return el
    })
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('builds a CSV with a header row and escapes commas/quotes', () => {
    let capturedBlobParts
    const originalBlob = global.Blob
    global.Blob = class MockBlob {
      constructor(parts) { capturedBlobParts = parts }
    }

    downloadCsv('test.csv', [
      ['Name', r => r.name],
      ['Note', r => r.note]
    ], [
      { name: 'Malik Store', note: 'has, a comma' },
      { name: 'Quote "Shop"', note: null }
    ])

    const csv = capturedBlobParts[0]
    expect(csv).toContain('Name,Note')
    expect(csv).toContain('Malik Store,"has, a comma"')
    expect(csv).toContain('"Quote ""Shop"""')
    expect(clickSpy).toHaveBeenCalled()

    global.Blob = originalBlob
  })
})
