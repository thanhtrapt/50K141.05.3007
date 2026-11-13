import { Search } from 'lucide-react';

export default function SearchBox({ value, onChange, placeholder = 'Nhập từ khóa cần tra cứu...', className = '' }) {
  return (
    <label className={`search-box ${className}`.trim()}>
      <Search aria-hidden="true" size={19} strokeWidth={1.8} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
