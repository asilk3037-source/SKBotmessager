import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatesPage from '../TemplatesPage.jsx';
import { ToastProvider } from '../../components/ToastProvider.jsx';
import { api } from '../../api.js';

vi.mock('../../api.js', () => ({
  api: {
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn()
  }
}));

const TEMPLATE = {
  id: 't1',
  name: 'Boas vindas',
  content: 'Ola {{nome}}',
  subject: '',
  channel: 'sms',
  isDefault: false
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listTemplates.mockResolvedValue([]);
});

describe('TemplatesPage', () => {
  it('shows the empty state when there are no templates', async () => {
    render(<TemplatesPage />);
    await waitFor(() => expect(screen.getByText(/nenhum template criado ainda/i)).toBeInTheDocument());
  });

  it('lists existing templates with their channel label', async () => {
    api.listTemplates.mockResolvedValue([TEMPLATE]);
    render(<TemplatesPage />);

    await waitFor(() => expect(screen.getByText('Boas vindas')).toBeInTheDocument());
    expect(screen.getByText('SMS')).toBeInTheDocument();
  });

  it('shows the subject field when the channel is "any" (the default) or "email"', async () => {
    render(<TemplatesPage />);
    // Default channel is "any", which counts as using email.
    expect(screen.getByLabelText(/assunto do email/i)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'sms');
    expect(screen.queryByLabelText(/assunto do email/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'email');
    expect(screen.getByLabelText(/assunto do email/i)).toBeInTheDocument();
  });

  it('creates a new template with the form values and reloads the list', async () => {
    api.createTemplate.mockResolvedValue({ id: 'new' });
    render(<TemplatesPage />);

    await userEvent.type(screen.getByLabelText(/nome do template/i), 'Promo');
    // user-event's .type() treats "{" as special-key syntax (needs doubling per literal brace);
    // "}" has no special meaning on its own and is typed as-is.
    await userEvent.type(screen.getByLabelText(/^mensagem$/i), 'Ola {{{{nome}}');
    await userEvent.click(screen.getByRole('button', { name: /criar template/i }));

    await waitFor(() =>
      expect(api.createTemplate).toHaveBeenCalledWith({
        name: 'Promo',
        content: 'Ola {{nome}}',
        subject: '',
        channel: 'any',
        isDefault: false
      })
    );
    // Form resets and the list reloads after a successful create.
    await waitFor(() => expect(screen.getByLabelText(/nome do template/i)).toHaveValue(''));
    expect(api.listTemplates).toHaveBeenCalledTimes(2);
  });

  it('inserts a {{variavel}} tag into the message when its chip is clicked', async () => {
    const { container } = render(<TemplatesPage />);
    // "{{nome}}" also appears in the page's intro <code> snippet, so scope to the clickable chip.
    await userEvent.click(container.querySelector('.tag'));
    expect(screen.getByLabelText(/^mensagem$/i)).toHaveValue('{{nome}}');
  });

  it('shows a submit error without clearing the form', async () => {
    api.createTemplate.mockRejectedValue(new Error('Nome e conteúdo são obrigatórios.'));
    render(<TemplatesPage />);

    await userEvent.type(screen.getByLabelText(/nome do template/i), 'Promo');
    await userEvent.type(screen.getByLabelText(/^mensagem$/i), 'Oi');
    await userEvent.click(screen.getByRole('button', { name: /criar template/i }));

    await waitFor(() => expect(screen.getByText('Nome e conteúdo são obrigatórios.')).toBeInTheDocument());
    expect(screen.getByLabelText(/nome do template/i)).toHaveValue('Promo');
  });

  it('populates the form for editing and submits an update instead of a create', async () => {
    api.listTemplates.mockResolvedValue([TEMPLATE]);
    api.updateTemplate.mockResolvedValue(TEMPLATE);
    render(<TemplatesPage />);

    await waitFor(() => screen.getByText('Boas vindas'));
    await userEvent.click(screen.getByRole('button', { name: /editar/i }));

    expect(screen.getByLabelText(/nome do template/i)).toHaveValue('Boas vindas');
    expect(screen.getByRole('heading', { name: /editar template/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() =>
      expect(api.updateTemplate).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: 'Boas vindas' })
      )
    );
  });

  it('cancelling an edit resets the form back to "Novo template"', async () => {
    api.listTemplates.mockResolvedValue([TEMPLATE]);
    render(<TemplatesPage />);

    await waitFor(() => screen.getByText('Boas vindas'));
    await userEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByRole('heading', { name: /editar template/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancelar edição/i }));

    expect(screen.getByRole('heading', { name: /novo template/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nome do template/i)).toHaveValue('');
  });

  it('shows a toast confirmation after successfully creating a template', async () => {
    api.createTemplate.mockResolvedValue({ id: 'new' });
    render(
      <ToastProvider>
        <TemplatesPage />
      </ToastProvider>
    );

    await userEvent.type(screen.getByLabelText(/nome do template/i), 'Promo');
    await userEvent.type(screen.getByLabelText(/^mensagem$/i), 'Ola');
    await userEvent.click(screen.getByRole('button', { name: /criar template/i }));

    await waitFor(() => expect(screen.getByText('Template criado.')).toBeInTheDocument());
  });

  it('deletes a template after confirmation', async () => {
    api.listTemplates.mockResolvedValue([TEMPLATE]);
    api.deleteTemplate.mockResolvedValue(null);
    render(<TemplatesPage />);

    await waitFor(() => screen.getByText('Boas vindas'));
    await userEvent.click(screen.getByRole('button', { name: /remover/i }));

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover' }));

    expect(api.deleteTemplate).toHaveBeenCalledWith('t1');
  });

  it('shows the "Padrão" badge only for default templates', async () => {
    api.listTemplates.mockResolvedValue([{ ...TEMPLATE, isDefault: true }]);
    const { container } = render(<TemplatesPage />);

    // "Padrão" also names the table column header, so scope to the badge element itself.
    await waitFor(() => expect(container.querySelector('.badge-success')).toHaveTextContent('Padrão'));
  });
});
