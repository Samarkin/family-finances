import { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

/** Imperative handle exposed via `ref` so a page can open the file dialog. */
export interface DragAndDropHandle {
  openFilePicker: () => void;
}

interface DragAndDropBoxProps {
  /** Called with the chosen file, whether dropped or picked via the dialog. */
  onFile: (file: File) => void;
  /** Text shown in the drag overlay. */
  overlayLabel: string;
  /** `accept` attribute for the hidden file input. */
  accept?: string;
  /** Styles applied to the wrapping Box (merged after `position: relative`). */
  sx?: SxProps<Theme>;
  /** Page content. */
  children: React.ReactNode;
  /** Handle for triggering the file dialog from an Upload button. */
  ref?: React.Ref<DragAndDropHandle>;
}

/**
 * Wraps page content in a region that accepts a file via drag-and-drop or a
 * file dialog. While a file is dragged over the region it shows a full-area
 * overlay. To place an Upload button anywhere in the content, pass a `ref` and
 * call `ref.current.openFilePicker()` from the button's onClick.
 */
export function DragAndDropBox({
  onFile,
  overlayLabel,
  accept = '.csv',
  sx,
  children,
  ref,
}: DragAndDropBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Counts nested dragenter/dragleave pairs so the overlay does not flicker
  // when the cursor moves between child elements.
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ openFilePicker: () => inputRef.current?.click() }), []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) onFile(file);
      event.target.value = ''; // allow re-selecting the same file
    },
    [onFile],
  );

  return (
    <Box
      sx={[{ position: 'relative' }, ...(Array.isArray(sx) ? sx : [sx])]}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept={accept} hidden onChange={handleInputChange} />
      {isDragging && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            border: '3px dashed',
            borderColor: 'primary.main',
            borderRadius: 1,
            bgcolor: 'rgba(25, 118, 210, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="h5" color="primary">
            {overlayLabel}
          </Typography>
        </Box>
      )}
      {children}
    </Box>
  );
}
