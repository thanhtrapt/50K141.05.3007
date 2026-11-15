import { useId } from 'react';

export default function TextField({ label, error, id, className = '', ...inputProps }) {
  const generatedId = useId().replaceAll(':', '');
  const inputId = id ?? inputProps.name ?? inputProps.placeholder?.toLowerCase().replaceAll(' ', '-') ?? `text-field-${generatedId}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={`field ${className}`.trim()}>
      {label && <label className="field__label" htmlFor={inputId}>{label}</label>}
      <input
        className={`field__control${error ? ' field__control--error' : ''}`}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        {...inputProps}
      />
      {error && <small className="field__error" id={errorId}>{error}</small>}
    </div>
  );
}
