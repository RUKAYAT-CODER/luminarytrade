import React, { Suspense, lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';

// Lazy load route components
const Dashboard = lazy(() => import('./components/Dashboard'));
const CreditScoring = lazy(() => import('./components/CreditScoring'));
const FraudDetection = lazy(() => import('./components/FraudDetection'));
const WalletInterface = lazy(() => import('./components/WalletInterface'));

// Loading fallback component
const Loading: React.FC = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <div className="loader">Loading...</div>
  </div>
);

const App: React.FC = () => {
  // Prefetch component on hover
  const prefetchComponent = (componentName: string) => {
    switch (componentName) {
      case 'dashboard': import('./components/Dashboard'); break;
      case 'scoring': import('./components/CreditScoring'); break;
      case 'fraud': import('./components/FraudDetection'); break;
      case 'wallet': import('./components/WalletInterface'); break;
    }
  };

  return (
    <div className="app-container">
      <nav style={{ padding: '20px', borderBottom: '1px solid #ccc' }}>
        <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', margin: 0, padding: 0 }}>
          <li>
            <Link to="/" onMouseEnter={() => prefetchComponent('dashboard')}>Dashboard</Link>
          </li>
          <li>
            <Link to="/scoring" onMouseEnter={() => prefetchComponent('scoring')}>Credit Scoring</Link>
          </li>
          <li>
            <Link to="/fraud" onMouseEnter={() => prefetchComponent('fraud')}>Fraud Detection</Link>
          </li>
          <li>
            <Link to="/wallet" onMouseEnter={() => prefetchComponent('wallet')}>Wallet</Link>
          </li>
        </ul>
      </nav>

      <main style={{ padding: '20px' }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scoring" element={<CreditScoring />} />
            <Route path="/fraud" element={<FraudDetection />} />
            <Route path="/wallet" element={<WalletInterface />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;
