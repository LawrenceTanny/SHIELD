import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './Styles/Preparedness.css';

const PreparednessToolkit = () => {
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [checked, setChecked] = useState({});

  const toggle = (i) => setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  const packedCount = Object.values(checked).filter(Boolean).length;

  const handlePrint = () => {
    window.print();
  };

  const emergencyContacts = [
    { name: 'Emergency Services', number: '911' },
    { name: 'Philippine Red Cross', number: '143 / (02) 8790-2300' },
    { name: 'Philippine Coast Guard', number: '(02) 8527-3877' },
    { name: 'NDRRMC', number: '(02) 8911-1406' },
    { name: 'Philippine National Police', number: '117' },
    { name: 'Bureau of Fire Protection', number: '(02) 8426-0219' },
    { name: 'PAGASA', number: '(02) 8284-0800' },
    { name: 'PHIVOLCS', number: '(02) 8426-1468 to 79' },
  ];

  const actionGuides = [
    { icon: '/storm_icon.svg', label: 'Typhoon' },
    { icon: '/earthquake_icon.svg', label: 'Earthquake' },
    { icon: '/flood_icon.svg', label: 'Flooding' },
    { icon: '/volcano_icon.svg', label: 'Volcano Activity' },
  ];

  const hazardDetails = {
    Typhoon: {
      icon: '/storm_icon.svg',
      steps: [
        'Stay indoors and keep updated with weather reports.',
        'Evacuate if your area is prone to floods or landslides.',
        'Unplug all electrical appliances.',
        'Prepare your Go-Bag and ensure water supply is stored.'
      ]
    },
    Earthquake: {
      icon: '/earthquake_icon.svg',
      steps: [
        'Drop, Cover, and Hold on under a sturdy table.',
        'Stay away from glass windows, shelves, and heavy objects.',
        'If outdoors, move to an open area away from buildings and poles.',
        'Expect aftershocks and check yourself for injuries.'
      ]
    },
    Flooding: {
      icon: '/flood_icon.svg',
      steps: [
        'Move to higher ground immediately.',
        'Avoid walking or driving through flood waters.',
        'Turn off the main electricity switch if water enters your home.',
        'Boil water before drinking to avoid contamination.'
      ]
    },
    'Volcano Activity': {
      icon: '/volcano_icon.svg',
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
        <span className="print-logo">ALERT PH</span>
        <span className="print-tagline">Philippine Disaster & Monitoring System</span>
      </div>

      <div className="toolkit-header">
        <h1>Preparedness Toolkit</h1>
      </div>

      <div className="toolkit-content">

        {/* ── Emergency Contacts ── */}
        <div className="toolkit-card emergency-contacts">
          <h2>Emergency Contacts</h2>
          <div className="contact-list">
            {emergencyContacts.map((contact, index) => (
              <div key={index} className="contact-item">
                <div className="contact-left">
                  <span className="contact-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="contact-name">{contact.name}</span>
                </div>
                <span className="contact-number">{contact.number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Go-Bag Checklist ── */}
        <div className="toolkit-card gobag">
          <h2>Go-Bag Checklist</h2>
          <div className="checklist-items">
            {goBagItems.map((item, index) => (
              <div
                key={index}
                className="checklist-item"
                onClick={() => toggle(index)}
                style={checked[index] ? { opacity: 0.4 } : {}}              >
                <span className="item-num">{String(index + 1).padStart(2, '0')}</span>
                <span className={`item-text${checked[index] ? ' struck' : ''}`}>
                  {item}
                </span>
                <div className={`item-check${checked[index] ? ' done' : ''}`}>
                  {checked[index] && <span className="check-mark">✓</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="checklist-progress">
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: `${(packedCount / goBagItems.length) * 100}%` }}
              />
            </div>
            <span className="progress-label">{packedCount}/{goBagItems.length} PACKED</span>
          </div>
        </div>

        {/* ── Action Guides (unchanged) ── */}
        <div className="toolkit-card action-guides">
          <h2>Immediate Action Guides</h2>
          <div className="guides-stack">
            {actionGuides.map((guide, index) => (
              <div
                key={index}
                className="item-guide clickable"
                onClick={() => setSelectedHazard(guide.label)}
              >
                <div className="item-guide-content">
                  <p className="label-guide">{guide.label}</p>
                </div>
                <div className="icon-guide">
                  <img src={guide.icon} alt={guide.label} />
                </div>
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
            <p className="action-footer-text">CLICK ON AN ICON TO VIEW SAFETY PROTOCOLS AND IMMEDIATE STEPS TO TAKE.</p>
          </div>
        </div>

      </div>

      <div className="print-actions">
        <button className="pdf-btn" onClick={handlePrint}>
          PRINT A COPY
        </button>
      </div>

      {selectedHazard && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={() => setSelectedHazard(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedHazard(null)}>&times;</button>
            <div className="modal-header">
              <span className="modal-icon">
                <img className="modal-icon-img" src={hazardDetails[selectedHazard].icon} alt="" />
              </span>
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default PreparednessToolkit;