import { useState } from 'react';
import axios from 'axios';
import { apiClient } from '../api/client';


export default function ProjectBuilder({ onExit }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    projectName: '',
    elevatorPitch: '',
    description: '',
    techStack: '',
    repoUrl: '',
    videoUrl: '',
    assetUrl: ''
  });

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    setUploadError('');

    if (!cloudName || !uploadPreset) {
      setUploadError('Cloudinary is not configured. Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in hackathon-client/.env, then restart the dev server.');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large. Please upload a file under 10MB.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);

    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', uploadPreset);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        data,
        {
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 1;
            const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      setFormData(prev => ({ ...prev, assetUrl: res.data.secure_url }));
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to upload asset. Please try again.';

      setUploadError(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await apiClient.post('/projects/submit', {
        title: formData.projectName,
        description: formData.description,
        repo_url: formData.repoUrl,
        video_demo_url: formData.videoUrl,
        tech_stack: formData.techStack,
        asset_url: formData.assetUrl
      });

      alert(`Success! ${response.data.message}`);
      onExit(true);
    } catch (error) {
      alert(error.response?.data?.detail || 'An error occurred submitting your project.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Back to Hub
          </button>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-bold text-gray-900">
            {formData.projectName || 'Untitled Project'} <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded ml-2">DRAFT</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            47 hours to deadline
          </span>
          <button className="text-sm border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50 font-medium">
            Preview
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-8">
        {/* Stepper Navigation */}
        <div className="flex mb-12 border-b border-gray-200 bg-white shadow-sm rounded-t-lg overflow-hidden">
          {['Project overview', 'Project details', 'Assets & Links', 'Submit'].map((stepName, idx) => {
            const stepNum = idx + 1;
            const isActive = currentStep === stepNum;
            const isCompleted = currentStep > stepNum;

            return (
              <div
                key={stepNum}
                className={`flex-1 py-4 px-6 text-sm font-medium text-center border-r last:border-r-0 transition-colors
                  ${isActive ? 'bg-blue-50/50 border-b-2 border-b-blue-600 text-blue-700' : 'text-gray-500'}
                  ${isCompleted ? 'text-green-600' : ''}
                `}
              >
                <span className="mr-2">
                  {isCompleted ? 'Done' : isActive ? 'Active' : stepNum}
                </span>
                {stepName}
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <div className="bg-white p-10 rounded-b-lg rounded-t-none shadow-sm border border-gray-200 border-t-0 -mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            {currentStep === 1 && 'Project overview'}
            {currentStep === 2 && 'Project details'}
            {currentStep === 3 && 'Assets & Links'}
            {currentStep === 4 && 'Ready to submit?'}
          </h2>

          <form onSubmit={currentStep === totalSteps ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            {/* STEP 1: Overview */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">
                    <span className="text-red-500">*</span> Project name
                  </label>
                  <p className="text-xs text-gray-500 mb-2">You can change this at any time.</p>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">{60 - formData.projectName.length} characters left</div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">
                    <span className="text-red-500">*</span> Elevator pitch
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Provide a short tagline for the project.</p>
                  <textarea
                    required
                    rows={3}
                    maxLength={200}
                    value={formData.elevatorPitch}
                    onChange={(e) => setFormData({ ...formData, elevatorPitch: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">{200 - formData.elevatorPitch.length} characters left</div>
                </div>
              </div>
            )}

            {/* STEP 2: Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">
                    <span className="text-red-500">*</span> Full Description
                  </label>
                  <p className="text-xs text-gray-500 mb-2">What inspired you? How did you build it? What's next?</p>
                  <textarea
                    required
                    rows={8}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
                    placeholder="Write your markdown description here..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Built With</label>
                  <p className="text-xs text-gray-500 mb-2">Languages, frameworks, databases, and APIs.</p>
                  <input
                    type="text"
                    value={formData.techStack}
                    onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
                    placeholder="e.g., React, FastAPI, PostgreSQL"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Assets */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* The Cloudinary Dropzone */}
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                    accept="image/*,.pdf"
                  />

                  {isUploading ? (
                    <div className="text-blue-600 font-bold animate-pulse">
                      Uploading to Cloudinary... {uploadProgress}%
                    </div>
                  ) : formData.assetUrl ? (
                    <div className="text-green-600 font-bold">
                      Asset Uploaded Successfully!
                      <p className="text-xs text-gray-500 font-normal mt-2 break-all">{formData.assetUrl}</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl mb-2">Cloud upload</div>
                      <p className="text-sm font-medium text-gray-700">Drag files here or <span className="text-blue-600">browse</span></p>
                      <p className="text-xs text-gray-500 mt-1">Upload your presentation PDF or architecture diagram (Max 10MB)</p>
                    </>
                  )}
                </div>

                {uploadError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {uploadError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">
                    <span className="text-red-500">*</span> GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.repoUrl}
                    onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Video Demo URL</label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://youtube.com/... (Optional)"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-md border border-gray-200">
                  <h3 className="font-bold text-lg mb-4 text-gray-900">Review your submission</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-gray-500 font-medium">Project Name:</div>
                    <div className="col-span-2 font-bold text-gray-900">{formData.projectName || '-'}</div>

                    <div className="text-gray-500 font-medium">Elevator Pitch:</div>
                    <div className="col-span-2 text-gray-800">{formData.elevatorPitch || '-'}</div>

                    <div className="text-gray-500 font-medium">Repository:</div>
                    <div className="col-span-2 text-blue-600">{formData.repoUrl || '-'}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  By clicking submit, you confirm that your team has adhered to the Hackathon rules and that the code submitted is your original work.
                </p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-10 pt-6 border-t border-gray-100 flex gap-4">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}

              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors ml-auto"
              >
                {currentStep === totalSteps ? 'Submit to Judges' : 'Save & Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
