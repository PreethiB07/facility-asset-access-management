import { useState } from 'react';
import AreaAdminPanel from '../components/admin/AreaAdminPanel';
import AssetAdminPanel from '../components/admin/AssetAdminPanel';
import FacilityAdminPanel from '../components/admin/FacilityAdminPanel';

type AdminTab = 'facilities' | 'areas' | 'assets';

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('facilities');

  return (
    <div className="page">
      <h1>Administration</h1>
      <p className="text-muted page-intro">
        Manage facilities, areas, and assets. Deactivated resources remain in history but are
        hidden from standard users.
      </p>

      <div className="tab-bar" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'facilities'}
          className={tab === 'facilities' ? 'tab active' : 'tab'}
          onClick={() => setTab('facilities')}
        >
          Facilities
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'areas'}
          className={tab === 'areas' ? 'tab active' : 'tab'}
          onClick={() => setTab('areas')}
        >
          Areas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'assets'}
          className={tab === 'assets' ? 'tab active' : 'tab'}
          onClick={() => setTab('assets')}
        >
          Assets
        </button>
      </div>

      {tab === 'facilities' && <FacilityAdminPanel />}
      {tab === 'areas' && <AreaAdminPanel />}
      {tab === 'assets' && <AssetAdminPanel />}
    </div>
  );
}
