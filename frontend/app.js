document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const textInput = document.getElementById('text-input');
    const resultSection = document.getElementById('result-section');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');

    const resultLabel = document.getElementById('result-label');
    const confidenceVal = document.getElementById('confidence-val');
    const confidenceCircle = document.getElementById('confidence-circle');
    const resultExplanation = document.getElementById('result-explanation');

    const BACKEND_URL = 'http://localhost:5001/api/analysis';

    analyzeBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        if (!text) return;

        // UI Loading State
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        analyzeBtn.disabled = true;
        resultSection.classList.add('hidden');

        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) throw new Error('Failed to analyze');
            
            const data = await response.json();
            displayResult(data);

        } catch (error) {
            console.error(error);
            alert('An error occurred during analysis. Make sure backend and ML services are running.');
        } finally {
            // Restore UI
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function displayResult(data) {
        const label = data.label.toLowerCase();
        
        resultLabel.textContent = data.label;
        resultLabel.className = 'label-badge'; // Reset classes
        
        // Apply color based on label
        let colorHex = '#10b981'; // default green
        if (label === 'real') {
            resultLabel.classList.add('label-real');
        } else if (label === 'fake') {
            resultLabel.classList.add('label-fake');
            colorHex = '#ef4444';
        } else {
            resultLabel.classList.add('label-misleading');
            colorHex = '#f59e0b';
        }

        // Setup confidence ring
        const confPercentage = Math.round(data.confidence * 100);
        confidenceVal.textContent = `${confPercentage}%`;
        confidenceCircle.setAttribute('stroke', colorHex);
        confidenceCircle.setAttribute('stroke-dasharray', `${confPercentage}, 100`);

        // Setup Explanation
        resultExplanation.textContent = data.explanation;

        // Show result
        resultSection.classList.remove('hidden');
    }
});
