import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PasswordInput from '../components/common/PasswordInput';

function renderPasswordInput() {
  const onChange = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <PasswordInput
        id="testPassword"
        label="Password"
        value="secret123"
        onChange={onChange}
        required
      />
      <button type="submit">Submit form</button>
    </form>,
  );
  return { onChange };
}

describe('PasswordInput', () => {
  it('password is hidden by default', () => {
    renderPasswordInput();
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
  });

  it('clicking eye shows password', async () => {
    renderPasswordInput();
    await userEvent.setup().click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'text');
  });

  it('clicking eye hides password', async () => {
    renderPasswordInput();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /show password/i }));
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
  });

  it('eye button does not submit form', async () => {
    const submitHandler = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submitHandler}>
        <PasswordInput id="pw" label="Password" value="" onChange={() => {}} />
      </form>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /show password/i }));
    expect(submitHandler).not.toHaveBeenCalled();
  });

  it('accessible label changes appropriately', async () => {
    renderPasswordInput();
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
