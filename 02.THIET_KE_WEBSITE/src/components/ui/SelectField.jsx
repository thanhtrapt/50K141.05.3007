import { useId } from 'react';

export default function SelectField({ label, error, options = [], id, className = '', ...selectProps }) {
  const generatedId = useId().replaceAll(':', '');
  const selectId = id ?? selectProps.name ?? `select-field-${generatedId}`;

  return (
    <div className={`field ${className}`.trim()}>
      {label && <label className="field__label" htmlFor={selectId}>{label}</label>}
      <select className={`field__control field__select${error ? ' field__control--error' : ''}`} id={selectId} aria-invalid={Boolean(error)} {...selectProps}>
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const text = typeof option === 'string' ? option : option.label;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
      {error && <small className="field__error">{error}</small>}
    </div>
  );
}
