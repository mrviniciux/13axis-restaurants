'use client';

import { useOrdersTables, useOrdersTablesActions } from '@/store';
import { useOrdersTablesApi } from '@/hooks';

export function PropertiesPanel({ userId }: Readonly<{ userId: string }>) {
  const { view, preferenceStatus, comandaNumbers, comandaNumbersError, comandaNumbersStatus } =
    useOrdersTables((state) => ({
      view: state.view,
      preferenceStatus: state.preferenceStatus,
      comandaNumbers: state.comandaNumbers,
      comandaNumbersError: state.comandaNumbersError,
      comandaNumbersStatus: state.comandaNumbersStatus,
    }));
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();

  return (
    <fieldset
      aria-describedby={`view-preference-status-${userId}`}
      className="view-preferences"
      id="tables-comandas-properties"
      disabled={preferenceStatus === 'saving'}
    >
      <legend>Propriedades da visualização</legend>
      <p>
        Escolha como mesas e comandas devem aparecer para sua conta. Nas visões com comandas, use as
        abas para alternar entre mapa, cards, detalhamento e large cards.
      </p>
      <div className="view-preference-options">
        <ViewPreferenceOption
          checked={view === 'COMANDA'}
          description="Exibe comandas abertas e seus itens."
          label="Comanda"
          name={`tables-comandas-view-${userId}`}
          onSelect={() => void api.saveViewPreference('COMANDA')}
          value="COMANDA"
        />
        <ViewPreferenceOption
          checked={view === 'MESA'}
          description="Exibe a situação e a capacidade das mesas, sem comandas."
          label="Mesa"
          name={`tables-comandas-view-${userId}`}
          onSelect={() => void api.saveViewPreference('MESA')}
          value="MESA"
        />
        <ViewPreferenceOption
          checked={view === 'MESA_E_COMANDA'}
          description="Exibe mesas e comandas lado a lado."
          label="Mesa + comanda"
          name={`tables-comandas-view-${userId}`}
          onSelect={() => void api.saveViewPreference('MESA_E_COMANDA')}
          value="MESA_E_COMANDA"
        />
      </div>
      <div className="comanda-number-settings">
        <label htmlFor="comanda-numbers-input">Números de comanda</label>
        <textarea
          aria-describedby="comanda-numbers-help comanda-numbers-feedback"
          id="comanda-numbers-input"
          maxLength={10_000}
          onChange={(event) => {
            actions.setComandaNumbers(event.target.value);
            actions.setComandaNumbersStatus('idle');
            actions.setComandaNumbersError('');
          }}
          rows={3}
          value={comandaNumbers}
        />
        <div className="comanda-numbers-help" id="comanda-numbers-help">
          <span>Informe números separados por vírgula ou faixas entre chaves. Exemplos:</span>
          <code>{'{1-30}'}</code>
          <code>{'[{1-30}, 50, 60, 90]'}</code>
          <code>1,2,3,4,5,6</code>
          <small>
            Lista compartilhada no restaurante. Não há limite de quantidade; a grade pagina a cada
            100 números. Números individuais vão de 1 a 2.147.483.647.
          </small>
        </div>
        <div className="comanda-number-save-row">
          <button
            className="secondary-button"
            disabled={comandaNumbersStatus === 'saving'}
            onClick={() => void api.saveComandaNumbers()}
            type="button"
          >
            {comandaNumbersStatus === 'saving' ? 'Salvando…' : 'Salvar números'}
          </button>
          <p
            className={
              comandaNumbersStatus === 'error'
                ? 'preference-feedback action-error'
                : 'preference-feedback'
            }
            id="comanda-numbers-feedback"
            role={comandaNumbersStatus === 'error' ? 'alert' : 'status'}
          >
            {comandaNumbersError ||
              (comandaNumbersStatus === 'saved' ? 'Lista compartilhada salva.' : '')}
          </p>
        </div>
      </div>
      <p
        className={
          preferenceStatus === 'error' ? 'preference-feedback action-error' : 'preference-feedback'
        }
        id={`view-preference-status-${userId}`}
        role={preferenceStatus === 'error' ? 'alert' : 'status'}
      >
        {preferenceStatus === 'saving'
          ? 'Salvando preferência…'
          : preferenceStatus === 'saved'
            ? 'Preferência salva para seu usuário.'
            : preferenceStatus === 'error'
              ? 'Não foi possível salvar. Tente novamente.'
              : ''}
      </p>
    </fieldset>
  );
}

function ViewPreferenceOption({
  checked,
  name,
  value,
  label,
  description,
  onSelect,
}: Readonly<{
  checked: boolean;
  name: string;
  value: 'COMANDA' | 'MESA' | 'MESA_E_COMANDA';
  label: string;
  description: string;
  onSelect: () => void;
}>) {
  return (
    <label className="view-preference-option">
      <input checked={checked} name={name} onChange={onSelect} type="radio" value={value} />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}
