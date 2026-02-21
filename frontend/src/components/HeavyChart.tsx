import React from 'react';

const HeavyChart: React.FC = () => {
    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginTop: '20px' }}>
            <h3>Heavy Analytics Chart</h3>
            <p>This component is lazily loaded because it contains heavy visualization logic.</p>
            <div style={{ height: '200px', background: 'linear-gradient(90deg, #3f51b5, #2196f3)', display: 'flex', alignItems: 'flex-end', padding: '10px', gap: '5px' }}>
                {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, backgroundColor: 'rgba(255,255,255,0.8)' }}></div>
                ))}
            </div>
        </div>
    );
};

export default HeavyChart;
