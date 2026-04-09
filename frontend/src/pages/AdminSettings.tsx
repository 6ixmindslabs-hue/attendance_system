import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock3, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';
import type { AttendanceSettings, HolidayItem } from '../types/app';

const defaultSettings: AttendanceSettings = {
  morning_start: '08:30',
  morning_end: '10:00',
  evening_start: '15:30',
  evening_end: '17:00',
  auto_mark_absent: true,
  auto_accept_threshold: 0.78,
  review_threshold: 0.58,
  consensus_frames: 1,
  cooldown_seconds: 20,
  review_expiry_minutes: 90
};

const getTodayDateString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const sortHolidays = (items: HolidayItem[]) => [...items].sort((left, right) => left.date.localeCompare(right.date));

const upsertHoliday = (items: HolidayItem[], nextHoliday: HolidayItem) => sortHolidays([
  ...items.filter((holiday) => holiday.id !== nextHoliday.id && holiday.date !== nextHoliday.date),
  nextHoliday
]);

const mapIncomingSettings = (incoming: Partial<AttendanceSettings>) => ({
  morning_start: incoming.morning_start?.slice(0, 5) || defaultSettings.morning_start,
  morning_end: incoming.morning_end?.slice(0, 5) || defaultSettings.morning_end,
  evening_start: incoming.evening_start?.slice(0, 5) || defaultSettings.evening_start,
  evening_end: incoming.evening_end?.slice(0, 5) || defaultSettings.evening_end,
  auto_mark_absent: Boolean(incoming.auto_mark_absent),
  auto_accept_threshold: Math.max(
    Number(incoming.auto_accept_threshold ?? defaultSettings.auto_accept_threshold),
    defaultSettings.auto_accept_threshold
  ),
  review_threshold: Number(incoming.review_threshold ?? defaultSettings.review_threshold),
  consensus_frames: defaultSettings.consensus_frames,
  cooldown_seconds: Number(incoming.cooldown_seconds ?? defaultSettings.cooldown_seconds),
  review_expiry_minutes: Number(incoming.review_expiry_minutes ?? defaultSettings.review_expiry_minutes)
});

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<AttendanceSettings>(defaultSettings);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [holidayForm, setHolidayForm] = useState({
    date: getTodayDateString(),
    reason: 'College Holiday'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [holidayStatus, setHolidayStatus] = useState('');

  const scheduleHealth = (() => {
    if (settings.morning_start >= settings.morning_end) {
      return 'Morning start time must be earlier than morning end time.';
    }

    if (settings.evening_start >= settings.evening_end) {
      return 'Afternoon start time must be earlier than afternoon end time.';
    }

    if (settings.morning_end > settings.evening_start) {
      return 'Morning attendance should end before the afternoon window begins.';
    }

    return '';
  })();

  const recognitionHealth = (() => {
    if (Number(settings.auto_accept_threshold) < 0 || Number(settings.auto_accept_threshold) > 1) {
      return 'Minimum recognition confidence must stay between 0 and 1.';
    }

    if (Number(settings.consensus_frames) < 1) {
      return 'Stable frames required must be at least 1.';
    }

    if (Number(settings.cooldown_seconds) < 1) {
      return 'Repeat scan gap must be at least 1 second.';
    }

    return '';
  })();

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get<{ settings: AttendanceSettings }>('/settings/attendance');
      setSettings(mapIncomingSettings(response.data.settings || {}));
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, 'Failed to load attendance settings.'));
    }
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
      const response = await api.get<{ holidays: HolidayItem[] }>('/settings/holidays');
      setHolidays(sortHolidays(response.data.holidays || []));
    } catch (requestError: unknown) {
      setHolidayStatus(getApiErrorMessage(requestError, 'Failed to load holidays.'));
    }
  }, []);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchSettings(), fetchHolidays()]);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [fetchHolidays, fetchSettings]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    } as AttendanceSettings));
  };

  const handleHolidayChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setHolidayForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatus('');

    if (scheduleHealth || recognitionHealth) {
      setStatus(scheduleHealth || recognitionHealth);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...settings,
        auto_accept_threshold: Number(settings.auto_accept_threshold),
        review_threshold: Number(settings.review_threshold),
        consensus_frames: defaultSettings.consensus_frames,
        cooldown_seconds: Number(settings.cooldown_seconds),
        review_expiry_minutes: Number(settings.review_expiry_minutes)
      };
      const response = await api.put<{ message: string; settings: AttendanceSettings }>('/settings/attendance', payload);
      if (response.data.settings) {
        setSettings(mapIncomingSettings(response.data.settings));
      }
      setStatus(response.data.message || 'Attendance settings saved successfully.');
    } catch (requestError: unknown) {
      setStatus(getApiErrorMessage(requestError, 'Failed to save attendance settings.'));
    } finally {
      setSaving(false);
    }
  };

  const saveHoliday = async () => {
    if (!holidayForm.date) {
      setHolidayStatus('Holiday date is required.');
      return;
    }

    setHolidayLoading(true);
    setHolidayStatus('');

    try {
      const response = await api.post<{ message: string; holiday?: HolidayItem }>('/settings/holidays', {
        date: holidayForm.date,
        reason: holidayForm.reason || 'College Holiday',
        is_holiday: true
      });
      setHolidayStatus(response.data.message || 'Holiday saved successfully.');
      if (response.data.holiday) {
        setHolidays((prev) => upsertHoliday(prev, response.data.holiday as HolidayItem));
      } else {
        await fetchHolidays();
      }
    } catch (requestError: unknown) {
      setHolidayStatus(getApiErrorMessage(requestError, 'Failed to save holiday.'));
    } finally {
      setHolidayLoading(false);
    }
  };

  const removeHoliday = async (holidayId: string) => {
    setHolidayLoading(true);
    setHolidayStatus('');
    try {
      const response = await api.delete<{ message: string }>(`/settings/holidays/${holidayId}`);
      setHolidayStatus(response.data.message || 'Holiday removed successfully.');
      setHolidays((prev) => prev.filter((holiday) => holiday.id !== holidayId));
    } catch (requestError: unknown) {
      setHolidayStatus(getApiErrorMessage(requestError, 'Failed to delete holiday.'));
    } finally {
      setHolidayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
        <p className="text-slate-500 italic">Loading attendance settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#164e63_45%,#0f766e_100%)] px-6 py-7 text-white sm:px-8">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">System Settings</div>
            <h2 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
              <Clock3 />
              Attendance and recognition controls
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200/85">
              Configure daily attendance windows, face recognition confidence, repeat scan gap, and holiday dates from one page.
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-1 text-slate-700" />
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Attendance windows</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Students can scan only during these active attendance periods.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Morning Start</label>
                  <input type="time" name="morning_start" value={settings.morning_start} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Morning End</label>
                  <input type="time" name="morning_end" value={settings.morning_end} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Afternoon Start</label>
                  <input type="time" name="evening_start" value={settings.evening_start} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Afternoon End</label>
                  <input type="time" name="evening_end" value={settings.evening_end} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3" />
                </div>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  name="auto_mark_absent"
                  checked={settings.auto_mark_absent}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span className="font-medium text-slate-700">Auto-mark absent after a window closes</span>
              </label>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 text-emerald-700" />
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Recognition controls</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Attendance is saved instantly when a scan passes the required confidence. Repeated scans are allowed after the cooldown gap.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Minimum Recognition Confidence</label>
                  <input type="number" step="0.01" min="0" max="1" name="auto_accept_threshold" value={settings.auto_accept_threshold} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Confirmation Mode</label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900">
                    1 confirmation
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Attendance is saved on the first strong match.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Repeat Scan Gap (seconds)</label>
                  <input type="number" min="1" max="300" name="cooldown_seconds" value={settings.cooldown_seconds} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3" />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    This prevents the same face from being captured repeatedly within a few seconds while still allowing multiple attendance scans later.
                  </p>
                </div>
              </div>

              {(scheduleHealth || recognitionHealth) ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {scheduleHealth || recognitionHealth}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {status ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {status}
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-5">
          <CalendarDays className="text-violet-600" />
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Holiday calendar</h3>
            <p className="text-sm text-slate-500">Attendance sync skips Sundays and every date listed here as a holiday.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[360px,1fr]">
          <div className="space-y-4 rounded-[28px] border border-violet-100 bg-violet-50 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-violet-950">Holiday Date</label>
              <input type="date" name="date" value={holidayForm.date} onChange={handleHolidayChange} className="w-full rounded-2xl border border-violet-100 bg-white px-3 py-3" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-violet-950">Reason</label>
              <input type="text" name="reason" value={holidayForm.reason} onChange={handleHolidayChange} className="w-full rounded-2xl border border-violet-100 bg-white px-3 py-3" placeholder="Ex: Founders Day" />
            </div>
            <button
              type="button"
              onClick={saveHoliday}
              disabled={holidayLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Plus size={16} /> {holidayLoading ? 'Saving...' : 'Save Holiday'}
            </button>
            {holidayStatus ? (
              <div className="rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm text-slate-700">
                {holidayStatus}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Reason</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm italic text-slate-400">
                        No holidays saved yet.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((holiday) => (
                      <tr key={holiday.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 font-medium text-slate-900">{holiday.date}</td>
                        <td className="px-4 py-3 text-slate-600">{holiday.reason || 'Holiday'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                            {holiday.is_holiday ? 'Skipped for attendance' : 'Open'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void removeHoliday(holiday.id)}
                            disabled={holidayLoading}
                            className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminSettings;
