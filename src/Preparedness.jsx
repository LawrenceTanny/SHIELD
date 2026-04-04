import React, { useState } from 'react';
import './Styles/Preparedness.css';

const PreparednessToolkit = () => {
  const [selectedHazard, setSelectedHazard] = useState(null); 
  
  const handlePrint = () => {
    window.print();
  };
  
  const emergencyContacts = [
    { name: 'Emergency Services', number: '911' },
    { name: 'Philippine Red Cross', number: '143 / (02) 8790-2300' },
    { name: 'Philippine Coast Guard', number: '(02) 8527-3877' },
    { name: 'Disaster Hotline', number: '1-800-DISASTER' },
    { name: 'Local Police', number: '311' },
  ];

  const actionGuides = [
    { icon: '🌪️', label: 'Typhoon' },
    { icon: '🌍', label: 'Earthquake' },
    { icon: '💧', label: 'Flooding' },
    { icon: '🌋', label: 'Volcano Activity' },
  ];

  const hazardDetails = {
    Typhoon: {
      icon: '🌪️',
      steps: [
        'Stay indoors and keep updated with weather reports.',
        'Evacuate if your area is prone to floods or landslides.',
        'Unplug all electrical appliances.',
        'Prepare your Go-Bag and ensure water supply is stored.'
      ]
    },
    Earthquake: {
      icon: '🌍',
      steps: [
        'Drop, Cover, and Hold on under a sturdy table.',
        'Stay away from glass windows, shelves, and heavy objects.',
        'If outdoors, move to an open area away from buildings and poles.',
        'Expect aftershocks and check yourself for injuries.'
      ]
    },
    Flooding: {
      icon: '💧',
      steps: [
        'Move to higher ground immediately.',
        'Avoid walking or driving through flood waters.',
        'Turn off the main electricity switch if water enters your home.',
        'Boil water before drinking to avoid contamination.'
      ]
    },
    'Volcano Activity': {
      icon: '🌋',
      steps: [
        'Wear an N95 mask or wet cloth to protect from ashfall.',
        'Stay indoors with windows and doors closed.',
        'Follow evacuation orders from local authorities immediately.',
        'Clear heavy ash from your roof to prevent collapse.'
      ]
    }
  };

  const goBagItems = [
    'Water and non-perishable food',
    'First aid kit and medications',
    'Important documents and copies',
    'Phone chargers and power banks',
    'Personal hygiene items and sanitation',
    'Emergency blanket and change of clothes',
    'Whistle and signal mirror',
    'Multi-purpose pocket tool'
  ];

  return (
    <div className="preparedness-container">
      <div className="print-only-header">
        <span className="print-logo">SHIELD</span>
        <span className="print-tagline">Synchronized Hazard Information & Emergency Live Dashboard</span>
      </div>

      <div className="toolkit-header">
        <h1>Preparedness Toolkit</h1>
      </div>

      <div className="toolkit-content">
        <div className="toolkit-card emergency-contacts">
          <h2>Emergency Contacts</h2>
          <div className="contact-list">
            {emergencyContacts.map((contact, index) => (
              <div key={index} className="contact-item">
                <p className="contact-name">{contact.name}</p>
                <p className="contact-number">{contact.number}</p>
              </div>
            ))}
          </div>
        </div>
       
        <div className="toolkit-card gobag">
          <h2>GO-BAG CHECKLIST</h2>
          <div className="checklist-items">
            {goBagItems.map((item, index) => (
              <label key={index} className="checklist-item">
                <input 
                  type="checkbox" 
                  onClick={(e) => e.stopPropagation()} 
                  />
                  <span>{item}</span>
                </label>
              ))}
          </div>
        </div>

        <div className="toolkit-card action-guides">
          <h2>Immediate Action Guides</h2>
          <div className="guides-grid">
            {actionGuides.map((guide, index) => (
              <div
                key={index} 
                className="item-guide clickable" 
                onClick={() => setSelectedHazard(guide.label)}
              >
                <div className="icon-guide">{guide.icon}</div>
                <p className="label-guide">{guide.label}</p>

                <div className="print-only-steps">
                  <ul>
                    {hazardDetails[guide.label].steps.map((step, i) => (
                      <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="description">
          <p>Click on an icon to view safety protocols and immediate steps to take.</p>
        </div>
      </div>
    </div>

      <div className="print-actions">
        <button className="pdf-btn" onClick={handlePrint}>
          PRINT & PDF
        </button>
      </div>

      {selectedHazard && (
        <div className="modal-overlay" onClick={() => setSelectedHazard(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedHazard(null)}>&times;</button>
            <div className="modal-header">
              <span className="modal-icon">{hazardDetails[selectedHazard].icon}</span>
              <h3>{selectedHazard} Safety Guide</h3>
            </div>
            <div className="modal-body">
              <ul>
                {hazardDetails[selectedHazard].steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreparednessToolkit;