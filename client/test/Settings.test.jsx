import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '../src/pages/Settings'

jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }))
import api from '../src/api'

const business = {
  name: 'Takbeer Traders', tagline: 'Trading • Supply', proprietors: 'A | B',
  address: 'Hassan Abdal', phone: '0300-1234567'
}

beforeEach(() => {
  jest.clearAllMocks()
  api.get.mockResolvedValue({ data: { business } })
  global.URL.createObjectURL = jest.fn(() => 'blob:mock')
  global.URL.revokeObjectURL = jest.fn()
})

describe('Settings page', () => {
  it('loads and displays the current business profile', async () => {
    render(<Settings />)
    expect(await screen.findByDisplayValue('Takbeer Traders')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Trading • Supply')).toBeInTheDocument()
  })

  it('saves changes to the profile', async () => {
    const user = userEvent.setup()
    api.put.mockResolvedValue({ data: { business } })
    render(<Settings />)
    await screen.findByDisplayValue('Takbeer Traders')

    const nameInput = screen.getByLabelText('Business name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/business', expect.objectContaining({ name: 'New Name' })))
    expect(await screen.findByText(/Saved\./)).toBeInTheDocument()
  })

  it('shows an error if loading the profile fails', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Failed to load' } } })
    render(<Settings />)
    expect(await screen.findByText('Failed to load')).toBeInTheDocument()
  })

  it('downloads a JSON backup', async () => {
    const user = userEvent.setup()
    api.get.mockImplementation((url) => {
      if (url === '/business/backup') return Promise.resolve({ data: { business, sales: [], products: [] } })
      return Promise.resolve({ data: { business } })
    })
    const clickSpy = jest.fn()
    const realCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    render(<Settings />)
    await screen.findByDisplayValue('Takbeer Traders')
    await user.click(screen.getByRole('button', { name: 'Download backup' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/business/backup'))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
  })

  it('shows an error if the backup download fails', async () => {
    const user = userEvent.setup()
    api.get.mockImplementation((url) => {
      if (url === '/business/backup') return Promise.reject({ response: { data: { error: 'Backup failed' } } })
      return Promise.resolve({ data: { business } })
    })
    render(<Settings />)
    await screen.findByDisplayValue('Takbeer Traders')
    await user.click(screen.getByRole('button', { name: 'Download backup' }))
    expect(await screen.findByText('Backup failed')).toBeInTheDocument()
  })
})
