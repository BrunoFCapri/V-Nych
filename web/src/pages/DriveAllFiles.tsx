import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  mime_type?: string;
  uploaded_at?: string;
}

const DriveAllFiles: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Subida de archivos "sueltos" (sin tarea)
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setUploading(true);
    // Endpoint especial: /api/tasks/null/attachments para archivos "sueltos"
    const res = await fetch(`${API_URL}/api/tasks/null/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    });
    setUploading(false);
    if (res.ok) {
      // Refresca la lista de archivos
      fetch(`${API_URL}/api/attachments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then(setFiles);
      form.reset();
    } else {
      alert('Error al subir archivo');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener archivos');
        return res.json();
      })
      .then(setFiles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async (file: Attachment) => {
    const res = await fetch(`${API_URL}/api/tasks/${file.task_id}/attachments/${file.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert('Error al descargar');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDelete = async (file: Attachment) => {
    if (!window.confirm('¿Eliminar archivo?')) return;
    const res = await fetch(`${API_URL}/api/tasks/${file.task_id}/attachments/${file.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== file.id));
    else alert('Error al eliminar');
  };

  return (
    <div>
      <button onClick={() => navigate('/')} style={{marginBottom: 16}}>&larr; Volver al menú</button>
      <h2>Todos mis archivos</h2>
      <form onSubmit={handleUpload} style={{marginBottom:16}}>
        <input type="file" name="file" required />
        <button type="submit" disabled={uploading}>{uploading ? 'Subiendo...' : 'Subir archivo'}</button>
      </form>
      {loading && <p>Cargando...</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
      {files.length === 0 && !loading && !error && (
        <p>No tienes archivos subidos.</p>
      )}
      {files.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Subido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const ext = file.filename.includes('.') ? file.filename.split('.').pop() : '';
              return (
                <tr key={file.id}>
                  <td>{file.filename}{ext && <span style={{color:'#888'}}> ({ext})</span>}</td>
                  <td>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : ''}</td>
                  <td>
                    <button onClick={() => handleDownload(file)}>Descargar</button>
                    <button onClick={() => handleDelete(file)}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DriveAllFiles;
