import { useCallback, useState } from 'react';
import { Box, Button, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import {
  ChatBubble as ChatBubbleIcon,
  ChatBubbleOutlineOutlined as ChatBubbleOutlineIcon,
} from '@mui/icons-material';

interface CommentButtonProps {
  comment: string | null | undefined;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}

/** Icon button that reflects whether a transaction has a comment. */
export function CommentButton({ comment, onClick }: CommentButtonProps) {
  return (
    <Tooltip title={comment ?? <em>No comment</em>}>
      <IconButton size="small" aria-label="comment" onClick={onClick}>
        {comment ? (
          <ChatBubbleIcon fontSize="small" color="primary" />
        ) : (
          <ChatBubbleOutlineIcon fontSize="small" color="disabled" />
        )}
      </IconButton>
    </Tooltip>
  );
}

/**
 * Manages the state of an inline comment editor: which row is being edited,
 * the draft text, and the saving flag. The actual persistence is supplied by
 * the caller via `onSave`, since each page writes comments through a different
 * endpoint.
 */
export function useCommentEditor<TId>(onSave: (id: TId, text: string) => Promise<void>) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [txId, setTxId] = useState<TId | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const open = useCallback(
    (e: React.MouseEvent<HTMLElement>, id: TId, currentComment: string | null | undefined) => {
      e.stopPropagation();
      setTxId(id);
      setText(currentComment ?? '');
      setAnchorEl(e.currentTarget);
    },
    [],
  );

  const close = useCallback(() => {
    setAnchorEl(null);
    setTxId(null);
  }, []);

  const save = useCallback(async () => {
    if (txId === null) return;
    setSaving(true);
    try {
      await onSave(txId, text);
      close();
    } catch (err) {
      console.error('Failed to save comment:', err);
    } finally {
      setSaving(false);
    }
  }, [txId, text, onSave, close]);

  return { anchorEl, text, setText, saving, open, close, save };
}

interface CommentPopoverProps {
  anchorEl: HTMLElement | null;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

/** Popover with a multiline text field for editing a transaction comment. */
export function CommentPopover({
  anchorEl,
  value,
  saving,
  onChange,
  onClose,
  onSave,
}: CommentPopoverProps) {
  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Box sx={{ p: 2, width: 300 }}>
        <Typography variant="subtitle2" gutterBottom>
          Comment
        </Typography>
        <TextField
          multiline
          rows={3}
          fullWidth
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={onSave} disabled={saving}>
            Save
          </Button>
        </Box>
      </Box>
    </Popover>
  );
}
