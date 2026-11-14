import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus, Trash2, X } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { apiRequest } from '../../api.js';

const halfHourLabels = Array.from({ length: 25 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
});
const emptyAppointment = { customer: '', phone: '', service: '', date: '', start: '', end: '', note: '' };

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayOf(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function appointmentEndTime(services, serviceName, startTime) {
  if (!serviceName || !startTime) return '';
  const serviceIndex = services.findIndex((service) => service.name === serviceName);
  const duration = serviceIndex >= 0 ? Number(services[serviceIndex].durationMinutes) || 60 : 60;
  const [hours, minutes] = startTime.split(':').map(Number);
  const endMinutes = hours * 60 + minutes + duration;
  return `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
}

function dateLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function timePosition(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours - 8) * 2 + minutes / 30;
}

export default function AppointmentsPage() {
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [weekShift, setWeekShift] = useState(0);
  const [today, setToday] = useState(todayInVietnam);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [services, setServices] = useState([]);
  const [servicesError, setServicesError] = useState('');
  const [viewMode, setViewMode] = useState('Tuần');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const baseMonday = useMemo(() => {
    const monday = mondayOf(today);
    monday.setDate(monday.getDate() + weekShift * 7);
    return monday;
  }, [today, weekShift]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseMonday);
    date.setDate(date.getDate() + index);
    const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
    return { day: weekday.charAt(0).toLocaleUpperCase('vi-VN') + weekday.slice(1), date: dateLabel(date), key: dateKey(date), isToday: dateKey(date) === dateKey(today) };
  }), [baseMonday, today]);
  const fromDate = days[0].key;
  const toDate = days[6].key;
  const rangeLabel = `${days[0].date} – ${days[6].date}/${baseMonday.getFullYear()}`;
  const visibleEvents = events;
  const selectedAppointmentDuration = selectedAppointment
    ? (Number(selectedAppointment.end.slice(0, 2)) * 60 + Number(selectedAppointment.end.slice(3)))
      - (Number(selectedAppointment.start.slice(0, 2)) * 60 + Number(selectedAppointment.start.slice(3)))
    : 0;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ startDate: fromDate, endDate: toDate, limit: '100' });
    if (query.trim()) params.set('keyword', query.trim());
    apiRequest(`/api/appointments?${params.toString()}`).then((result) => {
      if (!active) return;
      setEvents((result.data ?? []).map((appointment) => ({
        id: appointment.id,
        date: appointment.date,
        day: Math.max(0, days.findIndex((day) => day.key === appointment.date)),
        start: appointment.startTime,
        end: appointment.endTime,
        customer: appointment.customerName ?? '',
        phone: appointment.customerPhone ?? '',
        service: appointment.sessionName ?? '',
        note: appointment.note ?? '',
        status: appointment.status,
        customerId: appointment.customerId,
        sessionId: appointment.sessionId,
        tone: 'mint',
      })));
      setLoadError('');
    }).catch((error) => { if (active) { setEvents([]); setLoadError(error.message); } });
    return () => { active = false; };
  }, [fromDate, toDate, query, days]);

  useEffect(() => {
    let active = true;
    apiRequest('/api/services?limit=100').then(async (result) => {
      const detailed = await Promise.all((result.data ?? []).map(async (service) => {
        const item = await apiRequest(`/api/services/${service.id}`);
        return { ...service, durationMinutes: Number(item.sessions?.[0]?.durationMinutes) || 60 };
      }));
      if (active) { setServices(detailed); setServicesError(''); }
    }).catch((error) => { if (active) { setServices([]); setServicesError(error.message); } });
    return () => { active = false; };
  }, []);

  const openEdit = (appointment) => {
    setEditingId(appointment.id);
    setAppointmentForm({
      customer: appointment.customer,
      phone: appointment.phone || '',
      service: appointment.service,
      date: appointment.date,
      start: appointment.start,
      end: appointment.end,
      note: appointment.note || '',
    });
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setAppointmentForm(emptyAppointment);
    setFormOpen(true);
  };

  const createAppointment = async (event) => {
    event.preventDefault();
    if (editingId) {
      try {
        await apiRequest(`/api/appointments/${editingId}`, { method: 'PUT', body: { date: appointmentForm.date, startTime: appointmentForm.start, note: appointmentForm.note } });
        setToast('Cập nhật thông tin thành công!');
        window.setTimeout(() => setToast(''), 4000);
        const params = new URLSearchParams({ startDate: fromDate, endDate: toDate, limit: '100' });
        if (query.trim()) params.set('keyword', query.trim());
        const refreshed = await apiRequest(`/api/appointments?${params.toString()}`);
        setEvents((refreshed.data ?? []).map((appointment) => ({ id: appointment.id, date: appointment.date, start: appointment.startTime, end: appointment.endTime,
          customer: appointment.customerName ?? '', phone: appointment.customerPhone ?? '', service: appointment.sessionName ?? '', note: appointment.note ?? '', status: appointment.status, tone: 'mint' })));
      } catch (error) { setLoadError(error.message); return; }
      setEditingId(null);
    } else {
      try {
        await apiRequest('/api/appointments', { method: 'POST', body: {
          customerPhone: appointmentForm.phone.replace(/\D/g, ''),
          serviceName: appointmentForm.service,
          date: appointmentForm.date,
          startTime: appointmentForm.start,
          note: appointmentForm.note,
        } });
        const params = new URLSearchParams({ startDate: fromDate, endDate: toDate, limit: '100' });
        const refreshed = await apiRequest(`/api/appointments?${params.toString()}`);
        setEvents((refreshed.data ?? []).map((appointment) => ({ id: appointment.id, date: appointment.date, start: appointment.startTime, end: appointment.endTime,
          customer: appointment.customerName ?? '', phone: appointment.customerPhone ?? '', service: appointment.sessionName ?? '', note: appointment.note ?? '', status: appointment.status, tone: 'mint' })));
      } catch (error) { setLoadError(error.message); return; }
    }
    setFormOpen(false);
    setAppointmentForm(emptyAppointment);
  };

  return (
    <div className={`page-stack appointment-page${selectedAppointment ? ' appointment-page--with-detail' : ''}`}>
      <section className="appointment-page__calendar">
        <PageHeader title="XEM LỊCH HẸN" />
      <PageListToolbar
        className="appointment-toolbar"
        search={<SearchBox value={query} onChange={setQuery} placeholder="Nhập tên khách hàng cần tìm..." className="appointment-search" />}
        actions={<Button onClick={openCreate}><Plus size={18} />Tạo lịch hẹn</Button>}
      />
      <div className="appointment-summary"><CalendarDays size={15} /> {visibleEvents.length} lịch hẹn trong tuần · {visibleEvents.filter((event) => event.date === dateKey(today)).length} lịch hẹn hôm nay</div>
      <div className="calendar-toolbar">
        <button type="button" className="calendar-today" onClick={() => { setToday(todayInVietnam()); setWeekShift(0); }}>Hôm nay</button>
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
          {days.map((day) => <div className={`calendar-day-header${day.isToday ? ' is-today' : ''}`} key={day.key}>
            <small>{day.day}</small><strong>{day.date}</strong><span>{visibleEvents.filter((event) => event.date === day.key).length} lịch</span>
          </div>)}
          <div className="calendar-time-column">
            {halfHourLabels.map((time) => <div className="calendar-time-slot" key={time}>{time}</div>)}
          </div>
          {days.map((day) => (
            <div className={`calendar-day-column${day.isToday ? ' is-today' : ''}`} key={day.key}>
              {halfHourLabels.map((time) => <div className="calendar-slot" key={time} />)}
              {visibleEvents.filter((event) => event.date === day.key).map((event) => {
                const top = timePosition(event.start) * 23;
                const height = Math.max(42, (timePosition(event.end) - timePosition(event.start)) * 23 - 4);
                return (
                  <button
                    className={`appointment-event appointment-event--${event.tone}`}
                    key={event.id}
                    style={{ top, height }}
                    type="button"
                    onClick={() => setSelectedAppointment(event)}
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

      {loadError && <p className="field__error" role="alert">{loadError}</p>}
      {!loadError && visibleEvents.length === 0 && <p className="appointment-empty">{query.trim() ? 'Không tìm thấy lịch hẹn phù hợp!' : 'Không có lịch hẹn trong tuần này.'}</p>}
      </section>

      <Modal open={Boolean(selectedAppointment)} title="CHI TIẾT LỊCH HẸN" onClose={() => setSelectedAppointment(null)} size="large">
        {selectedAppointment && <div className="appointment-detail-panel" aria-labelledby="appointment-detail-title">
        <header className="appointment-detail-panel__header">
          <h2 id="appointment-detail-title">CHI TIẾT LỊCH HẸN</h2>
          <button type="button" className="appointment-detail-panel__close" aria-label="Đóng chi tiết lịch hẹn" onClick={() => setSelectedAppointment(null)}>
            <X size={21} />
          </button>
        </header>

        <div className="appointment-detail-panel__date">
          <CalendarDays aria-hidden="true" size={23} />
          <div className="appointment-detail-panel__date-copy">
            <strong>{selectedAppointment.date}</strong>
            <span>{selectedAppointment.start}–{selectedAppointment.end} · {selectedAppointmentDuration} phút</span>
          </div>
          <div className="appointment-detail-panel__actions">
            <Button variant="secondary" onClick={() => openEdit(selectedAppointment)}><Pencil size={15} />Điều chỉnh lịch hẹn</Button>
            <Button variant="secondary" className="appointment-detail-panel__delete" onClick={() => setConfirmDeleteOpen(true)}><Trash2 size={15} />Hủy lịch hẹn</Button>
          </div>
        </div>

        <dl className="appointment-detail-panel__facts">
          <div><dt>Tên khách hàng</dt><dd>{selectedAppointment.customer}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{selectedAppointment.phone || '—'}</dd></div>
          <div><dt>Tên dịch vụ</dt><dd>{selectedAppointment.service}</dd></div>
          <div><dt>Giờ đặt lịch</dt><dd>{selectedAppointment.start}</dd></div>
          <div><dt>Giờ kết thúc</dt><dd>{selectedAppointment.end}</dd></div>
          <div><dt>Ngày</dt><dd>{selectedAppointment.date}</dd></div>
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
        </div>}
      </Modal>

      <Modal open={formOpen} title={editingId ? 'ĐIỀU CHỈNH LỊCH HẸN' : 'TẠO LỊCH HẸN'} onClose={() => setConfirmDiscardOpen(true)} size="large">
        <form className="form-grid" onSubmit={createAppointment} autoComplete="off">
          <TextField label="Tên khách hàng *" value={appointmentForm.customer} onChange={(event) => setAppointmentForm({ ...appointmentForm, customer: event.target.value })} autoComplete="off" readOnly={Boolean(editingId)} required />
          <TextField label="Số điện thoại *" type="tel" value={appointmentForm.phone} onChange={(event) => setAppointmentForm({ ...appointmentForm, phone: event.target.value })} autoComplete="off" readOnly={Boolean(editingId)} required />
          <SelectField label="Dịch vụ *" value={appointmentForm.service} onChange={(event) => setAppointmentForm((current) => ({ ...current, service: event.target.value, end: appointmentEndTime(services, event.target.value, current.start) }))} options={[{ value: '', label: services.length ? 'Chọn dịch vụ' : 'Chưa có dịch vụ' }, ...services.map((service) => service.name)]} disabled={Boolean(editingId) || services.length === 0} required />
          {servicesError && <p className="field__error form-grid__wide" role="alert">{servicesError}</p>}
          <TextField label="Ngày hẹn *" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} required />
          <TextField label="Giờ hẹn *" type="time" value={appointmentForm.start} onChange={(event) => setAppointmentForm((current) => ({ ...current, start: event.target.value, end: appointmentEndTime(services, current.service, event.target.value) }))} required />
          <TextField label="Giờ kết thúc *" type="time" value={appointmentForm.end} readOnly required />
          <label className="field form-grid__wide"><span className="field__label">Ghi chú</span><textarea className="field__control appointment-form__note" value={appointmentForm.note} onChange={(event) => setAppointmentForm({ ...appointmentForm, note: event.target.value })} /></label>
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={() => setConfirmDiscardOpen(true)}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmDeleteOpen} title="HỦY LỊCH HẸN" onClose={() => setConfirmDeleteOpen(false)}>
        <p className="appointment-delete-confirm">Bạn có chắc chắn muốn hủy lịch hẹn của {selectedAppointment?.customer}?</p>
        <div className="modal-form-actions">
          <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>Hủy</Button>
          <Button className="appointment-delete-confirm__button" onClick={async () => {
            try {
              await apiRequest(`/api/appointments/${selectedAppointment.id}/cancel`, { method: 'POST', body: { reason: '' } });
              setEvents((current) => current.filter((item) => item.id !== selectedAppointment.id));
              setSelectedAppointment(null);
              setConfirmDeleteOpen(false);
            } catch (error) { setLoadError(error.message); setConfirmDeleteOpen(false); }
          }}>Hủy lịch hẹn</Button>
        </div>
      </Modal>
      <Modal open={confirmDiscardOpen} title="HỦY THAO TÁC ĐIỀU CHỈNH" onClose={() => setConfirmDiscardOpen(false)}>
        <p className="appointment-delete-confirm">Bạn có chắc chắn muốn hủy thao tác điều chỉnh lịch hẹn?</p>
        <div className="modal-form-actions"><Button variant="secondary" onClick={() => setConfirmDiscardOpen(false)}>Tiếp tục chỉnh sửa</Button><Button onClick={() => { setConfirmDiscardOpen(false); setFormOpen(false); setEditingId(null); setAppointmentForm(emptyAppointment); }}>Đồng ý hủy</Button></div>
      </Modal>
      {toast && <div className="appointment-toast" role="status">{toast}</div>}
    </div>
  );
}
