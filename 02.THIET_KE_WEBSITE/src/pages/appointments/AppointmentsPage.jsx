import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Plus, X } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import FeedbackDialog from '../../components/ui/FeedbackDialog.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { ActionGroup, DeleteButton, EditButton } from '../../components/ui/ActionButtons.jsx';
import { apiRequest } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';

const halfHourLabels = Array.from({ length: 25 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
});
const emptyAppointment = { customer: '', phone: '', birthday: '', customerStatus: '', service: '', date: '', start: '', end: '', note: '' };

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function latestBirthdayDate() {
  const date = todayInVietnam();
  date.setDate(date.getDate() - 1);
  return dateKey(date);
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

function appointmentDateLabels(value) {
  const datePart = String(value || '').slice(0, 10);
  const date = new Date(`${datePart}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return { long: value || '—', full: value || '—' };
  const options = { timeZone: 'Asia/Ho_Chi_Minh' };
  return {
    long: new Intl.DateTimeFormat('vi-VN', { ...options, day: 'numeric', month: 'long', year: 'numeric' }).format(date),
    full: new Intl.DateTimeFormat('vi-VN', { ...options, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
  };
}

function timePosition(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours - 8) * 2 + minutes / 30;
}

export default function AppointmentsPage() {
  const { can } = useAuth();
  // STAFF chỉ được xem lịch hẹn; OWNER mới có quyền tạo, điều chỉnh và hủy.
  const canManageAppointments = can('appointments:write');
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [weekShift, setWeekShift] = useState(0);
  const [today, setToday] = useState(todayInVietnam);
  const [loadError, setLoadError] = useState('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [customerLookup, setCustomerLookup] = useState('idle');
  const [appointmentValidation, setAppointmentValidation] = useState(null);
  const [services, setServices] = useState([]);
  const [servicesError, setServicesError] = useState('');
  const [viewMode, setViewMode] = useState('Tuần');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [appointmentConflict, setAppointmentConflict] = useState(null);
  const [businessWarning, setBusinessWarning] = useState('');
  const { showDialog } = useFeedback();
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
    }).catch((error) => { if (active) { setEvents([]); setLoadError(error.isServerError || error.code === 'NETWORK_ERROR' ? '' : error.message); } });
    return () => { active = false; };
  }, [fromDate, toDate, query, days]);

  useEffect(() => {
    if (!query.trim()) { setNotFoundOpen(false); return; }
    if (!loadError && events.length === 0) setNotFoundOpen(true);
  }, [query, loadError, events]);

  useEffect(() => {
    let active = true;
    apiRequest('/api/services?limit=100').then(async (result) => {
      const detailed = await Promise.all((result.data ?? []).map(async (service) => {
        const item = await apiRequest(`/api/services/${service.id}`);
        return { ...service, durationMinutes: Number(item.sessions?.[0]?.durationMinutes) || 60 };
      }));
      if (active) { setServices(detailed); setServicesError(''); }
    }).catch((error) => { if (active) { setServices([]); setServicesError(error.isServerError || error.code === 'NETWORK_ERROR' ? '' : error.message); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (editingId) return undefined;
    const phone = appointmentForm.phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(phone)) {
      setCustomerLookup('idle');
      setAppointmentForm((current) => ({ ...current, customer: '', birthday: '', customerStatus: '' }));
      return undefined;
    }
    let active = true;
    setCustomerLookup('loading');
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiRequest(`/api/customers?keyword=${encodeURIComponent(phone)}&limit=100`);
        if (!active) return;
        const found = (result.data ?? []).find((customer) => customer.phone === phone);
        if (found) {
          setAppointmentForm((current) => ({ ...current, customer: found.name, birthday: found.dateOfBirth, customerStatus: 'existing' }));
          setCustomerLookup('existing');
        } else {
          setAppointmentForm((current) => ({ ...current, customer: '', birthday: '', customerStatus: 'new' }));
          setCustomerLookup('new');
        }
      } catch (error) {
        if (active) { setCustomerLookup('error'); showDialog({ title: 'Không thể tra cứu khách hàng', message: `Không thể kiểm tra số điện thoại: ${error.message}` }); }
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [appointmentForm.phone, editingId, showDialog]);

  const openEdit = (appointment) => {
    if (!canManageAppointments) return;
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
    if (!canManageAppointments) return;
    setEditingId(null);
    setAppointmentForm(emptyAppointment);
    setAppointmentValidation(null);
    setFormOpen(true);
  };

  const createAppointment = async (event) => {
    event.preventDefault();
    if (!canManageAppointments) return;
    const phone = appointmentForm.phone.replace(/\D/g, '');
    const birthdayValid = appointmentForm.customerStatus === 'existing' || Boolean(appointmentForm.birthday && appointmentForm.birthday < dateKey(todayInVietnam()));
    if (!/^\d{10}$/.test(phone) || !appointmentForm.customer.trim() || !birthdayValid || !appointmentForm.service || !appointmentForm.date || !appointmentForm.start || !appointmentForm.end || appointmentForm.end <= appointmentForm.start) {
      setAppointmentValidation({
        summary: 'Vui lòng bổ sung thông tin còn thiếu. Lịch hẹn chưa được lưu.',
        phone: !/^\d{10}$/.test(phone) ? 'Số điện thoại phải gồm đúng 10 chữ số.' : '',
        customer: !appointmentForm.customer.trim() ? 'Vui lòng nhập họ tên khách hàng.' : '',
        birthday: !birthdayValid ? 'Vui lòng chọn ngày sinh nhỏ hơn hôm nay.' : '',
        service: !appointmentForm.service ? 'Vui lòng chọn dịch vụ.' : '',
        end: !appointmentForm.end || appointmentForm.end <= appointmentForm.start ? 'Giờ kết thúc phải lớn hơn giờ bắt đầu.' : '',
      });
      return;
    }
    setAppointmentValidation(null);
    if (editingId) {
      try {
        await apiRequest(`/api/appointments/${editingId}`, { method: 'PUT', body: { date: appointmentForm.date, startTime: appointmentForm.start, note: appointmentForm.note } });
        showDialog({ tone: 'success', title: 'Cập nhật thông tin thành công', message: 'Thông tin dịch vụ mới đã được lưu vào hệ thống' });
        const params = new URLSearchParams({ startDate: fromDate, endDate: toDate, limit: '100' });
        if (query.trim()) params.set('keyword', query.trim());
        const refreshed = await apiRequest(`/api/appointments?${params.toString()}`);
        setEvents((refreshed.data ?? []).map((appointment) => ({ id: appointment.id, date: appointment.date, start: appointment.startTime, end: appointment.endTime,
          customer: appointment.customerName ?? '', phone: appointment.customerPhone ?? '', service: appointment.sessionName ?? '', note: appointment.note ?? '', status: appointment.status, tone: 'mint' })));
      } catch (error) {
        if (error.code === 'CUSTOMER_BLACKLISTED') setBusinessWarning(error.fieldErrors?.[0]?.message || 'Vui lòng cân nhắc trước khi lưu; bạn vẫn có thể tạo lịch hẹn.');
        else if (error.code === 'APPOINTMENT_CONFLICT' || error.code === 'SESSION_ALREADY_SCHEDULED') {
          const detail = error.fieldErrors?.find((item) => item.field === 'startTime');
          setAppointmentConflict({ message: detail?.message || 'Giờ hẹn bị trùng lịch với lịch khác', suggestions: detail?.suggestions || [] });
        }
        else if (error.status === 409) showDialog({ title: 'Không thể điều chỉnh lịch hẹn', message: error.message });
        else if (error.isServerError || error.code === 'NETWORK_ERROR') return;
        else showDialog({ title: 'Thông tin không hợp lệ', message: error.message || 'Yêu cầu nhập lại' });
        return;
      }
      setEditingId(null);
    } else {
      try {
        const created = await apiRequest('/api/appointments', { method: 'POST', body: {
          customerPhone: phone,
          customerName: appointmentForm.customer.trim(),
          customerBirthday: appointmentForm.birthday,
          serviceName: appointmentForm.service,
          date: appointmentForm.date,
          startTime: appointmentForm.start,
          endTime: appointmentForm.end,
          note: appointmentForm.note,
        } });
        setEvents((current) => [...current, {
          id: created.id, date: created.date, start: created.startTime, end: created.endTime,
          customer: created.customerName ?? appointmentForm.customer, phone: created.customerPhone ?? phone,
          service: created.sessionName ?? appointmentForm.service, note: created.note ?? appointmentForm.note,
          status: created.status, customerId: created.customerId, sessionId: created.sessionId, tone: 'mint',
        }].filter((item) => item.date >= fromDate && item.date <= toDate));
        showDialog({ tone: 'success', title: 'Tạo lịch hẹn thành công', message: 'Thông tin lịch hẹn đã được lưu vào hệ thống.', size: 'medium', wideButton: true });
        await apiRequest('/api/customers?limit=100').catch((error) => console.error('Không thể làm mới danh sách khách hàng:', error));
        const params = new URLSearchParams({ startDate: fromDate, endDate: toDate, limit: '100' });
        const refreshed = await apiRequest(`/api/appointments?${params.toString()}`).catch((error) => { console.error('Không thể làm mới danh sách lịch hẹn:', error); return null; });
        if (refreshed) setEvents((refreshed.data ?? []).map((appointment) => ({ id: appointment.id, date: appointment.date, start: appointment.startTime, end: appointment.endTime,
          customer: appointment.customerName ?? '', phone: appointment.customerPhone ?? '', service: appointment.sessionName ?? '', note: appointment.note ?? '', status: appointment.status, tone: 'mint' })));
      } catch (error) {
        if (error.code === 'CUSTOMER_BLACKLISTED') setBusinessWarning(error.fieldErrors?.[0]?.message || 'Vui lòng cân nhắc trước khi lưu; bạn vẫn có thể tạo lịch hẹn.');
        else if (error.code === 'APPOINTMENT_CONFLICT' || error.code === 'SESSION_ALREADY_SCHEDULED') {
          const detail = error.fieldErrors?.find((item) => item.field === 'startTime');
          setAppointmentConflict({ message: detail?.message || 'Giờ hẹn bị trùng lịch với lịch khác', suggestions: detail?.suggestions || [] });
        }
        else if (error.status === 409) showDialog({ title: 'Không thể tạo lịch hẹn', message: error.message });
        else showDialog({ title: 'Không thể tạo lịch hẹn', message: `Không thể lưu lịch hẹn: ${error.message || 'Vui lòng thử lại.'}` });
        return;
      }
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
        actions={canManageAppointments ? <Button onClick={openCreate}><Plus size={18} />Tạo lịch hẹn</Button> : null}
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

      <FeedbackDialog open={notFoundOpen} tone="empty" message="Không tìm thấy lịch hẹn phù hợp!" onClose={() => setNotFoundOpen(false)} />
      <FeedbackDialog open={Boolean(appointmentConflict)} title="Giờ hẹn bị trùng lịch với lịch khác" message={appointmentConflict?.message} closeVariant="secondary" onClose={() => setAppointmentConflict(null)}>
        {appointmentConflict?.suggestions?.length > 0 && <div className="appointment-conflict-slots"><strong>Giờ trống</strong>{appointmentConflict.suggestions.map((slot) => <button type="button" key={`${slot.startTime}-${slot.endTime}`} onClick={() => { setAppointmentForm((current) => ({ ...current, start: slot.startTime, end: slot.endTime })); setAppointmentConflict(null); }}>{slot.startTime} – {slot.endTime}</button>)}</div>}
      </FeedbackDialog>

      {selectedAppointment && <aside className="appointment-detail-panel" aria-labelledby="appointment-detail-title">
        <header className="appointment-detail-panel__header">
          <h2 id="appointment-detail-title">CHI TIẾT LỊCH HẸN</h2>
          <button type="button" className="appointment-detail-panel__close" aria-label="Đóng chi tiết lịch hẹn" onClick={() => setSelectedAppointment(null)}>
            <X size={21} />
          </button>
        </header>

        <div className="appointment-detail-panel__date">
          <CalendarDays aria-hidden="true" size={23} />
          <div className="appointment-detail-panel__date-copy">
            <strong>{appointmentDateLabels(selectedAppointment.date).long}</strong>
            <span>{selectedAppointment.start}–{selectedAppointment.end} · {selectedAppointmentDuration} phút</span>
          </div>
          {canManageAppointments && (
            <ActionGroup className="appointment-detail-panel__actions">
              <EditButton onClick={() => openEdit(selectedAppointment)} label="Chỉnh sửa" />
              <DeleteButton onClick={() => setConfirmDeleteOpen(true)} label="Xóa" />
            </ActionGroup>
          )}
        </div>

        <dl className="appointment-detail-panel__facts">
          <div><dt>Tên khách hàng</dt><dd>{selectedAppointment.customer}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{selectedAppointment.phone || '—'}</dd></div>
          <div><dt>Tên dịch vụ</dt><dd>{selectedAppointment.service}</dd></div>
          <div><dt>Giờ đặt lịch</dt><dd>{selectedAppointment.start}</dd></div>
          <div><dt>Giờ kết thúc</dt><dd>{selectedAppointment.end}</dd></div>
          <div><dt>Ngày</dt><dd>{appointmentDateLabels(selectedAppointment.date).full}</dd></div>
        </dl>

        <section className="appointment-detail-panel__note">
          <h3>Ghi chú</h3>
          {canManageAppointments && noteEditorOpen ? (
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

        {canManageAppointments && !noteEditorOpen && <Button variant="secondary" className="appointment-detail-panel__add-note" onClick={() => {
          setNoteDraft(selectedAppointment.note || '');
          setNoteEditorOpen(true);
        }}><NotebookPen size={17} />Thêm ghi chú</Button>}
        </aside>}

      <Modal open={formOpen} title={editingId ? 'ĐIỀU CHỈNH LỊCH HẸN' : 'TẠO LỊCH HẸN'} onClose={() => setConfirmDiscardOpen(true)} size="large">
        <form className="form-grid" onSubmit={createAppointment} autoComplete="off" noValidate>
          <TextField label="Số điện thoại *" type="tel" inputMode="numeric" maxLength={10} value={appointmentForm.phone} onChange={(event) => { setAppointmentForm({ ...appointmentForm, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }); setBusinessWarning(''); setAppointmentValidation((current) => current ? { ...current, phone: '', summary: '' } : current); }} autoComplete="off" readOnly={Boolean(editingId)} error={appointmentValidation?.phone} required />
          {appointmentForm.customerStatus === 'new' ? <>
            <TextField label="Họ tên *" value={appointmentForm.customer} onChange={(event) => setAppointmentForm((current) => ({ ...current, customer: event.target.value }))} autoComplete="off" error={appointmentValidation?.customer} required />
            <TextField label="Ngày sinh *" type="date" value={appointmentForm.birthday} max={latestBirthdayDate()} onChange={(event) => setAppointmentForm((current) => ({ ...current, birthday: event.target.value }))} error={appointmentValidation?.birthday} required />
            <p className="form-grid__wide" role="status">Khách mới - hồ sơ sẽ được tạo tự động</p>
          </> : <>
            <TextField label="Họ tên *" value={appointmentForm.customer} autoComplete="off" readOnly required />
            {appointmentForm.customerStatus === 'existing' && <p className="form-grid__wide" role="status">Khách cũ</p>}
            {customerLookup === 'loading' && <p className="form-grid__wide" role="status">Đang kiểm tra số điện thoại...</p>}
          </>}
          <SelectField label="Dịch vụ *" value={appointmentForm.service} onChange={(event) => { setAppointmentForm((current) => ({ ...current, service: event.target.value, end: appointmentEndTime(services, event.target.value, current.start) })); setAppointmentValidation((current) => current ? { ...current, service: '', summary: '' } : current); }} options={[{ value: '', label: services.length ? 'Chọn dịch vụ' : 'Chưa có dịch vụ' }, ...services.map((service) => service.name)]} disabled={Boolean(editingId) || services.length === 0} error={appointmentValidation?.service} required />
          {servicesError && <p className="field__error form-grid__wide" role="alert">{servicesError}</p>}
          <TextField label="Ngày hẹn *" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} required />
          <TextField label="Giờ hẹn *" type="time" value={appointmentForm.start} onChange={(event) => setAppointmentForm((current) => ({ ...current, start: event.target.value, end: appointmentEndTime(services, current.service, event.target.value) }))} required />
          <TextField label="Giờ kết thúc *" type="time" value={appointmentForm.end} onChange={(event) => setAppointmentForm((current) => ({ ...current, end: event.target.value }))} required />
          <label className="field form-grid__wide"><span className="field__label">Ghi chú</span><textarea className="field__control appointment-form__note" value={appointmentForm.note} onChange={(event) => setAppointmentForm({ ...appointmentForm, note: event.target.value })} /></label>
          {appointmentValidation?.summary && <div className="appointment-form-validation form-grid__wide" role="alert"><strong>Thông tin chưa đầy đủ!</strong><span>{appointmentValidation.summary}</span></div>}
          {businessWarning && <div className="appointment-form-validation appointment-form-validation--warning form-grid__wide" role="status"><strong>Khách hàng thuộc danh sách đen</strong><span>{businessWarning}</span></div>}
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={() => setConfirmDiscardOpen(true)}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={confirmDeleteOpen} title="Hủy lịch hẹn" message="Lịch hẹn này sẽ bị hủy. Bạn có chắc chắn muốn hủy?" confirmLabel="Xác nhận" cancelLabel="Quay lại" onCancel={() => setConfirmDeleteOpen(false)} onConfirm={async () => {
            try {
              const cancelled = await apiRequest(`/api/appointments/${selectedAppointment.id}/cancel`, { method: 'POST', body: { reason: '' } });
              setEvents((current) => current.filter((item) => item.id !== selectedAppointment.id));
              showDialog({ tone: 'success', title: 'Hủy lịch hẹn thành công!', closeVariant: 'secondary', size: 'medium', message: `${selectedAppointment.customer}\n${selectedAppointment.phone || ''}\nSố lần hủy lịch: ${cancelled.cancellationCount} lần (trước đó: ${Math.max(0, Number(cancelled.cancellationCount) - 1)})\nĐã lưu bản ghi hủy vào lịch sử khách hàng.` });
              setSelectedAppointment(null);
              setConfirmDeleteOpen(false);
            } catch (error) {
              if (error.isServerError || error.code === 'NETWORK_ERROR') return;
              else showDialog({ title: 'Không thể hủy lịch hẹn', message: error.message });
              setConfirmDeleteOpen(false);
            }
          }} />
      <ConfirmDialog open={confirmDiscardOpen} title="Xác nhận hủy" message="Các thay đổi sẽ không được lưu. Bạn có chắc chắn muốn hủy?" cancelLabel="Quay lại" confirmLabel="Xác nhận" onCancel={() => setConfirmDiscardOpen(false)} onConfirm={() => { setConfirmDiscardOpen(false); setFormOpen(false); setEditingId(null); setAppointmentForm(emptyAppointment); }} />
    </div>
  );
}
