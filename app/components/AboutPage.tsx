'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export default function AboutPage() {
  const [feedback, setFeedback] = useState({
    additionalData: '',
    excludeData: '',
    recommendedPublications: '',
    additionalComments: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFeedback(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    // Handle feedback submission here
    console.log('Feedback submitted:', feedback);
    // You can add API call here to submit feedback
    alert('Thank you for your feedback!');
    
    // Reset form
    setFeedback({
      additionalData: '',
      excludeData: '',
      recommendedPublications: '',
      additionalComments: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="mprint-header-bg-blue shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <a href="https://www.mprint.org/" target="_blank">
                  <Image src="/images/mprint-logo.png" alt="mprint logo" width="180" height="60" />
                </a>              
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Knowledge Portal (Silver)</h1>
            </div>
            <nav className="flex space-x-8">
              <a href="/" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                Explore
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 px-1 py-2 text-sm font-medium">
                How we help the community
              </a>
              <a href="/about" className="text-blue-600 border-b-2 border-blue-600 px-1 py-2 text-sm font-medium">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: About MPRINT */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">About MPRINT</h2>
            
            <div className="space-y-4 text-gray-800 leading-relaxed">
              <p>
                The MPRINT Hub serves as a national resource for expertise in maternal and pediatric therapeutics to conduct and foster therapeutics-focused research in obstetrics, lactation, and pediatrics while enhancing inclusion of people with disabilities.
              </p>
              
              <p>
                The MPRINT Hub consists of the Indiana University-Ohio State University Data and Model Knowledge and Research Coordination Center (IU-OSU DMKRCC) and two Centers of Excellence in Therapeutics (CETs):
              </p>
              
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  The Vanderbilt Integrated Center of Excellence in Maternal and Pediatric pRecisioN Therapeutics (VICE-MPRINT)
                </li>
                <li>
                  The University of California San Diego MPRINT Center of Excellence in Therapeutics.
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: User's Feedback */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">User's feedback</h2>
            
            <p className="text-gray-700 mb-6">
              Please contact Mprint for feedback, suggestions, or to report errors or bugs.
            </p>

            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What additional data element would you like to add in the current knowledgebase?
                </label>
                <textarea
                  value={feedback.additionalData}
                  onChange={(e) => handleInputChange('additionalData', e.target.value)}
                  placeholder="Thanks for your feedbacks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What data element would you prefer to exclude from current knowledgebase?
                </label>
                <textarea
                  value={feedback.excludeData}
                  onChange={(e) => handleInputChange('excludeData', e.target.value)}
                  placeholder="Thanks for your feedbacks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What publication(s) would you like to recommend so that we could add into the current knowledgebase?
                </label>
                <textarea
                  value={feedback.recommendedPublications}
                  onChange={(e) => handleInputChange('recommendedPublications', e.target.value)}
                  placeholder="Thanks for your feedbacks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any additional comments or feedbacks
                </label>
                <textarea
                  value={feedback.additionalComments}
                  onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                  placeholder="Thanks for your feedbacks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full bg-gray-300 text-gray-700 py-3 px-4 rounded-md font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
