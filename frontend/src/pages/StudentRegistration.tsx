import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle2, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';

const DEPARTMENT_OPTIONS = ['ECE', 'EEE', 'CSE', 'CIVIL', 'MECH', 'IT'];
const OTHER_DEPARTMENT_OPTION = 'OTHER';

type RegistrationResult = {
  acceptedCount?: number;
  rejectedCount?: number;
  warnings?: string[];
};

export default function StudentRegistration() {
  const [step, setStep] = useState(1);
  
  const webcamRef = useRef<Webcam>(null);
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  
  const [selectedDepartmentOption, setSelectedDepartmentOption] = useState('CSE');
  const [formData, setFormData] = useState({
    register_number: '',
    name: '',
    dob: '',
    blood_group: '',
    address: '',
    department_name: 'CSE',
    year: '1',
    semester: '1',
    parent_phone: ''
  });

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc && images.length < 15) {
      setImages((prev) => [...prev, imageSrc]);
    }
  }, [images.length]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDepartmentChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    setSelectedDepartmentOption(value);
    setFormData((prev) => ({
      ...prev,
      department_name: value === OTHER_DEPARTMENT_OPTION ? '' : value
    }));
  };

  const resetRegistration = () => {
    setImages([]);
    setSelectedDepartmentOption('CSE');
    setFormData({
      register_number: '', name: '', dob: '', blood_group: '',
      address: '', department_name: 'CSE', year: '1', semester: '1', parent_phone: ''
    });
    setResult(null);
    setStatus({ type: '', text: '' });
    setStep(1);
  };

  const submitRegistration = async () => {
    if (images.length < 15) {
      setStatus({ type: 'error', text: 'Please capture all 15 images.' });
      return;
    }
    if (selectedDepartmentOption === OTHER_DEPARTMENT_OPTION && !formData.department_name.trim()) {
      setStatus({ type: 'error', text: 'Please type the custom department name.' });
      return;
    }

    setSaving(true);
    setResult(null);
    setStatus({ type: 'info', text: 'Registering student and validating biometric captures...' });
    
    try {
      const payload = { ...formData, images };
      const response = await api.post<any>('/students', payload);
      setStatus({ type: 'success', text: response.data.message });
      setResult({
        acceptedCount: response.data.acceptedCount,
        rejectedCount: response.data.rejectedCount,
        warnings: response.data.warnings || []
      });
      setStep(4); // Move to completion page
    } catch (requestError: unknown) {
      setStatus({ type: 'error', text: getApiErrorMessage(requestError, 'Registration failed.') });
    } finally {
      setSaving(false);
    }
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.register_number) {
       setStatus({ type: 'error', text: 'Name and Register Number are required.' });
       return false;
    }
    setStatus({ type: '', text: '' });
    return true;
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Register New Student</h2>
        <p className="text-gray-500 text-sm mt-1">Complete the profile and register facial biometrics.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Progress Indicator */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <StepIndicator number={1} title="Details" active={step === 1} completed={step > 1} />
          <StepIndicator number={2} title="Face Capture" active={step === 2} completed={step > 2} />
          <StepIndicator number={3} title="Review" active={step === 3} completed={step > 3} />
        </div>

        <div className="p-8">
          {status.text && step < 4 && (
             <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                 status.type === 'error' ? 'bg-rose-50 text-rose-700' : 
                 status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
             }`}>
                <AlertCircle size={18} />
                {status.text}
             </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input name="name" value={formData.name} onChange={handleInputChange} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all" placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Register Number</label>
                  <input name="register_number" value={formData.register_number} onChange={handleInputChange} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all" placeholder="CS2024001" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                  <input name="dob" value={formData.dob} onChange={handleInputChange} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Blood Group</label>
                  <input name="blood_group" value={formData.blood_group} onChange={handleInputChange} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="O+" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Parent Phone</label>
                  <input name="parent_phone" value={formData.parent_phone} onChange={handleInputChange} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="9876543210" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <select value={selectedDepartmentOption} onChange={handleDepartmentChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                    {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value={OTHER_DEPARTMENT_OPTION}>Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Year</label>
                  <input name="year" value={formData.year} onChange={handleInputChange} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Semester</label>
                  <input name="semester" value={formData.semester} onChange={handleInputChange} type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
              </div>
              
              {selectedDepartmentOption === OTHER_DEPARTMENT_OPTION && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Custom Department</label>
                  <input name="department_name" value={formData.department_name} onChange={handleInputChange} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Type here..." />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <textarea name="address" value={formData.address} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>

              <div className="pt-4 flex justify-end">
                <button onClick={() => { if(validateStep1()) setStep(2); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
                  Next Step <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col animate-in fade-in duration-500 max-w-2xl mx-auto">
              <div className="bg-gray-900 rounded-2xl overflow-hidden relative aspect-video flex-shrink-0 flex items-center justify-center border border-gray-200">
                 <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" />
                 
                 {/* Visual Guide Overlay */}
                 <div className="absolute inset-0 border-[4px] border-white/20 border-dashed rounded-[30%] m-8 ml-[15%] mr-[15%] pointer-events-none shadow-[0_0_0_999px_rgba(0,0,0,0.4)]"></div>

                 <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur text-white px-3 py-1 rounded-full text-sm font-medium">
                   {images.length}/15 Captures
                 </div>
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Face Biometric Scan</h4>
                  <p className="text-gray-500 text-xs mt-1">Capture at least 15 frames for AI registration.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setImages([])} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">Reset</button>
                  <button onClick={capture} disabled={images.length >= 15} className={`px-5 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-transform active:scale-95 ${images.length >= 15 ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    <Camera size={16} /> Snap Frame
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6 w-full bg-gray-100 rounded-full h-2">
                 <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(images.length / 15) * 100}%` }}></div>
              </div>

              <div className="pt-8 flex justify-between border-t border-gray-100 mt-8">
                <button onClick={() => setStep(1)} className="px-5 py-2 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">Back</button>
                <button onClick={() => setStep(3)} disabled={images.length < 15} className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-colors ${images.length < 15 ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  Review & Submit <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
             <div className="animate-in fade-in duration-500">
               <h3 className="text-lg font-bold text-gray-900 mb-6">Review Registration</h3>
               
               <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6 flex gap-6">
                 <div>
                   <p className="text-xs text-gray-500 mb-1">Name</p>
                   <p className="font-semibold text-gray-900">{formData.name}</p>
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 mb-1">Registration</p>
                   <p className="font-semibold text-indigo-700">{formData.register_number}</p>
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 mb-1">Department</p>
                   <p className="font-semibold text-gray-900">{formData.department_name}</p>
                 </div>
                 <div>
                   <p className="text-xs text-gray-500 mb-1">Biometrics</p>
                   <p className="font-semibold text-emerald-600">15 Captures Ready</p>
                 </div>
               </div>

               <div className="grid grid-cols-5 gap-2 mb-8">
                  {images.slice(0, 5).map((img, i) => (
                    <img key={i} src={img} className="w-full aspect-square object-cover rounded-lg border border-gray-200 opacity-80 pointer-events-none" />
                  ))}
               </div>

               <div className="pt-6 flex gap-3 justify-end border-t border-gray-100">
                 <button onClick={() => setStep(2)} disabled={saving} className="px-5 py-2 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Back</button>
                 <button onClick={submitRegistration} disabled={saving} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
                   {saving ? <><Loader2 size={16} className="animate-spin" /> Processing AI Embeddings...</> : 'Send to Database'}
                 </button>
               </div>
             </div>
          )}
          
          {step === 4 && (
             <div className="text-center py-10 animate-in zoom-in-95 duration-500">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-emerald-100">
                 <CheckCircle2 size={40} />
               </div>
               <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Registration Complete</h3>
               <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                 {formData.name} ({formData.register_number}) has been saved. Biometrics processed: 
                 <span className="font-semibold text-emerald-600 ml-1">{result?.acceptedCount || 0} accepted</span>.
               </p>
               
               {result?.warnings && result.warnings.length > 0 && (
                  <div className="mt-6 max-w-md mx-auto text-left bg-amber-50 p-4 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <p className="font-bold mb-1">Warnings during processing:</p>
                    <ul className="list-disc pl-5 space-y-1">
                       {result.warnings.map((w,i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
               )}

               <button onClick={resetRegistration} className="mt-8 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition">
                 Register Another Student
               </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ number, title, active, completed }: any) {
  return (
    <div className={`flex-1 px-4 py-3 sm:py-4 flex items-center gap-3 border-r last:border-r-0 border-gray-200 transition-colors
      ${active ? 'bg-white' : 'bg-transparent'}`}>
      <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors
        ${completed ? 'bg-emerald-500 text-white shadow-sm' : active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-200 text-gray-500'}`}>
        {completed ? <CheckCircle2 size={16} /> : number}
      </div>
      <div>
        <p className={`text-xs sm:text-sm font-semibold tracking-tight ${active ? 'text-indigo-900' : 'text-gray-500'}`}>{title}</p>
      </div>
    </div>
  );
}
