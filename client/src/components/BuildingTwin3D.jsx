import React, { useState } from 'react';
import { useApi } from '../services/api';
import NestBuilding3D from './NestTwin/NestBuilding3D';

/* Full-screen 3-D building digital twin — just the model.
   Clicking a room in the scene isolates its floor (click again to show all
   floors) and highlights any active fault, driven by /api/twin/building/:id. */

function incidentFor(faultAssets) {
  if (!faultAssets.length) return null;
  const lifeSafety = faultAssets.some((a) => /fire|smoke|facp|sprinkler/i.test(a.type));
  return lifeSafety ? 'fire' : 'power';
}

export default function BuildingTwin3D({ building, onClose }) {
  const id = building.building_id;
  const { data } = useApi(`/twin/building/${id}`);
  const [floor, setFloor] = useState(null);

  const assets = data?.assets || [];
  const faultAssets = assets.filter((a) => a.status === 'fault' || a.status === 'degraded');
  const incidentType = incidentFor(faultAssets);

  return (
    <div className="bdt-root">
      <button className="bdt-close bdt-close--float" onClick={onClose}>✕</button>
      <div className="bdt-center bdt-center--full">
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          <NestBuilding3D
            selectedFloor={floor}
            incidentSim={incidentType}
            incidentStage={incidentType ? 2 : 0}
            onFloorClick={(f) => setFloor((prev) => (prev === f ? null : f))}
            onRoomClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
