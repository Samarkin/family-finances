/**
 * Upload a transactions CSV to the staging area. Returns the new `fileStageId`
 * so the caller can navigate to the Preview page. Throws an `Error` with a
 * user-facing message on validation or request failure.
 *
 * This is intentionally a plain function (no React): navigation and error
 * display are the page's responsibility.
 */
export async function uploadTransactionsCsv(file: File): Promise<number> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  if (!isCsv) {
    throw new Error('Please upload a CSV file.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { error?: string }).error || 'Upload failed');
  }

  const { fileStageId } = await response.json();
  return fileStageId;
}
