import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import DistrictDashboard from './pages/DistrictDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/district/:state/:district" element={<DistrictDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

