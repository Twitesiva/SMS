import { useState } from "react";
import { supabase } from "../../supabaseClient.js";

export default function SectionsCreation({ onSectionsChange }) {
  const [sectionName, setSectionName] = useState("");
  const [loading, setLoading] = useState(false);

  const addSection = async () => {
    if (!sectionName.trim()) return;

    const { error } = await supabase
      .from("sections")
      .insert([{ section_name: sectionName.trim().toUpperCase() }]);

    if (error) {
      console.error("Error adding section:", error);
      alert("Failed to add section");
    } else {
      alert("Section added successfully");
      setSectionName("");
      if (onSectionsChange) onSectionsChange();
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header bg-light">
        <h3>Section Creation</h3>
      </div>
      <div className="card-body">
        <input
          type="text"
          placeholder="Enter section name (A, B, C...)"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          className="form-control mb-3"
        />
        <button onClick={addSection} className="btn btn-primary">
          Add Section
        </button>
      </div>
    </div>
  );
}

