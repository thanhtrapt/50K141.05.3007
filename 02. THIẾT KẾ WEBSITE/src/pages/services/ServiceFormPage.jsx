import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { products } from '../../data/mockData.js';

const createSession = () => ({ name: '', minutes: '', technique: '', product: '', amount: '', entries: [] });

function TextAreaField({ label, value, onChange, placeholder, required = false }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea className="field__control service-form__textarea" value={value} onChange={onChange} placeholder={placeholder} required={required} />
    </label>
  );
}

export default function ServiceFormPage({ record, nextId, onCancel, onSave }) {
  const [form, setForm] = useState({ name: '', price: '', sessions: 1, result: '' });
  const [sessionDetails, setSessionDetails] = useState([createSession()]);
  const [entryErrors, setEntryErrors] = useState({});

  useEffect(() => {
    setForm(record
      ? { name: record.name, price: String(record.price), sessions: Number(record.sessions), result: record.result ?? '' }
      : { name: '', price: '', sessions: 1, result: '' });
    const sourceSessions = record?.sessionDetails ?? [];
    const detailsCount = Number(record?.sessions) || 1;
    setSessionDetails(Array.from({ length: detailsCount }, (_, index) => sourceSessions[index] ?? createSession()));
    setEntryErrors({});
  }, [record?.id]);

  const changeSessionCount = (value) => {
    setForm((current) => ({ ...current, sessions: value }));
    if (!value || Number(value) < 1) return;
    setSessionDetails((current) => Array.from({ length: Number(value) }, (_, index) => current[index] ?? createSession()));
  };

  const updateSession = (index, key, value) => {
    setSessionDetails((current) => current.map((session, sessionIndex) => sessionIndex === index ? { ...session, [key]: value } : session));
  };

  const addTechnique = (index) => {
    const session = sessionDetails[index];
    if (!session.technique.trim() || !session.product || !session.amount.trim()) {
      setEntryErrors((current) => ({ ...current, [index]: 'Vui lòng nhập kỹ thuật, mỹ phẩm và định lượng.' }));
      return;
    }
    updateSession(index, 'entries', [...session.entries, {
      technique: session.technique.trim(),
      product: products.find((product) => product.id === session.product)?.name ?? session.product,
      amount: session.amount.trim(),
    }]);
    updateSession(index, 'technique', '');
    updateSession(index, 'product', '');
    updateSession(index, 'amount', '');
    setEntryErrors((current) => ({ ...current, [index]: '' }));
  };

  const removeTechnique = (sessionIndex, entryIndex) => {
    updateSession(sessionIndex, 'entries', sessionDetails[sessionIndex].entries.filter((_, index) => index !== entryIndex));
  };

  const addSession = () => {
    setSessionDetails((current) => [...current, createSession()]);
    setForm((current) => ({ ...current, sessions: Number(current.sessions || 0) + 1 }));
  };

  const removeSession = (index) => {
    setSessionDetails((current) => current.filter((_, sessionIndex) => sessionIndex !== index));
    setForm((current) => ({ ...current, sessions: Math.max(1, Number(current.sessions || 1) - 1) }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ ...form, price: Number(form.price), sessions: Number(form.sessions), sessionDetails });
  };

  return (
    <div className="page-stack service-form-page">
      <PageHeader title={record ? 'CHỈNH SỬA THÔNG TIN DỊCH VỤ' : 'TẠO THÔNG TIN DỊCH VỤ'} />
      <form className="service-form" onSubmit={handleSubmit}>
        <section className="panel service-form__general">
          <h2>Thông tin chung</h2>
          <div className="service-form__general-grid">
            <TextField label="Mã dịch vụ" value={record?.id ?? nextId} readOnly />
            <TextField label="Tên dịch vụ *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nhập tên dịch vụ" required />
            <TextField label="Giá dịch vụ *" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Nhập giá dịch vụ" required />
            <TextField label="Số buổi thực hiện *" type="number" min="1" value={form.sessions} onChange={(event) => changeSessionCount(event.target.value)} required />
          </div>
        </section>

        <section className="panel service-form__sessions">
          <div className="service-form__section-heading">
            <h2>Chi tiết buổi thực hiện</h2>
            <Button type="button" variant="secondary" onClick={addSession}><Plus size={17} />Thêm buổi</Button>
          </div>
          {sessionDetails.map((session, index) => (
            <article className="service-form__session" key={`session-${index}`}>
              <div className="service-form__session-heading">
                <span className="service-form__session-number">Buổi {index + 1}</span>
                {sessionDetails.length > 1 && <button className="icon-button service-form__remove" type="button" aria-label={`Xóa buổi ${index + 1}`} onClick={() => removeSession(index)}><Trash2 size={16} /></button>}
              </div>
              <div className="service-form__session-meta">
                <TextField label="Tên buổi *" value={session.name} onChange={(event) => updateSession(index, 'name', event.target.value)} placeholder="Nhập tên buổi thực hiện" required={!record} />
                <TextField label="Thời gian (phút) *" type="number" min="1" value={session.minutes} onChange={(event) => updateSession(index, 'minutes', event.target.value)} placeholder="Nhập số phút" required={!record} />
              </div>
              <div className="service-form__entry-form">
                <TextField label="Kỹ thuật thực hiện *" value={session.technique} onChange={(event) => updateSession(index, 'technique', event.target.value)} placeholder="Nhập kỹ thuật thực hiện" />
                <SelectField label="Mỹ phẩm sử dụng *" value={session.product} onChange={(event) => updateSession(index, 'product', event.target.value)} options={[{ value: '', label: 'Chọn mỹ phẩm' }, ...products.map((product) => ({ value: product.id, label: product.name }))]} />
                <TextField label="Định lượng sản phẩm *" value={session.amount} onChange={(event) => updateSession(index, 'amount', event.target.value)} placeholder="Nhập định lượng" />
                <Button type="button" onClick={() => addTechnique(index)}>Thêm vào danh sách</Button>
              </div>
              {entryErrors[index] && <p className="field__error" role="alert">{entryErrors[index]}</p>}
              <div className="service-form__entries-scroll">
                <table className="service-form__entries">
                  <thead><tr><th>Kỹ thuật thực hiện</th><th>Mỹ phẩm sử dụng</th><th>Định lượng sản phẩm</th><th aria-label="Thao tác" /></tr></thead>
                  <tbody>
                    {session.entries.length ? session.entries.map((entry, entryIndex) => (
                      <tr key={`${entry.product}-${entryIndex}`}>
                        <td>{entry.technique}</td><td>{entry.product}</td><td>{entry.amount}</td>
                        <td><button className="icon-button service-form__remove" type="button" aria-label="Xóa kỹ thuật" onClick={() => removeTechnique(index, entryIndex)}><Trash2 size={16} /></button></td>
                      </tr>
                    )) : <tr><td colSpan="4" className="service-form__entries-empty">Chưa có kỹ thuật trong buổi này</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>

        <section className="panel service-form__result">
          <TextAreaField label="Kết quả dịch vụ *" value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value })} placeholder="Nhập kết quả đạt được sau liệu trình..." required={!record} />
        </section>

        <div className="form-actions service-form__actions">
          <Button variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button type="submit">Lưu</Button>
        </div>
      </form>
    </div>
  );
}
