import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NumericKeypad from '../src/components/NumericKeypad'

describe('NumericKeypad', () => {
  it('appends a digit to the current value', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<NumericKeypad value="1" onChange={onChange} />)
    await user.click(screen.getByText('2'))
    expect(onChange).toHaveBeenCalledWith('12')
  })

  it('backspaces the last character', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<NumericKeypad value="12" onChange={onChange} />)
    await user.click(screen.getByText('⌫'))
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('does not allow a second decimal point', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<NumericKeypad value="1.5" onChange={onChange} />)
    await user.click(screen.getByText('.'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does nothing when disabled', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<NumericKeypad value="1" onChange={onChange} disabled />)
    await user.click(screen.getByText('2'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders a confirm button with a custom label and calls onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = jest.fn()
    render(<NumericKeypad value="5" onChange={() => {}} onConfirm={onConfirm} confirmLabel="Set Qty" />)
    await user.click(screen.getByText('Set Qty'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('omits the confirm button when onConfirm is not provided', () => {
    render(<NumericKeypad value="5" onChange={() => {}} />)
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })
})
