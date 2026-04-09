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
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Page Title */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 leading-none">Student Registration</h2>
        <p className="text-sm text-gray-500 mt-2">Onboard new students and capture biometric markers.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {/* Progress Indicator */}
        <div className="flex bg-gray-50/50 border-b border-gray-200">
          <StepIndicator number={1} title="Identity Details" active={step === 1} completed={step > 1} />
          <StepIndicator number={2} title="Face Enrollment" active={step === 2} completed={step > 2} />
          <StepIndicator number={3} title="Review Submission" active={step === 3} completed={step > 3} />
        </div>

        <div className="p-8">
          {status.text && step < 4 && (
             <div className={`mb-8 p-4 rounded border text-sm flex items-center gap-3 ${
                 status.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 
                 status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                 'bg-indigo-50 border-indigo-100 text-indigo-700'
             }`}>
                <AlertCircle size={18} />
                {status.text}
             </div>
          )}

          {step === 1 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Student Full Name</label>
                  <input name="name" value={formData.name} onChange={handleInputChange} type="text" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3" placeholder="Jane Doe" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Institutional ID (Register No.)</label>
                  <input name="register_number" value={formData.register_number} onChange={handleInputChange} type="text" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3" placeholder="ID-2024-XXXX" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                  <input name="dob" value={formData.dob} onChange={handleInputChange} type="date" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Blood Group</label>
                  <input name="blood_group" value={formData.blood_group} onChange={handleInputChange} type="text" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3" placeholder="A+" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Emergency Phone</label>
                  <input name="parent_phone" value={formData.parent_phone} onChange={handleInputChange} type="text" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3" placeholder="+91 XXXXXXXXXX" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Academic Department</label>
                  <select value={selectedDepartmentOption} onChange={handleDepartmentChange} className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3 bg-white">
                    {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value={OTHER_DEPARTMENT_OPTION}>Manual Entry</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Current Year</label>
                  <input name="year" value={formData.year} onChange={handleInputChange} type="number" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Current Semester</label>
                  <input name="semester" value={formData.semester} onChange={handleInputChange} type="number" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3" />
                </div>
              </div>
              
              {selectedDepartmentOption === OTHER_DEPARTMENT_OPTION && (
                <div className="space-y-1.5 p-4 bg-gray-50 rounded border border-gray-200">
                  <label className="text-sm font-medium text-gray-700">Enter Department Name</label>
                  <input name="department_name" value={formData.department_name} onChange={handleInputChange} type="text" className="block w-full h-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors px-3 bg-white" placeholder="e.g. Bio-Technology" />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Residential Address</label>
                <textarea name="address" value={formData.address} onChange={handleInputChange} rows={3} className="block w-full border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors p-3" />
              </div>

              <div className="pt-8 flex justify-end">
                <button onClick={() => { if(validateStep1()) setStep(2); }} className="h-10 px-6 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  Continue Enrollment <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col max-w-2xl mx-auto">
              <div className="bg-black rounded-lg overflow-hidden relative aspect-video border border-gray-200">
                 <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover -scale-x-100" />
                 
                 {/* Visual Guide Overlay - Industrial Look */}
                 <div className="absolute inset-0 border-2 border-white/20 m-12 pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500" />
                 </div>

                 <div className="absolute bottom-4 right-4 bg-black/80 px-4 py-1.5 rounded text-xs font-mono tracking-widest text-white border border-white/10 uppercase">
                   {images.length}/15 Captures
                 </div>
              </div>
              
              <div className="mt-8 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Facial Biometric Enrollment</h4>
                  <p className="text-xs text-gray-500 mt-1">Capture multiple angles to improve identification precision.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setImages([])} className="h-10 px-4 border border-gray-300 bg-white text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50">Clear</button>
                  <button onClick={capture} disabled={images.length >= 15} className={`h-10 px-6 rounded-md text-sm font-medium text-white flex items-center gap-2 transition-transform active:scale-95 ${images.length >= 15 ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    <Camera size={16} /> Capture Frame
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-8">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                   <span>Enrollment Buffer</span>
                   <span>{Math.round((images.length / 15) * 100)}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${(images.length / 15) * 100}%` }}></div>
                 </div>
              </div>

              <div className="pt-10 flex justify-between border-t border-gray-100 mt-10">
                <button onClick={() => setStep(1)} className="h-10 px-4 text-gray-600 font-medium hover:text-gray-900 text-sm">Return to identity details</button>
                <button onClick={() => setStep(3)} disabled={images.length < 15} className={`h-10 px-6 rounded-md text-sm font-medium text-white flex items-center gap-2 ${images.length < 15 ? 'bg-indigo-300' : 'bg-indigo-800 hover:bg-indigo-900'}`}>
                  Review Submission <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
             <div className="space-y-8 animate-in fade-in duration-500">
               <div>
                  <h3 className="text-base font-semibold text-gray-900">Review Application</h3>
                  <p className="text-sm text-gray-500">Ensure all details are accurate before database sync.</p>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-lg bg-gray-50 border border-gray-100">
                 <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Full Name</p>
                   <p className="text-sm font-semibold text-gray-900">{formData.name}</p>
                 </div>
                 <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Registry ID</p>
                   <p className="text-sm font-bold text-indigo-700">{formData.register_number}</p>
                 </div>
                 <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Department</p>
                   <p className="text-sm font-semibold text-gray-900">{formData.department_name}</p>
                 </div>
                 <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Biometrics</p>
                   <p className="text-sm font-bold text-emerald-600">15 Captures</p>
                 </div>
               </div>

               <div className="grid grid-cols-5 gap-4">
                  {images.slice(0, 5).map((img, i) => (
                    <div key={i} className="aspect-square bg-gray-100 rounded border border-gray-200 overflow-hidden grayscale opacity-60">
                      <img src={img} className="w-full h-full object-cover" />
                    </div>
                  ))}
               </div>

               <div className="pt-10 flex gap-4 justify-end border-t border-gray-100">
                 <button onClick={() => setStep(2)} disabled={saving} className="h-10 px-6 border border-gray-300 bg-white text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Back</button>
                 <button onClick={submitRegistration} disabled={saving} className="h-10 px-8 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2 shadow-sm disabled:opacity-70">
                   {saving ? <><Loader2 size={16} className="animate-spin" /> Finalizing Database Registry...</> : 'Confirm & Register'}
                 </button>
               </div>
             </div>
          )}
          
          {step === 4 && (
             <div className="text-center py-12 animate-in zoom-in-95 duration-500">
               <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <CheckCircle2 size={32} />
               </div>
               <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Registration Finalized</h3>
               <p className="text-sm text-gray-500 mt-3 max-w-sm mx-auto leading-relaxed">
                 Institutional record for <span className="font-semibold text-gray-900">{formData.name}</span> has been established. 
                 Biometric signatures: <span className="font-bold text-emerald-600">{result?.acceptedCount || 0} unique markers</span>.
               </p>
               
               {result?.warnings && result.warnings.length > 0 && (
                  <div className="mt-10 max-w-md mx-auto text-left bg-amber-50 p-5 rounded-md border border-amber-100 text-xs text-amber-800">
                    <p className="font-bold uppercase tracking-widest mb-2 opacity-70">Processing Notes:</p>
                    <ul className="space-y-1.5 opacity-90">
                       {result.warnings.map((w,i) => <li key={i} className="flex items-start gap-2"><span>•</span>{w}</li>)}
                    </ul>
                  </div>
               )}

               <button onClick={resetRegistration} className="mt-12 h-10 px-8 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
                 Continue to Next Registration
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
    <div className={`flex-1 px-6 py-5 flex items-center gap-4 border-r last:border-r-0 border-gray-200 transition-colors
      ${active ? 'bg-white' : 'bg-transparent'}`}>
      <div className={`w-8 h-8 shrink-0 rounded flex items-center justify-center text-xs font-bold transition-colors
        ${completed ? 'bg-emerald-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
        {completed ? <CheckCircle2 size={16} /> : number}
      </div>
      <div className="text-left">
        <p className={`text-[10px] font-bold uppercase tracking-[0.15em] leading-none mb-1 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>Step {number}</p>
        <p className={`text-sm font-semibold whitespace-nowrap leading-none ${active ? 'text-gray-900' : 'text-gray-500'}`}>{title}</p>
      </div>
    </div>
  );
}
