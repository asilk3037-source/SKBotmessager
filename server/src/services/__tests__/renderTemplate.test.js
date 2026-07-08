import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../renderTemplate.js';

describe('renderTemplate', () => {
  it('replaces the built-in nome and telefone variables', () => {
    const contact = { name: 'Joao', phone: '11988887777' };
    expect(renderTemplate('Ola {{nome}}, seu telefone e {{telefone}}', contact)).toBe(
      'Ola Joao, seu telefone e 11988887777'
    );
  });

  it('is case-insensitive and tolerates spaces inside braces', () => {
    const contact = { name: 'Joao', phone: '123' };
    expect(renderTemplate('{{ Nome }} / {{TELEFONE}}', contact)).toBe('Joao / 123');
  });

  it('replaces extra columns from contact.extras case-insensitively', () => {
    const contact = { name: 'Joao', phone: '123', extras: { Cidade: 'SP' } };
    expect(renderTemplate('Voce mora em {{cidade}}', contact)).toBe('Voce mora em SP');
  });

  it('leaves unknown variables untouched', () => {
    const contact = { name: 'Joao', phone: '123', extras: {} };
    expect(renderTemplate('{{inexistente}}', contact)).toBe('{{inexistente}}');
  });

  it('handles missing name/phone/extras gracefully', () => {
    const contact = {};
    expect(renderTemplate('{{nome}}-{{telefone}}-{{cidade}}', contact)).toBe('--{{cidade}}');
  });

  it('replaces multiple occurrences of the same variable', () => {
    const contact = { name: 'Joao' };
    expect(renderTemplate('{{nome}} {{nome}} {{nome}}', contact)).toBe('Joao Joao Joao');
  });

  it('returns content unchanged when there are no variables', () => {
    expect(renderTemplate('mensagem fixa sem variaveis', { name: 'Joao' })).toBe(
      'mensagem fixa sem variaveis'
    );
  });
});
