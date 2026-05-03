import { useState, useCallback } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function TransactionsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const { fileStageId } = await response.json();
        navigate(`/preview/${fileStageId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsUploading(false);
      }
    },
    [navigate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'text/csv') {
        handleUpload(file);
      } else {
        setError('Please upload a CSV file.');
      }
    },
    [handleUpload],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transactions
      </Typography>

      <Paper
        variant="outlined"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        sx={{
          p: 5,
          textAlign: 'center',
          backgroundColor: '#fafafa',
          borderStyle: 'dashed',
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#f0f0f0' },
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input type="file" id="file-input" accept=".csv" hidden onChange={onFileChange} />
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6">Drag & drop a CSV file here or click to browse</Typography>
        {isUploading && (
          <Box sx={{ mt: 2 }}>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            <Typography variant="body2" component="span">
              Uploading...
            </Typography>
          </Box>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">Recent Transactions</Typography>
        <Typography variant="body2" color="text.secondary">
          No transactions to display.
        </Typography>
      </Box>
    </Box>
  );
}
