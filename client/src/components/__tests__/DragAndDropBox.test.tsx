import { useRef } from 'react';
import { expect, describe, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import { DragAndDropBox, type DragAndDropHandle } from '../DragAndDropBox';

const csvFile = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' });

function Harness({ onFile }: { onFile: (file: File) => void }) {
  const ref = useRef<DragAndDropHandle>(null);
  return (
    <DragAndDropBox ref={ref} onFile={onFile} overlayLabel="DROP HERE">
      <div data-testid="content">
        <button onClick={() => ref.current?.openFilePicker()}>Pick</button>
      </div>
    </DragAndDropBox>
  );
}

const getRoot = () => screen.getByTestId('content').parentElement as HTMLElement;

describe('DragAndDropBox', () => {
  it('renders its children', () => {
    render(<Harness onFile={jest.fn()} />);
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('shows the overlay while a file is dragged over and hides it on leave', () => {
    render(<Harness onFile={jest.fn()} />);
    const root = getRoot();

    expect(screen.queryByText('DROP HERE')).not.toBeInTheDocument();

    fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('DROP HERE')).toBeInTheDocument();

    fireEvent.dragLeave(root, { dataTransfer: { types: ['Files'] } });
    expect(screen.queryByText('DROP HERE')).not.toBeInTheDocument();
  });

  it('ignores drags that are not files', () => {
    render(<Harness onFile={jest.fn()} />);
    fireEvent.dragEnter(getRoot(), { dataTransfer: { types: ['text/plain'] } });
    expect(screen.queryByText('DROP HERE')).not.toBeInTheDocument();
  });

  it('calls onFile when a file is dropped and clears the overlay', () => {
    const onFile = jest.fn();
    render(<Harness onFile={onFile} />);
    const root = getRoot();

    fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'] } });
    fireEvent.drop(root, { dataTransfer: { files: [csvFile], types: ['Files'] } });

    expect(onFile).toHaveBeenCalledWith(csvFile);
    expect(screen.queryByText('DROP HERE')).not.toBeInTheDocument();
  });

  it('calls onFile when a file is chosen via the input', () => {
    const onFile = jest.fn();
    render(<Harness onFile={onFile} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [csvFile] } });

    expect(onFile).toHaveBeenCalledWith(csvFile);
    expect(input.value).toBe(''); // reset so the same file can be re-picked
  });

  it('opens the file dialog when the handle is invoked', () => {
    render(<Harness onFile={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, 'click');

    fireEvent.click(screen.getByText('Pick'));

    expect(clickSpy).toHaveBeenCalled();
  });
});
