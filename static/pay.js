// Payment page JavaScript
// Handles fetching consumption data and processing payments

// Global variables
let currentMonthData = null;
let paymentInProgress = false;

// DOM Elements
const monthSelector = document.getElementById('monthSelector');
const loadingState = document.getElementById('loadingState');
const dataState = document.getElementById('dataState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const displayMonthEl = document.getElementById('displayMonth');
const totalLitersEl = document.getElementById('totalLiters');
const pricePerLiterEl = document.getElementById('pricePerLiter');
const totalAmountEl = document.getElementById('totalAmount');
const breakdownSection = document.getElementById('breakdownSection');
const breakdownTableBody = document.getElementById('breakdownTableBody');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const successMessage = document.getElementById('successMessage');
const errorModalMessage = document.getElementById('errorModalMessage');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeErrorModalBtn = document.getElementById('closeErrorModalBtn');
const paymentButtons = document.querySelectorAll('.payment-btn');

/**
 * Initialize the month selector with current month
 */
function initializeMonthSelector() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonth = `${year}-${month}`;
    
    monthSelector.value = currentMonth;
    monthSelector.max = currentMonth; // Prevent selecting future months
}

/**
 * Show loading state
 */
function showLoading() {
    loadingState.classList.remove('hidden');
    dataState.classList.add('hidden');
    errorState.classList.add('hidden');
}

/**
 * Show data state
 */
function showData() {
    loadingState.classList.add('hidden');
    dataState.classList.remove('hidden');
    errorState.classList.add('hidden');
}

/**
 * Show error state
 */
function showError(message) {
    loadingState.classList.add('hidden');
    dataState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = message;
}

/**
 * Fetch consumption data for a specific month
 */
async function fetchConsumptionData(month) {
    try {
        showLoading();
        
        const url = month 
            ? `/api/consumption?month=${month}`
            : '/api/consumption';
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch data');
        }
        
        const data = await response.json();
        currentMonthData = data;
        
        // Update UI with data
        updateSummary(data);
        updateBreakdown(data.breakdown);
        
        showData();
    } catch (error) {
        console.error('Error fetching consumption data:', error);
        showError(error.message || 'Не удалось загрузить данные о потреблении');
    }
}

/**
 * Update summary section with consumption data
 */
function updateSummary(data) {
    displayMonthEl.textContent = data.displayMonth || data.displayMonthEn || data.month;
    totalLitersEl.textContent = data.liters.toFixed(2);
    pricePerLiterEl.textContent = data.price_per_liter.toFixed(3);
    totalAmountEl.textContent = data.total_amount.toFixed(2);
}

/**
 * Update breakdown table with daily consumption
 */
function updateBreakdown(breakdown) {
    // Clear existing rows
    breakdownTableBody.innerHTML = '';
    
    if (!breakdown || breakdown.length === 0) {
        breakdownSection.classList.add('hidden');
        return;
    }
    
    // Show breakdown section
    breakdownSection.classList.remove('hidden');
    
    // Format date to readable format
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('ru-RU', options);
    };
    
    // Populate table rows
    breakdown.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-gray-50' : 'bg-white';
        
        const cost = (item.liters * currentMonthData.price_per_liter).toFixed(3);
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-700">${formatDate(item.date)}</td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right font-medium">${item.liters.toFixed(2)}</td>
            <td class="px-4 py-3 text-sm text-gray-900 text-right font-medium">${cost}</td>
        `;
        
        breakdownTableBody.appendChild(row);
    });
}

/**
 * Process payment with selected method
 */
async function processPayment(method) {
    if (paymentInProgress) {
        return;
    }
    
    if (!currentMonthData) {
        showErrorModal('Данные о потреблении не загружены');
        return;
    }
    
    try {
        paymentInProgress = true;
        disablePaymentButtons();
        
        const response = await fetch('/api/pay', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: method,
                amount: currentMonthData.total_amount
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Payment failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccessModal(method, currentMonthData.total_amount);
        } else {
            throw new Error(result.message || 'Payment was not successful');
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        showErrorModal(error.message || 'Произошла ошибка при обработке платежа');
    } finally {
        paymentInProgress = false;
        enablePaymentButtons();
    }
}

/**
 * Disable all payment buttons during processing
 */
function disablePaymentButtons() {
    paymentButtons.forEach(btn => {
        btn.classList.add('disabled');
        btn.disabled = true;
        
        // Add spinner
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.setAttribute('data-spinner', 'true');
        btn.appendChild(spinner);
    });
}

/**
 * Enable all payment buttons after processing
 */
function enablePaymentButtons() {
    paymentButtons.forEach(btn => {
        btn.classList.remove('disabled');
        btn.disabled = false;
        
        // Remove spinner
        const spinner = btn.querySelector('[data-spinner="true"]');
        if (spinner) {
            spinner.remove();
        }
    });
}

/**
 * Show success modal
 */
function showSuccessModal(method, amount) {
    successMessage.textContent = `Оплата ${amount.toFixed(2)} ₸ через ${method} прошла успешно!`;
    successModal.classList.remove('hidden');
    successModal.classList.add('flex');
}

/**
 * Hide success modal
 */
function hideSuccessModal() {
    successModal.classList.add('hidden');
    successModal.classList.remove('flex');
}

/**
 * Show error modal
 */
function showErrorModal(message) {
    errorModalMessage.textContent = message;
    errorModal.classList.remove('hidden');
    errorModal.classList.add('flex');
}

/**
 * Hide error modal
 */
function hideErrorModal() {
    errorModal.classList.add('hidden');
    errorModal.classList.remove('flex');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Month selector change
    monthSelector.addEventListener('change', (e) => {
        fetchConsumptionData(e.target.value);
    });
    
    // Payment button clicks
    paymentButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const method = btn.getAttribute('data-method');
            processPayment(method);
        });
    });
    
    // Modal close buttons
    closeModalBtn.addEventListener('click', hideSuccessModal);
    closeErrorModalBtn.addEventListener('click', hideErrorModal);
    
    // Close modals on overlay click
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            hideSuccessModal();
        }
    });
    
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            hideErrorModal();
        }
    });
    
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSuccessModal();
            hideErrorModal();
        }
    });
}

/**
 * Initialize the page
 */
function init() {
    console.log('Payment page initialized');
    
    // Initialize month selector
    initializeMonthSelector();
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch data for current month
    fetchConsumptionData(monthSelector.value);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
