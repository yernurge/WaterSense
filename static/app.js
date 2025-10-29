// Global variables
let waterChart = null;
let currentPeriod = 7;

// DOM Elements
const todayLitersEl = document.getElementById('todayLiters');
const todayCostEl = document.getElementById('todayCost');
const totalLitersEl = document.getElementById('totalLiters');
const totalCostEl = document.getElementById('totalCost');
const avgLitersEl = document.getElementById('avgLiters');
const costPerLiterEl = document.getElementById('costPerLiter');
const refreshBtn = document.getElementById('refreshBtn');
const resetBtn = document.getElementById('resetBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const periodBtns = document.querySelectorAll('.period-btn');

// Show/Hide loading overlay
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Fetch and display data
async function fetchData(days = 30) {
    try {
        showLoading();
        
        const response = await fetch(`/get_data?days=${days}`);
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        
        const data = await response.json();
        
        // Update statistics
        updateStatistics(data);
        
        // Update chart
        updateChart(data.dates, data.liters);
        
        hideLoading();
    } catch (error) {
        console.error('Error fetching data:', error);
        hideLoading();
        alert('Ошибка при загрузке данных. Пожалуйста, попробуйте снова.');
    }
}

// Update statistics display
function updateStatistics(data) {
    todayLitersEl.textContent = data.today_liters.toFixed(2);
    todayCostEl.textContent = data.today_cost.toFixed(4);
    totalLitersEl.textContent = data.total_liters.toFixed(2);
    totalCostEl.textContent = data.total_cost.toFixed(4);
    avgLitersEl.textContent = data.avg_7days.toFixed(2);
    costPerLiterEl.textContent = data.cost_per_liter.toFixed(4);
}

// Initialize or update chart
function updateChart(dates, liters) {
    const ctx = document.getElementById('waterChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (waterChart) {
        waterChart.destroy();
    }
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(30, 144, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(30, 144, 255, 0.05)');
    
    // Create new chart
    waterChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Потребление воды (литры)',
                data: liters,
                borderColor: '#1e90ff',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#1e90ff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#1e90ff',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        color: '#2c3e50',
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(44, 62, 80, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e90ff',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += context.parsed.y.toFixed(2) + ' л';
                            return label;
                        },
                        afterLabel: function(context) {
                            const cost = (context.parsed.y * 0.001).toFixed(4);
                            return 'Стоимость: ' + cost + ' тг';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#6c757d',
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#6c757d',
                        callback: function(value) {
                            return value.toFixed(1) + ' л';
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Reset database
async function resetDatabase() {
    const confirmReset = confirm('Вы уверены, что хотите очистить все данные? Это действие нельзя отменить.');
    
    if (!confirmReset) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset database');
        }
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            alert('База данных успешно очищена!');
            // Refresh data
            await fetchData(currentPeriod);
        } else {
            throw new Error(result.message || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Error resetting database:', error);
        hideLoading();
        alert('Ошибка при очистке базы данных. Пожалуйста, попробуйте снова.');
    }
}

// Period button handlers
function setupPeriodButtons() {
    periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            periodBtns.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get period value
            const days = parseInt(this.getAttribute('data-days'));
            currentPeriod = days;
            
            // Fetch new data
            fetchData(days);
        });
    });
}

// Refresh button handler
refreshBtn.addEventListener('click', () => {
    fetchData(currentPeriod);
});

// Reset button handler
resetBtn.addEventListener('click', resetDatabase);

// Auto-refresh data every 30 seconds
setInterval(() => {
    fetchData(currentPeriod);
}, 30000);

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Smart Water Meter initialized');
    
    // Setup period buttons
    setupPeriodButtons();
    
    // Load initial data
    fetchData(currentPeriod);
});

// Handle visibility change (refresh when tab becomes visible)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        fetchData(currentPeriod);
    }
});
