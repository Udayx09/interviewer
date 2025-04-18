// src/components/DetailsForm.tsx
import React, { useState } from 'react';
import { useUserProfile } from '../context/UserProfileContext';
import './DetailsForm.css'; // Keep CSS import

// Reuse supported languages definition (or import from a shared file)
const SUPPORTED_CODING_LANGUAGES = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'sql', label: 'SQL' },
    { value: 'php', label: 'PHP' },
];

interface DetailsFormProps {
  onDetailsSubmitted: () => void;
}

const DetailsForm: React.FC<DetailsFormProps> = ({ onDetailsSubmitted }) => {
  const { setProfileDetails } = useUserProfile();
  const [role, setRole] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [otherSkills, setOtherSkills] = useState<string>(''); // NEW: State for other skills/languages

  const handleLanguageCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.target;
    setSelectedLanguages(prev =>
      checked ? [...prev, value] : prev.filter(lang => lang !== value)
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Keep validation for required fields
    if (role.trim() && experience.trim() && skills.trim() && selectedLanguages.length > 0) {
      setProfileDetails({
        role,
        experience,
        skills,
        practiceLanguages: selectedLanguages,
        otherSkills: otherSkills, // Pass the new field value
      });
      onDetailsSubmitted();
    } else {
      let alertMessage = "Please fill in all details.";
      if (selectedLanguages.length === 0) {
        alertMessage += " Please select at least one language to practice coding in.";
      }
      alert(alertMessage);
    }
  };

  // --- Styles ---
  const formContainerStyle: React.CSSProperties = {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    background: '#fff',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    fontSize: '0.9em',
    color: '#333',
  };
  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '0.9em',
  };
  const checkboxGroupStyle: React.CSSProperties = {
    marginTop: '10px',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '6px',
    background: '#fdfdfd',
  };
  const checkboxLabelStyle: React.CSSProperties = {
    display: 'inline-block',
    marginRight: '20px',
    marginBottom: '10px',
    cursor: 'pointer',
    color: '#333', // Explicitly set dark text color
  };
  // --- End Styles ---

  return (
    <div style={formContainerStyle}>
      <h2 style={{ textAlign: 'center', marginBottom: '25px', color: '#222' }}>Define Your Practice Session:</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Role Input */}
        <div>
          <label htmlFor="role" style={labelStyle}>Target Role:</label>
          <input
            type="text"
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="details-input"
            style={inputBaseStyle}
            placeholder="e.g., Frontend Developer, Data Scientist"
          />
        </div>
        {/* Experience Input */}
        <div>
          <label htmlFor="experience" style={labelStyle}>Experience Level:</label>
          <input
            type="text"
            id="experience"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            required
            className="details-input"
            style={inputBaseStyle}
            placeholder="e.g., Internship, Entry-Level, 5+ Years"
          />
        </div>
        {/* Skills Input */}
        <div>
          <label htmlFor="skills" style={labelStyle}>Core Skills/Technologies (comma-separated):</label>
          <input
            type="text"
            id="skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            required
            className="details-input"
            style={inputBaseStyle}
            placeholder="e.g., React, Node.js, SQL, REST APIs, Docker"
          />
        </div>

        {/* Language Selection Checkboxes */}
        <div style={checkboxGroupStyle}>
          <label style={{ ...labelStyle, marginBottom: '12px' }}>Select languages for coding practice:</label>
          <div>
            {SUPPORTED_CODING_LANGUAGES.map(lang => (
              <label key={lang.value} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  value={lang.value}
                  checked={selectedLanguages.includes(lang.value)}
                  onChange={handleLanguageCheckboxChange}
                  style={{ marginRight: '5px', cursor: 'pointer' }}
                />
                {lang.label}
              </label>
            ))}
          </div>
        </div>

        {/* --- NEW: Other Skills/Languages Input --- */}
        <div>
          <label htmlFor="otherSkills" style={labelStyle}>
            Other relevant languages/tech (for context, comma-separated):
          </label>
          <input
            type="text"
            id="otherSkills"
            value={otherSkills}
            onChange={(e) => setOtherSkills(e.target.value)} // Update state
            className="details-input" // Reuse existing style
            style={inputBaseStyle}
            placeholder="Optional: e.g., Scala, Spark, Go, AWS specific services"
          />
        </div>
        {/* --- End Other Skills/Languages Input --- */}

        <button type="submit" className="details-button">Start Practice</button>
      </form>
    </div>
  );
};

export default DetailsForm;