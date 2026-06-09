import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Link } from 'react-router-dom';
import type { FileInfo } from '../types';

export default function FilesPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [stagedFiles, setStagedFiles] = useState<FileInfo[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileInfo | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const [filesRes, stagedRes] = await Promise.all([
        fetch('/api/files'),
        fetch('/api/preview-files'),
      ]);
      const filesData = await filesRes.json();
      const stagedData = await stagedRes.json();
      setFiles(filesData.data || []);
      setStagedFiles((stagedData.data || []).map((f: FileInfo) => ({ ...f, isStaged: true })));
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchFiles();
    };
    init();
  }, [fetchFiles]);

  const handleDeleteClick = (file: FileInfo) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      const url = fileToDelete.isStaged
        ? `/api/preview/${fileToDelete.id}/discard`
        : `/api/files/${fileToDelete.id}/delete`;

      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        fetchFiles();
      } else {
        console.error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const allFiles = [...stagedFiles, ...files];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Files
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>Range</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allFiles.map((file) => (
              <TableRow key={`${file.isStaged ? 'staged-' : 'file-'}${file.id}`}>
                <TableCell>{file.filename}</TableCell>
                <TableCell>
                  {file.accountName ? (
                    file.accountName
                  ) : (
                    <Box component="span" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      Unknown
                    </Box>
                  )}
                </TableCell>
                <TableCell>{file.range}</TableCell>
                <TableCell>
                  {file.isStaged ? (
                    <Chip label="In Review" color="warning" size="small" />
                  ) : (
                    <Chip label="Committed" color="success" size="small" />
                  )}
                </TableCell>
                <TableCell align="right">
                  {file.isStaged && (
                    <IconButton
                      component={Link}
                      to={`/preview/${file.id}`}
                      color="primary"
                      size="small"
                      title="Preview"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  )}
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => handleDeleteClick(file)}
                    title="Delete"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {allFiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No files found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &quot;{fileToDelete?.filename}&quot;?
            {fileToDelete?.isStaged
              ? ' This will discard all staged transactions for this file.'
              : ' This will delete all transactions associated with this file from the database.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
