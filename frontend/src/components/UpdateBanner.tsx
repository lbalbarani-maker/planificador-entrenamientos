import { useState, useEffect, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';

function UpdateBanner() {
  const [showModal, setShowModal] = useState(false);
  const setShowModalRef = useRef(setShowModal);

  useEffect(() => {
    setShowModalRef.current = setShowModal;
  }, [setShowModal]);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setShowModalRef.current(true);
      },
      onOfflineReady() {
        console.log('App lista offline');
      },
    });

    // Check for updates on mount
    updateSW(true);
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
      <div className="bg-white p-8 rounded-xl text-center max-w-md mx-4">
        <div className="text-5xl mb-4">🔄</div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Actualización Requerida</h2>
        <p className="text-gray-600 mb-6">
          Hay una nueva versión disponible. Debes actualizar para continuar usando la app.
        </p>
        <button
          onClick={handleUpdate}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors w-full"
        >
          Actualizar Ahora
        </button>
      </div>
    </div>
  );
}

export default UpdateBanner;