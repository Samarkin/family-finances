import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SummaryPage from './pages/SummaryPage';
import TransactionsPage from './pages/TransactionsPage';
import PreviewPage from './pages/PreviewPage';
import FilesPage from './pages/FilesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SummaryPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="preview/:id" element={<PreviewPage />} />
          <Route path="files" element={<FilesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
