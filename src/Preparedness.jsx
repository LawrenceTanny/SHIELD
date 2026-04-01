import './Styles/Preparedness.css';

const PreparednessToolkit = () => {
  const emergencyContacts = [
    { name: 'Emergency Services', number: '911' },
    { name: 'Disaster Hotline', number: '1-800-DISASTER' },
    { name: 'Local Police', number: '311' },
  ];

  const actionGuides = [
    { icon: '🌪️', label: 'Typhoon' },
    { icon: '🌍', label: 'Earthquake' },
    { icon: '💧', label: 'Flooding' },
    { icon: '🌋', label: 'Volcano Activity' },
  ];

  const goBagItems = [
    'Water and non-perishable food',
    'First aid kit and medications',
    'Important documents and copies',
    'Phone chargers and batteries',
  ];

  return (
    <div className="preparedness-container">
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

        <div className="toolkit-card action-guides">
          <h2>Immediate Action Guides</h2>
          <div className="guides-grid">
            {actionGuides.map((guide, index) => (
              <div key={index} className="item-guide">
                <div className="icon-guide">{guide.icon}</div>
                <p className="label-guide">{guide.label}</p>
              </div>
            ))}
          </div>
          <div className="description">
            <p>blalbalba</p>
          </div>
        </div>

        <div className="toolkit-card gobag">
          <h2>GO-BAG CHECKLIST</h2>
          <div className="checklist-items">
            {goBagItems.map((item, index) => (
              <label key={index} className="checklist-item">
                <input type="checkbox" />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <button className="pdf-btn">PRINT & PDF</button>
        </div>
      </div>
    </div>
  );
};

export default PreparednessToolkit;