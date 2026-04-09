import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock3, Plus, Save, ShieldCheck } from 'lucide-react';
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
      <div className="bg-white border border-gray-200 p-8 rounded-md shadow-sm">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest italic animate-pulse">Synchronizing configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Systems Engineering</div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Institutional Parameters</h2>
          <p className="mt-2 text-sm text-gray-500">
            Configure recognition protocols, temporal windows, and academic schedules.
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="h-10 px-6 inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 text-sm font-bold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save size={16} />
          {saving ? 'UPDATING...' : 'Commit Changes'}
        </button>
      </div>

      {(status || scheduleHealth || recognitionHealth) && (
        <div className={`rounded border p-4 text-xs font-medium flex items-center gap-3 ${
          (scheduleHealth || recognitionHealth) 
            ? 'border-amber-200 bg-amber-50 text-amber-800' 
            : 'border-indigo-100 bg-indigo-50/30 text-indigo-700'
        }`}>
          <ShieldCheck size={14} className="shrink-0" />
          {scheduleHealth || recognitionHealth || status}
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Attendance Windows */}
        <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Clock3 size={16} className="text-gray-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Temporal Protocols</h3>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Morning Session (Entrance)</label>
                <input 
                  type="time" 
                  name="morning_start" 
                  value={settings.morning_start} 
                  onChange={handleChange} 
                  className="block w-full h-11 border border-gray-200 rounded bg-white text-sm px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-medium" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Morning Session (Exit)</label>
                <input 
                  type="time" 
                  name="morning_end" 
                  value={settings.morning_end} 
                  onChange={handleChange} 
                  className="block w-full h-11 border border-gray-200 rounded bg-white text-sm px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-medium" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Afternoon Session (Entrance)</label>
                <input 
                  type="time" 
                  name="evening_start" 
                  value={settings.evening_start} 
                  onChange={handleChange} 
                  className="block w-full h-11 border border-gray-200 rounded bg-white text-sm px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-medium" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Afternoon Session (Exit)</label>
                <input 
                  type="time" 
                  name="evening_end" 
                  value={settings.evening_end} 
                  onChange={handleChange} 
                  className="block w-full h-11 border border-gray-200 rounded bg-white text-sm px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-medium" 
                />
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-gray-100">
               <label className="flex items-start gap-4 cursor-pointer group">
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    type="checkbox"
                    name="auto_mark_absent"
                    checked={settings.auto_mark_absent}
                    onChange={handleChange}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-900 block mb-1 group-hover:text-indigo-600 transition-colors">Autonomous Status Enforcement</span>
                  <span className="text-xs text-gray-500 leading-relaxed italic">
                    Execute automated absence cataloging for students failing to register within established windows.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Recognition Settings */}
        <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <ShieldCheck size={16} className="text-gray-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Recognition Algorithms</h3>
          </div>

          <div className="p-8 space-y-8 flex-1">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Minimum Confidence Coefficient (0.0 - 1.0)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0" 
                max="1" 
                name="auto_accept_threshold" 
                value={settings.auto_accept_threshold} 
                onChange={handleChange} 
                className="block w-full h-11 border border-gray-200 rounded bg-white text-sm px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono font-bold" 
              />
              <p className="text-[10px] font-medium text-gray-400 italic">Recommended threshold: 0.78 for balanced biometric precision.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Biometric Cooldown Period (Seconds)</label>
              <input 
                type="number" 
                min="1" 
                max="300" 
                name="cooldown_seconds" 
                value={settings.cooldown_seconds} 
                onChange={handleChange} 
                className="block w-full h-11 border border-gray-200 rounded bg-white text-sm px-4 focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-mono font-bold" 
              />
              <p className="text-[10px] font-medium text-gray-400 italic">Inhibit consecutive registration events for the same institutional identity.</p>
            </div>

            <div className="p-5 rounded border border-indigo-100 bg-indigo-50/10">
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-900 mb-2">High-Throughput Configuration</div>
              <p className="text-xs text-indigo-700/80 leading-relaxed font-medium">
                The current architecture utilizes single-frame confirming matching logic to maximize speed at terminal stations. 
                Matches are instantaneously cataloged upon clearing the above confidence threshold.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Holiday Calendar Section */}
      <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <CalendarDays size={16} className="text-gray-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-900">Institutional Holiday Calendar</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[380px,1fr] divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Holiday Form */}
          <div className="p-8 bg-gray-50/30">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Schedule New Event</h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Date</label>
                <input 
                  type="date" 
                  name="date" 
                  value={holidayForm.date} 
                  onChange={handleHolidayChange} 
                  className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Event Description</label>
                <input 
                  type="text" 
                  name="reason" 
                  value={holidayForm.reason} 
                  onChange={handleHolidayChange} 
                  className="block w-full h-10 border border-gray-200 rounded bg-white text-sm px-3 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g. Founder's Day Observance" 
                />
              </div>
              <button
                type="button"
                onClick={saveHoliday}
                disabled={holidayLoading}
                className="w-full h-10 px-4 rounded bg-gray-900 text-xs font-bold uppercase tracking-widest text-white hover:bg-black disabled:opacity-50 transition-colors shadow-sm"
              >
                <Plus size={14} className="inline mr-2" />
                {holidayLoading ? 'Processing...' : 'Add Objective'}
              </button>
              {holidayStatus && <div className="text-[10px] font-bold uppercase tracking-tight text-indigo-600 bg-indigo-50 p-2 rounded">{holidayStatus}</div>}
            </div>
          </div>

          {/* Holiday Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Registry Date</th>
                  <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">Institutional Occasion</th>
                  <th className="px-6 py-3 font-bold text-gray-600 uppercase tracking-widest text-[10px] text-right">Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center text-xs font-medium text-gray-300 uppercase tracking-widest italic">
                      Zero custom holiday events scheduled.
                    </td>
                  </tr>
                ) : (
                  holidays.map((holiday) => (
                    <tr key={holiday.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {new Date(holiday.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {holiday.reason || 'Institutional Holiday'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void removeHoliday(holiday.id)}
                          disabled={holidayLoading}
                          className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminSettings;
