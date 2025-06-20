'use client'

export default function CssTestPage() {
  // Stile CSS in-line per verificare se funziona
  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
    },
    heading: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#3b82f6', // blue-500 in Tailwind
      marginBottom: '1rem',
    },
    card: {
      padding: '1.5rem',
      backgroundColor: '#f3f4f6', // gray-100 in Tailwind
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '1rem',
    },
    button: {
      padding: '0.5rem 1rem',
      backgroundColor: '#3b82f6', // blue-500
      color: 'white',
      borderRadius: '0.25rem',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Test Stili CSS In-line</h1>
      
      <div style={styles.card}>
        <p>Questa pagina utilizza stili CSS in-line per verificare se il problema è specifico di Tailwind CSS.</p>
        <p style={{ marginTop: '1rem' }}>Se questa pagina è formattata correttamente con colori, spaziature e bordi, ma le altre pagine no, significa che il problema è specifico dell'integrazione Tailwind.</p>
      </div>
      
      <button 
        style={styles.button}
        onClick={() => alert('CSS in-line funziona!')}
      >
        Cliccami
      </button>
      
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>Prossimi passi per risolvere il problema:</h2>
        <ol style={{ paddingLeft: '1.5rem', listStyleType: 'decimal' }}>
          <li style={{ marginBottom: '0.5rem' }}>Verifica che stai usando TailwindCSS@3.x con Next.js 15.x</li>
          <li style={{ marginBottom: '0.5rem' }}>Considera di creare un nuovo progetto minimal con Next.js + Tailwind</li>
          <li style={{ marginBottom: '0.5rem' }}>Importa i componenti gradualmente nel nuovo progetto</li>
        </ol>
      </div>
    </div>
  )
}
