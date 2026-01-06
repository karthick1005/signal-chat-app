import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '../login-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('LoginForm', () => {
  it('renders login form', () => {
    render(<LoginForm />);
    expect(screen.getByText(/welcome to/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in to your account/i })).toBeInTheDocument();
  });

  it('submits form with username', () => {
    render(<LoginForm />);
    const input = screen.getByLabelText('Username');
    const button = screen.getByRole('button', { name: /log in to your account/i });

    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(button);

    // Mock fetch or check if called
  });
});
