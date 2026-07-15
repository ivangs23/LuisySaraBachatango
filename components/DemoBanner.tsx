export default function DemoBanner() {
  return (
    <div
      role="status"
      style={{
        background: '#8a1c1c',
        color: '#fff',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        position: 'relative',
        zIndex: 100,
      }}
    >
      <span aria-hidden="true">⚠️</span> MODO PRUEBAS — los pagos son simulados, no se cobra nada
    </div>
  );
}
