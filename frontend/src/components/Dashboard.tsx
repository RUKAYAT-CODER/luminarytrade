import React, { Suspense, lazy } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));

const Dashboard: React.FC = () => {
  return (
    <div>
      <h2>Dashboard Component</h2>
      <p>Implementation pending - see frontend-01-react-components.md</p>

      <Suspense fallback={<div>Loading chart...</div>}>
        <HeavyChart />
      </Suspense>
    </div>
  );
};

export default Dashboard;
