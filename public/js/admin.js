// Routing Chart
    const ctxRouting = document.getElementById('routingChart').getContext('2d');
    new Chart(ctxRouting, {
      type: 'bar',
      data: {
        labels: ['Keep (Tier 1)', 'Resale (Tier 2)', 'Standard (Tier 3)', 'Fraud Reject'],
        datasets: [{
          label: 'Returns (Last 30 Days)',
          data: [540, 890, 940, 81],
          backgroundColor: ['#00A86B', '#007185', '#37475A', '#E31837'],
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
          x: { grid: { display: false } }
        }
      }
    });

    // Demand Chart
    const ctxDemand = document.getElementById('demandChart').getContext('2d');
    new Chart(ctxDemand, {
      type: 'radar',
      data: {
        labels: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune'],
        datasets: [{
          label: 'Electronics',
          data: [85, 60, 90, 75, 65, 70],
          backgroundColor: 'rgba(0, 113, 133, 0.2)',
          borderColor: '#007185',
          pointBackgroundColor: '#007185',
        }, {
          label: 'Clothing',
          data: [95, 80, 85, 70, 75, 80],
          backgroundColor: 'rgba(255, 153, 0, 0.2)',
          borderColor: '#FF9900',
          pointBackgroundColor: '#FF9900',
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          r: {
            angleLines: { color: '#f0f0f0' },
            grid: { color: '#f0f0f0' },
            pointLabels: { font: { size: 13, family: 'Inter' } },
            ticks: { display: false }
          }
        }
    });

    // Real-time updates via Socket.io
    const socket = io();
    socket.on('live_metrics', (data) => {
      // Create a toast notification for live demand updates
      const toast = document.createElement('div');
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.background = '#232F3E';
      toast.style.color = '#fff';
      toast.style.padding = '12px 20px';
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      toast.style.zIndex = 1000;
      toast.style.fontSize = '14px';
      toast.innerHTML = `<strong>Live Demand Spike:</strong> ${data.demand_update.category} in ${data.demand_update.region} (Score: ${data.demand_update.score})`;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
      }, 4000);
      
      // Update the chart randomly to simulate live data
      const dsIndex = data.demand_update.category === 'electronics' ? 0 : 1;
      const labelIndex = ctxDemand.chart.data.labels.indexOf(data.demand_update.region);
      if(labelIndex !== -1) {
          ctxDemand.chart.data.datasets[dsIndex].data[labelIndex] = data.demand_update.score;
          ctxDemand.chart.update();
      }
    });

    socket.on('fraud_alert', (alert) => {
      const list = document.querySelector('.fraud-list');
      const li = document.createElement('li');
      li.className = 'fraud-item';
      li.innerHTML = `
        <div class="fraud-item__details">
          <div class="fraud-item__user">${alert.user}</div>
          <div class="fraud-item__reason">${alert.reason}</div>
        </div>
        <div class="fraud-item__time">${alert.time}</div>
      `;
      // Insert at top
      list.insertBefore(li, list.firstChild);
      
      // Keep only last 5 items
      if (list.children.length > 5) {
        list.removeChild(list.lastChild);
      }
    });

