import { useRegisterSW } from 'virtual:pwa-register/react';

// Offers to reload when a new version has been downloaded in the background.
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="notice row" style={{ justifyContent: 'space-between', margin: '12px 16px 0' }} role="status">
      <span>A new version of Piano Tuner is ready.</span>
      <span className="row">
        <button className="primary" onClick={() => updateServiceWorker(true)}>
          Update
        </button>
        <button className="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </span>
    </div>
  );
}
