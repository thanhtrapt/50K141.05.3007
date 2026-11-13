import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
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
  const [selected, setSelected] = useState(null);
  const [appointmentForm, setAppointmentForm] = useState({ customer: '', phone: '', service: '', date: '2026-10-21', start: '14:00', end: '15:00' });
  const [viewMode, setViewMode] = useState('Tuần');

  const days = useMemo(() => appointmentDays.map((day, index) => {
    const date = new Date(baseMonday);
    date.setDate(date.getDate() + weekShift * 7 + index);
    return { ...day, date: dateLabel(date), isToday: weekShift === 0 && index === 2 };
  }), [weekShift]);
  const visibleEvents = useMemo(() => events.filter((event) => `${event.customer} ${event.service}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  const rangeLabel = `${days[0].date} – ${days[6].date}/2026`;

  const createAppointment = (event) => {
    event.preventDefault();
    const dayDate = new Date(`${appointmentForm.date}T00:00:00`);
    const monday = new Date(baseMonday);
    monday.setDate(monday.getDate() + weekShift * 7);
    const dayIndex = Math.max(0, Math.min(6, Math.round((dayDate - monday) / 86400000)));
    setEvents((current) => [...current, {
      id: `LH${String(current.length + 1).padStart(3, '0')}`,
      day: dayIndex,
      start: appointmentForm.start,
      end: appointmentForm.end,
      customer: appointmentForm.customer,
      service: appointmentForm.service,
      tone: 'mint',
    }]);
    setFormOpen(false);
  };

  return (
    <div className="page-stack appointment-page">
      <PageHeader
        title="XEM LỊCH HẸN"
        actions={<Button onClick={() => setFormOpen(true)}><Plus size={18} />Tạo lịch hẹn</Button>}
      />
      <SearchBox value={query} onChange={setQuery} placeholder="Nhập tên khách hàng cần tìm..." className="appointment-search" />
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
                    onClick={() => setSelected(event)}
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

      <Modal open={formOpen} title="TẠO LỊCH HẸN" onClose={() => setFormOpen(false)} size="large">
        <form className="form-grid" onSubmit={createAppointment}>
          <TextField label="Tên khách hàng *" value={appointmentForm.customer} onChange={(event) => setAppointmentForm({ ...appointmentForm, customer: event.target.value })} required />
          <TextField label="Số điện thoại *" type="tel" value={appointmentForm.phone} onChange={(event) => setAppointmentForm({ ...appointmentForm, phone: event.target.value })} required />
          <SelectField label="Dịch vụ *" value={appointmentForm.service} onChange={(event) => setAppointmentForm({ ...appointmentForm, service: event.target.value })} options={[{ value: '', label: 'Chọn dịch vụ' }, 'Chăm sóc da chuyên sâu', 'Massage tinh dầu', 'Phục hồi da']} required />
          <TextField label="Ngày hẹn *" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} required />
          <TextField label="Giờ hẹn *" type="time" value={appointmentForm.start} onChange={(event) => setAppointmentForm({ ...appointmentForm, start: event.target.value })} required />
          <TextField label="Giờ kết thúc *" type="time" value={appointmentForm.end} onChange={(event) => setAppointmentForm({ ...appointmentForm, end: event.target.value })} required />
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(selected)} title="CHI TIẾT LỊCH HẸN" onClose={() => setSelected(null)} size="small">
        {selected && <div className="appointment-detail">
          <strong>{selected.start} – {selected.end}</strong>
          <p>{selected.customer}</p>
          <p>{selected.service}</p>
          <div className="modal-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
