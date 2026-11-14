import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { appointmentDays, appointmentEvents } from '../../data/mockData.js';

const halfHourLabels = Array.from({ length: 25 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
});
const baseMonday = new Date(2026, 9, 19);

function dateLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function timePosition(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours - 8) * 2 + minutes / 30;
}

export default function AppointmentsPage() {
  const [events, setEvents] = useState(appointmentEvents);
  const [query, setQuery] = useState('');
  const [weekShift, setWeekShift] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [appointmentForm, setAppointmentForm] = useState({ customer: '', phone: '', service: '', date: '2026-10-21', start: '14:00', end: '15:00', note: '' });
  const [viewMode, setViewMode] = useState('Tuần');
  const location = useLocation();
  const navigate = useNavigate();
  const appointmentId = location.pathname.split('/').filter(Boolean)[1];

  const days = useMemo(() => appointmentDays.map((day, index) => {
    const date = new Date(baseMonday);
    date.setDate(date.getDate() + weekShift * 7 + index);
    return { ...day, date: dateLabel(date), isToday: weekShift === 0 && index === 2 };
  }), [weekShift]);
  const visibleEvents = useMemo(
    () => events.filter((event) => `${event.customer} ${event.service}`.toLowerCase().includes(query.toLowerCase())),
    [events, query],
  );
  const rangeLabel = `${days[0].date} – ${days[6].date}/2026`;
  const selectedAppointment = appointmentId ? events.find((event) => event.id === appointmentId) : null;
  const selectedAppointmentDay = selectedAppointment ? days[selectedAppointment.day] ?? days[0] : null;
  const selectedAppointmentDuration = selectedAppointment
    ? (Number(selectedAppointment.end.slice(0, 2)) * 60 + Number(selectedAppointment.end.slice(3)))
      - (Number(selectedAppointment.start.slice(0, 2)) * 60 + Number(selectedAppointment.start.slice(3)))
    : 0;
  const selectedAppointmentDateParts = selectedAppointmentDay?.date.split('/') ?? [];

  if (appointmentId && !selectedAppointment) {
    return <FeatureNotFound heading="XEM LỊCH HẸN" message="Không tìm thấy lịch hẹn phù hợp!" onBack={() => navigate('/lich-hen')} />;
  }

  const appointmentDateValue = (appointment) => {
    const date = new Date(baseMonday);
    date.setDate(date.getDate() + weekShift * 7 + appointment.day);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const openEdit = (appointment) => {
    setEditingId(appointment.id);
    setAppointmentForm({
      customer: appointment.customer,
      phone: appointment.phone || '',
      service: appointment.service,
      date: appointmentDateValue(appointment),
      start: appointment.start,
      end: appointment.end,
      note: appointment.note || '',
    });
    setFormOpen(true);
  };

  const createAppointment = (event) => {
    event.preventDefault();
    const dayDate = new Date(`${appointmentForm.date}T00:00:00`);
    const monday = new Date(baseMonday);
    monday.setDate(monday.getDate() + weekShift * 7);
    const dayIndex = Math.max(0, Math.min(6, Math.round((dayDate - monday) / 86400000)));
    const updatedAppointment = {
      day: dayIndex,
      start: appointmentForm.start,
      end: appointmentForm.end,
      customer: appointmentForm.customer,
      phone: appointmentForm.phone,
      service: appointmentForm.service,
      note: appointmentForm.note,
      tone: 'mint',
    };
    if (editingId) {
      setEvents((current) => current.map((item) => item.id === editingId ? { ...item, ...updatedAppointment } : item));
      setEditingId(null);
    } else {
      setEvents((current) => [...current, {
        ...updatedAppointment,
        id: `LH${String(current.length + 1).padStart(3, '0')}`,
      }]);
    }
    setFormOpen(false);
    setAppointmentForm({ customer: '', phone: '', service: '', date: '2026-10-21', start: '14:00', end: '15:00', note: '' });
  };

  return (
    <div className={`page-stack appointment-page${selectedAppointment ? ' appointment-page--with-detail' : ''}`}>
      <section className="appointment-page__calendar">
        <PageHeader title="XEM LỊCH HẸN" />
      <PageListToolbar
        className="appointment-toolbar"
        search={<SearchBox value={query} onChange={setQuery} placeholder="Nhập tên khách hàng cần tìm..." className="appointment-search" />}
        actions={<Button onClick={() => setFormOpen(true)}><Plus size={18} />Tạo lịch hẹn</Button>}
      />
      <div className="appointment-summary"><CalendarDays size={15} /> {visibleEvents.length} lịch hẹn trong tuần · {visibleEvents.filter((event) => event.day === 2).length} lịch hẹn hôm nay</div>
      <div className="calendar-toolbar">
        <button type="button" className="calendar-today" onClick={() => setWeekShift(0)}>Hôm nay</button>
        <div className="calendar-stepper">
          <button type="button" aria-label="Tuần trước" onClick={() => setWeekShift((value) => value - 1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Tuần sau" onClick={() => setWeekShift((value) => value + 1)}><ChevronRight size={18} /></button>
        </div>
        <strong>{rangeLabel}</strong>
        <span className="calendar-count">{visibleEvents.length} lịch hẹn</span>
        <SelectField value={viewMode} onChange={(event) => setViewMode(event.target.value)} options={['Tuần', 'Ngày']} className="calendar-view-select" aria-label="Chế độ xem lịch" />
      </div>

      <div className="calendar-scroll" role="region" aria-label="Lịch hẹn trong tuần" tabIndex={0}>
        <div className={`appointment-calendar${viewMode === 'Ngày' ? ' appointment-calendar--day' : ''}`}>
          <div className="calendar-corner">GMT+7</div>
          {days.map((day) => <div className={`calendar-day-header${day.isToday ? ' is-today' : ''}`} key={day.day}>
            <small>{day.day}</small><strong>{day.date}</strong><span>{visibleEvents.filter((event) => event.day === days.indexOf(day)).length} lịch</span>
          </div>)}
          <div className="calendar-time-column">
            {halfHourLabels.map((time) => <div className="calendar-time-slot" key={time}>{time}</div>)}
          </div>
          {days.map((day, dayIndex) => (
            <div className={`calendar-day-column${day.isToday ? ' is-today' : ''}`} key={day.day}>
              {halfHourLabels.map((time) => <div className="calendar-slot" key={time} />)}
              {visibleEvents.filter((event) => event.day === dayIndex).map((event) => {
                const top = timePosition(event.start) * 23;
                const height = Math.max(42, (timePosition(event.end) - timePosition(event.start)) * 23 - 4);
                return (
                  <button
                    className={`appointment-event appointment-event--${event.tone}`}
                    key={event.id}
                    style={{ top, height }}
                    type="button"
                    onClick={() => navigate(`/lich-hen/${event.id}`)}
                  >
                    <strong>{event.start}–{event.end}</strong>
                    <span>{event.customer}</span>
                    <small>{event.service}</small>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      </section>

      {selectedAppointment && <aside className="appointment-detail-panel" aria-labelledby="appointment-detail-title">
        <header className="appointment-detail-panel__header">
          <h2 id="appointment-detail-title">CHI TIẾT LỊCH HẸN</h2>
          <button type="button" className="appointment-detail-panel__close" aria-label="Quay lại danh sách lịch hẹn" onClick={() => navigate('/lich-hen')}>
            <X size={21} />
          </button>
        </header>

        <div className="appointment-detail-panel__date">
          <CalendarDays aria-hidden="true" size={23} />
          <div className="appointment-detail-panel__date-copy">
            <strong>{Number(selectedAppointmentDateParts[0])} tháng {Number(selectedAppointmentDateParts[1])}, 2026</strong>
            <span>{selectedAppointment.start}–{selectedAppointment.end} · {selectedAppointmentDuration} phút</span>
          </div>
          <div className="appointment-detail-panel__actions">
            <Button variant="secondary" onClick={() => openEdit(selectedAppointment)}><Pencil size={15} />Chỉnh sửa</Button>
            <Button variant="secondary" className="appointment-detail-panel__delete" onClick={() => setConfirmDeleteOpen(true)}><Trash2 size={15} />Xóa</Button>
          </div>
        </div>

        <dl className="appointment-detail-panel__facts">
          <div><dt>Tên khách hàng</dt><dd>{selectedAppointment.customer}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{selectedAppointment.phone || '—'}</dd></div>
          <div><dt>Tên dịch vụ</dt><dd>{selectedAppointment.service}</dd></div>
          <div><dt>Giờ đặt lịch</dt><dd>{selectedAppointment.start}</dd></div>
          <div><dt>Giờ kết thúc</dt><dd>{selectedAppointment.end}</dd></div>
          <div><dt>Ngày</dt><dd>{selectedAppointmentDay.day}, {selectedAppointmentDay.date}/2026</dd></div>
        </dl>

        <section className="appointment-detail-panel__note">
          <h3>Ghi chú</h3>
          {noteEditorOpen ? (
            <div className="appointment-detail-panel__note-editor">
              <textarea aria-label="Ghi chú lịch hẹn" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
              <div>
                <Button variant="secondary" onClick={() => setNoteEditorOpen(false)}>Hủy</Button>
                <Button onClick={() => {
                  setEvents((current) => current.map((item) => item.id === selectedAppointment.id ? { ...item, note: noteDraft.trim() } : item));
                  setNoteEditorOpen(false);
                }}>Lưu ghi chú</Button>
              </div>
            </div>
          ) : <p>{selectedAppointment.note || '—'}</p>}
        </section>

        {!noteEditorOpen && <Button variant="secondary" className="appointment-detail-panel__add-note" onClick={() => {
          setNoteDraft(selectedAppointment.note || '');
          setNoteEditorOpen(true);
        }}><NotebookPen size={17} />Thêm ghi chú</Button>}
      </aside>}

      <Modal open={formOpen} title={editingId ? 'CHỈNH SỬA LỊCH HẸN' : 'TẠO LỊCH HẸN'} onClose={() => { setFormOpen(false); setEditingId(null); }} size="large">
        <form className="form-grid" onSubmit={createAppointment}>
          <TextField label="Tên khách hàng *" value={appointmentForm.customer} onChange={(event) => setAppointmentForm({ ...appointmentForm, customer: event.target.value })} required />
          <TextField label="Số điện thoại *" type="tel" value={appointmentForm.phone} onChange={(event) => setAppointmentForm({ ...appointmentForm, phone: event.target.value })} required />
          <SelectField label="Dịch vụ *" value={appointmentForm.service} onChange={(event) => setAppointmentForm({ ...appointmentForm, service: event.target.value })} options={[{ value: '', label: 'Chọn dịch vụ' }, 'Chăm sóc da chuyên sâu', 'Massage tinh dầu', 'Phục hồi da']} required />
          <TextField label="Ngày hẹn *" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} required />
          <TextField label="Giờ hẹn *" type="time" value={appointmentForm.start} onChange={(event) => setAppointmentForm({ ...appointmentForm, start: event.target.value })} required />
          <TextField label="Giờ kết thúc *" type="time" value={appointmentForm.end} onChange={(event) => setAppointmentForm({ ...appointmentForm, end: event.target.value })} required />
          <label className="field form-grid__wide"><span className="field__label">Ghi chú</span><textarea className="field__control appointment-form__note" value={appointmentForm.note} onChange={(event) => setAppointmentForm({ ...appointmentForm, note: event.target.value })} /></label>
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={() => { setFormOpen(false); setEditingId(null); }}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmDeleteOpen} title="XÓA LỊCH HẸN" onClose={() => setConfirmDeleteOpen(false)}>
        <p className="appointment-delete-confirm">Bạn có chắc chắn muốn xóa lịch hẹn của {selectedAppointment?.customer}?</p>
        <div className="modal-form-actions">
          <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>Hủy</Button>
          <Button className="appointment-delete-confirm__button" onClick={() => {
            setEvents((current) => current.filter((item) => item.id !== selectedAppointment?.id));
            setConfirmDeleteOpen(false);
            navigate('/lich-hen');
          }}>Xóa lịch hẹn</Button>
        </div>
      </Modal>
    </div>
  );
}
